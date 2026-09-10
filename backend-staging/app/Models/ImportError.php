<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportError extends Model
{
    protected $fillable = [
        'import_batch_id',
        'row_number',
        'field',
        'error_message',
        'row_data',
    ];

    protected function casts(): array
    {
        return [
            'row_data' => 'array',
            'row_number' => 'integer',
        ];
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }
}

