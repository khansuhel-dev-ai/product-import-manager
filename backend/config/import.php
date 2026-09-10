<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Maximum Import File Size (KB)
    |--------------------------------------------------------------------------
    |
    | The maximum allowed file size for CSV imports, in kilobytes.
    |
    */
    'max_file_size' => env('IMPORT_MAX_FILE_SIZE', 2048),

    /*
    |--------------------------------------------------------------------------
    | Queue Row Threshold
    |--------------------------------------------------------------------------
    |
    | If the CSV contains more data rows than this threshold, the import
    | will be dispatched to the queue for background processing.
    |
    */
    'queue_row_threshold' => env('IMPORT_QUEUE_ROW_THRESHOLD', 50),

    /*
    |--------------------------------------------------------------------------
    | Expected CSV Headers
    |--------------------------------------------------------------------------
    */
    'expected_headers' => ['sku', 'name', 'category', 'price', 'quantity'],

];

