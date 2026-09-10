<?php

namespace App\Jobs;

use App\Models\ImportBatch;
use App\Services\ProductImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessProductImport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(
        public ImportBatch $batch,
        public string $filePath,
    ) {}

    public function handle(ProductImportService $service): void
    {
        Log::info('Queue job started: processing product import', [
            'batch_id' => $this->batch->id,
            'file' => $this->batch->original_filename,
        ]);

        try {
            $parsed = $service->parseCsv($this->filePath);

            if (!empty($parsed['header_errors'])) {
                $this->batch->update([
                    'status' => ImportBatch::STATUS_FAILED,
                    'error_summary' => implode('; ', $parsed['header_errors']),
                    'completed_at' => now(),
                ]);
                $this->cleanup();
                return;
            }

            if (empty($parsed['rows'])) {
                $this->batch->update([
                    'status' => ImportBatch::STATUS_FAILED,
                    'error_summary' => 'The CSV file contains no data rows.',
                    'total_rows' => 0,
                    'completed_at' => now(),
                ]);
                $this->cleanup();
                return;
            }

            $service->importRows($this->batch, $parsed['rows']);
        } catch (\Throwable $e) {
            Log::error('Product import job failed', [
                'batch_id' => $this->batch->id,
                'error' => $e->getMessage(),
            ]);

            $this->batch->update([
                'status' => ImportBatch::STATUS_FAILED,
                'error_summary' => 'An unexpected error occurred during import.',
                'completed_at' => now(),
            ]);
        } finally {
            $this->cleanup();
        }

        Log::info('Queue job finished: product import', [
            'batch_id' => $this->batch->id,
            'status' => $this->batch->fresh()->status,
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Product import job permanently failed', [
            'batch_id' => $this->batch->id,
            'error' => $exception->getMessage(),
        ]);

        $this->batch->update([
            'status' => ImportBatch::STATUS_FAILED,
            'error_summary' => 'Import job failed after all retry attempts.',
            'completed_at' => now(),
        ]);

        $this->cleanup();
    }

    private function cleanup(): void
    {
        if (file_exists($this->filePath)) {
            @unlink($this->filePath);
        }
    }
}

