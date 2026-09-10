<?php

namespace Tests\Feature;

use App\Jobs\ProcessProductImport;
use App\Models\ImportBatch;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ProductImportTest extends TestCase
{
    use RefreshDatabase;

    private function createCsvFile(array $rows, string $filename = 'test.csv'): UploadedFile
    {
        $content = '';
        foreach ($rows as $row) {
            $content .= implode(',', $row) . "\n";
        }

        return UploadedFile::fake()->createWithContent($filename, $content);
    }

    private function createValidCsvWithRows(int $count): UploadedFile
    {
        $rows = [['sku', 'name', 'category', 'price', 'quantity']];
        for ($i = 1; $i <= $count; $i++) {
            $rows[] = ["SKU-{$i}", "Product {$i}", 'Category', '99.99', '10'];
        }

        return $this->createCsvFile($rows);
    }

    // -------------------------------------------------------
    // 1. Successful CSV upload with <= 50 rows
    // -------------------------------------------------------
    public function test_successful_csv_upload_sync(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['SKU-001', 'Test Product', 'Test Category', '29.99', '10'],
            ['SKU-002', 'Another Product', 'Other Category', '49.99', '5'],
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'batch_id',
                'status',
                'summary' => ['total_rows', 'successful_rows', 'failed_rows'],
            ])
            ->assertJsonPath('summary.total_rows', 2)
            ->assertJsonPath('summary.successful_rows', 2)
            ->assertJsonPath('summary.failed_rows', 0);

        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseHas('products', ['sku' => 'SKU-001', 'name' => 'Test Product']);
        $this->assertDatabaseHas('products', ['sku' => 'SKU-002', 'name' => 'Another Product']);
    }

    // -------------------------------------------------------
    // 2. CSV with invalid file type
    // -------------------------------------------------------
    public function test_rejects_non_csv_file(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $response = $this->postJson('/api/products/import', ['file' => $file]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    // -------------------------------------------------------
    // 3. CSV exceeding maximum file size
    // -------------------------------------------------------
    public function test_rejects_oversized_file(): void
    {
        // Create a file larger than 2MB
        $file = UploadedFile::fake()->create('large.csv', 3000, 'text/csv');

        $response = $this->postJson('/api/products/import', ['file' => $file]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    // -------------------------------------------------------
    // 4. Missing required CSV headers
    // -------------------------------------------------------
    public function test_rejects_csv_with_missing_headers(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name'], // Missing category, price, quantity
            ['SKU-001', 'Test Product'],
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'Invalid CSV headers.']);
    }

    // -------------------------------------------------------
    // 5. Invalid row data
    // -------------------------------------------------------
    public function test_invalid_row_data_recorded_as_errors(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['SKU-001', 'Valid Product', 'Category', '29.99', '10'],
            ['', 'No SKU Product', 'Category', '29.99', '10'],       // Missing SKU
            ['SKU-003', 'Bad Price', 'Category', 'abc', '10'],       // Non-numeric price
            ['SKU-004', 'Bad Qty', 'Category', '29.99', '-5'],       // Negative quantity
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(200);

        $data = $response->json();
        $this->assertEquals(1, $data['summary']['successful_rows']);
        $this->assertEquals(3, $data['summary']['failed_rows']);

        $this->assertDatabaseCount('products', 1);
        $this->assertDatabaseHas('products', ['sku' => 'SKU-001']);
    }

    // -------------------------------------------------------
    // 6. Duplicate SKU within same CSV
    // -------------------------------------------------------
    public function test_duplicate_sku_in_same_csv(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['SKU-001', 'First Product', 'Category', '29.99', '10'],
            ['SKU-001', 'Duplicate Product', 'Category', '39.99', '5'],
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(200);

        $data = $response->json();
        $this->assertEquals(1, $data['summary']['successful_rows']);
        $this->assertEquals(1, $data['summary']['failed_rows']);

        // Only one product created
        $this->assertDatabaseCount('products', 1);
        $this->assertDatabaseHas('products', ['sku' => 'SKU-001', 'name' => 'First Product']);

        // Error recorded for duplicate
        $this->assertDatabaseHas('import_errors', [
            'field' => 'sku',
            'error_message' => 'Duplicate SKU in uploaded file.',
        ]);
    }

    // -------------------------------------------------------
    // 7. Existing SKU gets updated
    // -------------------------------------------------------
    public function test_existing_sku_gets_updated(): void
    {
        Product::create([
            'sku' => 'SKU-001',
            'name' => 'Old Name',
            'category' => 'Old Category',
            'price' => 10.00,
            'quantity' => 1,
        ]);

        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['SKU-001', 'Updated Name', 'Updated Category', '99.99', '50'],
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(200)
            ->assertJsonPath('summary.successful_rows', 1);

        // Only one product (updated, not duplicated)
        $this->assertDatabaseCount('products', 1);
        $this->assertDatabaseHas('products', [
            'sku' => 'SKU-001',
            'name' => 'Updated Name',
            'category' => 'Updated Category',
            'price' => 99.99,
            'quantity' => 50,
        ]);
    }

    // -------------------------------------------------------
    // 8. New SKU gets created
    // -------------------------------------------------------
    public function test_new_sku_gets_created(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['NEW-SKU-001', 'Brand New Product', 'New Category', '199.99', '100'],
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(200)
            ->assertJsonPath('summary.successful_rows', 1);

        $this->assertDatabaseHas('products', [
            'sku' => 'NEW-SKU-001',
            'name' => 'Brand New Product',
        ]);
    }

    // -------------------------------------------------------
    // 9. CSV with > 50 rows dispatches a queue job
    // -------------------------------------------------------
    public function test_large_csv_dispatches_queue_job(): void
    {
        Queue::fake();

        $csv = $this->createValidCsvWithRows(51);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(202)
            ->assertJsonStructure(['message', 'batch_id', 'status'])
            ->assertJsonPath('status', 'pending');

        Queue::assertPushed(ProcessProductImport::class);

        $this->assertDatabaseHas('import_batches', [
            'status' => 'pending',
            'total_rows' => 51,
        ]);
    }

    // -------------------------------------------------------
    // 10. Queue job processes the import
    // -------------------------------------------------------
    public function test_queue_job_processes_import(): void
    {
        // Create a CSV file manually
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['JOB-001', 'Job Product 1', 'Category', '19.99', '5'],
            ['JOB-002', 'Job Product 2', 'Category', '29.99', '10'],
        ]);

        // Store the file
        $tempDir = storage_path('app/imports');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }
        $tempPath = $tempDir . '/test-job-' . uniqid() . '.csv';
        copy($csv->getPathname(), $tempPath);

        $batch = ImportBatch::create([
            'original_filename' => 'test.csv',
            'total_rows' => 2,
            'status' => ImportBatch::STATUS_PENDING,
        ]);

        // Execute the job directly
        $job = new ProcessProductImport($batch, $tempPath);
        $job->handle(app(\App\Services\ProductImportService::class));

        $batch->refresh();
        $this->assertEquals(ImportBatch::STATUS_COMPLETED, $batch->status);
        $this->assertEquals(2, $batch->successful_rows);
        $this->assertEquals(0, $batch->failed_rows);

        $this->assertDatabaseHas('products', ['sku' => 'JOB-001']);
        $this->assertDatabaseHas('products', ['sku' => 'JOB-002']);
    }

    // -------------------------------------------------------
    // 11. Import status endpoint works
    // -------------------------------------------------------
    public function test_import_status_endpoint(): void
    {
        $batch = ImportBatch::create([
            'original_filename' => 'test.csv',
            'total_rows' => 10,
            'processed_rows' => 10,
            'successful_rows' => 8,
            'failed_rows' => 2,
            'status' => ImportBatch::STATUS_COMPLETED_WITH_ERRORS,
        ]);

        $response = $this->getJson("/api/products/import/{$batch->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $batch->id)
            ->assertJsonPath('data.status', 'completed_with_errors')
            ->assertJsonPath('data.total_rows', 10)
            ->assertJsonPath('data.successful_rows', 8)
            ->assertJsonPath('data.failed_rows', 2);
    }

    // -------------------------------------------------------
    // 12. Import errors are stored correctly
    // -------------------------------------------------------
    public function test_import_errors_stored_and_retrievable(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['SKU-001', 'Good Product', 'Category', '29.99', '10'],
            ['', '', '', '', ''],  // All fields empty
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);
        $batchId = $response->json('batch_id');

        $errorsResponse = $this->getJson("/api/products/import/{$batchId}/errors");

        $errorsResponse->assertStatus(200);
        $errors = $errorsResponse->json('data');
        $this->assertNotEmpty($errors);
        $this->assertEquals(3, $errors[0]['row_number']); // Row 3 in file (header=1, data starts at 2)
    }

    // -------------------------------------------------------
    // 13. Sample CSV endpoint returns downloadable CSV
    // -------------------------------------------------------
    public function test_sample_csv_download(): void
    {
        $response = $this->get('/api/products/sample');

        $response->assertStatus(200)
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertDownload('product-import-template.csv');

        $content = $response->streamedContent();
        $this->assertStringContains('sku', $content);
        $this->assertStringContains('SKU-1001', $content);
    }

    // -------------------------------------------------------
    // Additional: Empty CSV file
    // -------------------------------------------------------
    public function test_rejects_empty_csv(): void
    {
        $csv = $this->createCsvFile([]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(422);
    }

    // -------------------------------------------------------
    // Additional: CSV with only headers, no data rows
    // -------------------------------------------------------
    public function test_rejects_csv_with_only_headers(): void
    {
        $csv = $this->createCsvFile([
            ['sku', 'name', 'category', 'price', 'quantity'],
        ]);

        $response = $this->postJson('/api/products/import', ['file' => $csv]);

        $response->assertStatus(422)
            ->assertJsonFragment(['The CSV file must contain at least one data row.']);
    }

    // -------------------------------------------------------
    // Additional: Products list endpoint
    // -------------------------------------------------------
    public function test_products_index_endpoint(): void
    {
        Product::create([
            'sku' => 'LIST-001',
            'name' => 'Listed Product',
            'category' => 'Category',
            'price' => 49.99,
            'quantity' => 10,
        ]);

        $response = $this->getJson('/api/products');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'sku', 'name', 'category', 'price', 'quantity'],
                ],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    // -------------------------------------------------------
    // Additional: Batch products endpoint
    // -------------------------------------------------------
    public function test_batch_products_endpoint(): void
    {
        $batch = ImportBatch::create([
            'original_filename' => 'test.csv',
            'total_rows' => 1,
            'status' => ImportBatch::STATUS_COMPLETED,
        ]);

        Product::create([
            'sku' => 'BATCH-001',
            'name' => 'Batch Product',
            'category' => 'Category',
            'price' => 49.99,
            'quantity' => 10,
            'import_batch_id' => $batch->id,
        ]);

        $response = $this->getJson("/api/products/import/{$batch->id}/products");

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sku', 'BATCH-001');
    }

    // -------------------------------------------------------
    // Additional: No file provided
    // -------------------------------------------------------
    public function test_rejects_request_without_file(): void
    {
        $response = $this->postJson('/api/products/import', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    /**
     * Custom assertion helper since assertStringContainsString is the PHPUnit name.
     */
    private function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertTrue(
            str_contains($haystack, $needle),
            "Failed asserting that '{$haystack}' contains '{$needle}'."
        );
    }
}

