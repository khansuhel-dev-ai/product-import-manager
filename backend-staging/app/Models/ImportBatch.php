<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_COMPLETED_WITH_ERRORS = 'completed_with_errors';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'original_filename',
        'total_rows',
        'processed_rows',
        'successful_rows',
        'failed_rows',
        'status',
        'error_summary',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'processed_rows' => 'integer',
            'successful_rows' => 'integer',
            'failed_rows' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function errors(): HasMany
    {
        return $this->hasMany(ImportError::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [
            self::STATUS_COMPLETED,
            self::STATUS_COMPLETED_WITH_ERRORS,
            self::STATUS_FAILED,
        ]);
    }
}

