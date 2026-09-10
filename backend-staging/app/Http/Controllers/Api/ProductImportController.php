<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductImportRequest;
use App\Http\Resources\ImportBatchResource;
use App\Http\Resources\ImportErrorResource;
use App\Http\Resources\ProductResource;
use App\Jobs\ProcessProductImport;
use App\Models\ImportBatch;
use App\Services\ProductImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductImportController extends Controller
{
    public function __construct(
        private ProductImportService $importService,
    ) {}

    /**
     * POST /api/products/import
     */
    public function store(ProductImportRequest $request): JsonResponse
    {
        $file = $request->file('file');
        $originalFilename = $file->getClientOriginalName();
        $threshold = config('import.queue_row_threshold');

        Log::info('CSV upload started', ['filename' => $originalFilename]);

        // Store file temporarily with a safe name
        $tempPath = $file->store('imports', 'local');
        $fullPath = storage_path("app/{$tempPath}");

        // Parse CSV to check headers and count rows
        $parsed = $this->importService->parseCsv($fullPath);

        // Header validation failed
        if (!empty($parsed['header_errors'])) {
            @unlink($fullPath);
            return response()->json([
                'message' => 'Invalid CSV headers.',
                'errors' => ['file' => $parsed['header_errors']],
            ], 422);
        }

        // No data rows
        if (empty($parsed['rows'])) {
            @unlink($fullPath);
            return response()->json([
                'message' => 'The CSV file contains no data rows.',
                'errors' => ['file' => ['The CSV file must contain at least one data row.']],
            ], 422);
        }

        $rowCount = count($parsed['rows']);

        // Create import batch
        $batch = ImportBatch::create([
            'original_filename' => $originalFilename,
            'total_rows' => $rowCount,
            'status' => ImportBatch::STATUS_PENDING,
        ]);

        Log::info('Import batch created', [
            'batch_id' => $batch->id,
            'total_rows' => $rowCount,
            'mode' => $rowCount > $threshold ? 'queued' : 'synchronous',
        ]);

        if ($rowCount > $threshold) {
            // Dispatch to queue
            ProcessProductImport::dispatch($batch, $fullPath);

            return response()->json([
                'message' => 'File uploaded successfully and queued for processing.',
                'batch_id' => $batch->id,
                'status' => $batch->status,
            ], 202);
        }

        // Process synchronously
        Log::info('Synchronous import started', ['batch_id' => $batch->id]);

        $this->importService->importRows($batch, $parsed['rows']);

        // Clean up temp file
        @unlink($fullPath);

        $batch->refresh();

        $response = [
            'message' => $this->getSyncMessage($batch),
            'batch_id' => $batch->id,
            'status' => $batch->status,
            'summary' => [
                'total_rows' => $batch->total_rows,
                'successful_rows' => $batch->successful_rows,
                'failed_rows' => $batch->failed_rows,
            ],
        ];

        if ($batch->failed_rows > 0) {
            $response['errors'] = ImportErrorResource::collection($batch->errors)->resolve();
        }

        return response()->json($response, 200);
    }

    /**
     * GET /api/products/import/{batch}
     */
    public function show(ImportBatch $batch): ImportBatchResource
    {
        return new ImportBatchResource($batch);
    }

    /**
     * GET /api/products/import/{batch}/errors
     */
    public function errors(ImportBatch $batch): AnonymousResourceCollection
    {
        return ImportErrorResource::collection(
            $batch->errors()->orderBy('row_number')->get()
        );
    }

    /**
     * GET /api/products/import/{batch}/products
     */
    public function products(ImportBatch $batch): AnonymousResourceCollection
    {
        return ProductResource::collection(
            $batch->products()->paginate(15)
        );
    }

    /**
     * GET /api/products/sample
     */
    public function sample(): StreamedResponse
    {
        $headers = config('import.expected_headers');

        $sampleRows = [
            ['SKU-1001', 'Ronaldo Home Jersey', 'Football Jerseys', '1999.00', '25'],
            ['SKU-1002', 'Madrid Training Jersey', 'Training Wear', '1499.00', '15'],
            ['SKU-1003', 'Football Socks', 'Accessories', '499.00', '50'],
        ];

        return response()->streamDownload(function () use ($headers, $sampleRows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($sampleRows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, 'product-import-template.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function getSyncMessage(ImportBatch $batch): string
    {
        if ($batch->failed_rows === 0) {
            return "Import completed successfully. {$batch->successful_rows} product(s) imported.";
        }

        return "Import completed with errors. {$batch->successful_rows} product(s) imported, {$batch->failed_rows} row(s) failed.";
    }
}

