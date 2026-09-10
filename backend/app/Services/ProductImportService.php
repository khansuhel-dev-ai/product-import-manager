<?php

namespace App\Services;

use App\Models\ImportBatch;
use App\Models\ImportError;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProductImportService
{
    /**
     * Parse a CSV file and return validated headers and rows.
     *
     * @return array{headers: string[], rows: array<int, array<string, string>>, header_errors: string[]}
     */
    public function parseCsv(string $filePath): array
    {
        $handle = fopen($filePath, 'r');

        if ($handle === false) {
            return ['headers' => [], 'rows' => [], 'header_errors' => ['Unable to read the uploaded file.']];
        }

        // Read header row
        $headerRow = fgetcsv($handle);

        if ($headerRow === false || $headerRow === [null]) {
            fclose($handle);
            return ['headers' => [], 'rows' => [], 'header_errors' => ['The CSV file is empty.']];
        }

        // Normalize headers (trim whitespace, lowercase)
        $headers = array_map(fn($h) => strtolower(trim($h)), $headerRow);
        $expectedHeaders = config('import.expected_headers');
        $headerErrors = [];

        foreach ($expectedHeaders as $expected) {
            if (!in_array($expected, $headers)) {
                $headerErrors[] = "Missing required header: {$expected}";
            }
        }

        if (!empty($headerErrors)) {
            fclose($handle);
            return ['headers' => $headers, 'rows' => [], 'header_errors' => $headerErrors];
        }

        // Read data rows
        $rows = [];
        $rowNumber = 1; // Data rows start at 2 in the file, but we track as 1-indexed data rows

        while (($data = fgetcsv($handle)) !== false) {
            // Skip completely empty rows
            if ($data === [null] || (count($data) === 1 && trim($data[0]) === '')) {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                $row[$header] = isset($data[$index]) ? trim($data[$index]) : '';
            }
            $row['_row_number'] = $rowNumber + 1; // +1 for the header row
            $rows[] = $row;
            $rowNumber++;
        }

        fclose($handle);

        return ['headers' => $headers, 'rows' => $rows, 'header_errors' => []];
    }

    /**
     * Process and import validated rows into the database.
     */
    public function importRows(ImportBatch $batch, array $rows): void
    {
        $batch->update([
            'status' => ImportBatch::STATUS_PROCESSING,
            'started_at' => now(),
            'total_rows' => count($rows),
        ]);

        $successCount = 0;
        $failCount = 0;
        $processedCount = 0;
        $seenSkus = [];

        foreach ($rows as $row) {
            $processedCount++;
            $rowNumber = $row['_row_number'];
            $rowData = array_diff_key($row, ['_row_number' => true]);

            // Validate the row
            $errors = $this->validateRow($rowData, $seenSkus);

            if (!empty($errors)) {
                foreach ($errors as $error) {
                    ImportError::create([
                        'import_batch_id' => $batch->id,
                        'row_number' => $rowNumber,
                        'field' => $error['field'],
                        'error_message' => $error['message'],
                        'row_data' => $rowData,
                    ]);
                }
                $failCount++;
            } else {
                // Track this SKU as seen
                $seenSkus[strtoupper($rowData['sku'])] = $rowNumber;

                // Create or update the product
                try {
                    DB::transaction(function () use ($rowData, $batch) {
                        Product::updateOrCreate(
                            ['sku' => $rowData['sku']],
                            [
                                'name' => $rowData['name'],
                                'category' => $rowData['category'],
                                'price' => $rowData['price'],
                                'quantity' => $rowData['quantity'],
                                'import_batch_id' => $batch->id,
                            ]
                        );
                    });
                    $successCount++;
                } catch (\Throwable $e) {
                    Log::error('Failed to import product row', [
                        'batch_id' => $batch->id,
                        'row_number' => $rowNumber,
                        'sku' => $rowData['sku'],
                        'error' => $e->getMessage(),
                    ]);

                    ImportError::create([
                        'import_batch_id' => $batch->id,
                        'row_number' => $rowNumber,
                        'field' => null,
                        'error_message' => 'Failed to save product. Please try again.',
                        'row_data' => $rowData,
                    ]);
                    $failCount++;
                }
            }

            // Update progress periodically (every 10 rows)
            if ($processedCount % 10 === 0) {
                $batch->update([
                    'processed_rows' => $processedCount,
                    'successful_rows' => $successCount,
                    'failed_rows' => $failCount,
                ]);
            }
        }

        // Final status update
        $status = match (true) {
            $failCount === 0 => ImportBatch::STATUS_COMPLETED,
            $successCount === 0 => ImportBatch::STATUS_FAILED,
            default => ImportBatch::STATUS_COMPLETED_WITH_ERRORS,
        };

        $batch->update([
            'processed_rows' => $processedCount,
            'successful_rows' => $successCount,
            'failed_rows' => $failCount,
            'status' => $status,
            'completed_at' => now(),
            'error_summary' => $failCount > 0
                ? "{$failCount} row(s) failed validation or import."
                : null,
        ]);

        Log::info('Product import completed', [
            'batch_id' => $batch->id,
            'total_rows' => $batch->total_rows,
            'successful_rows' => $successCount,
            'failed_rows' => $failCount,
            'status' => $status,
        ]);
    }

    /**
     * Validate a single CSV row. Returns an array of errors (empty if valid).
     *
     * @param  array<string, string>  $row
     * @param  array<string, int>  $seenSkus  SKUs already encountered in this file (uppercase => row number)
     * @return array<int, array{field: string|null, message: string}>
     */
    private function validateRow(array $row, array $seenSkus): array
    {
        $errors = [];

        // SKU validation
        $sku = $row['sku'] ?? '';
        if ($sku === '') {
            $errors[] = ['field' => 'sku', 'message' => 'SKU is required.'];
        } elseif (strlen($sku) > 50) {
            $errors[] = ['field' => 'sku', 'message' => 'SKU must not exceed 50 characters.'];
        } elseif (isset($seenSkus[strtoupper($sku)])) {
            $errors[] = ['field' => 'sku', 'message' => 'Duplicate SKU in uploaded file.'];
        }

        // Name validation
        $name = $row['name'] ?? '';
        if ($name === '') {
            $errors[] = ['field' => 'name', 'message' => 'Name is required.'];
        } elseif (strlen($name) > 255) {
            $errors[] = ['field' => 'name', 'message' => 'Name must not exceed 255 characters.'];
        }

        // Category validation
        $category = $row['category'] ?? '';
        if ($category === '') {
            $errors[] = ['field' => 'category', 'message' => 'Category is required.'];
        } elseif (strlen($category) > 100) {
            $errors[] = ['field' => 'category', 'message' => 'Category must not exceed 100 characters.'];
        }

        // Price validation
        $price = $row['price'] ?? '';
        if ($price === '') {
            $errors[] = ['field' => 'price', 'message' => 'Price is required.'];
        } elseif (!is_numeric($price)) {
            $errors[] = ['field' => 'price', 'message' => 'Price must be a number.'];
        } elseif ((float) $price < 0) {
            $errors[] = ['field' => 'price', 'message' => 'Price must be at least 0.'];
        }

        // Quantity validation
        $quantity = $row['quantity'] ?? '';
        if ($quantity === '') {
            $errors[] = ['field' => 'quantity', 'message' => 'Quantity is required.'];
        } elseif (!ctype_digit($quantity) && $quantity !== '0') {
            $errors[] = ['field' => 'quantity', 'message' => 'Quantity must be a whole number.'];
        } elseif ((int) $quantity < 0) {
            $errors[] = ['field' => 'quantity', 'message' => 'Quantity must be at least 0.'];
        }

        return $errors;
    }
}

