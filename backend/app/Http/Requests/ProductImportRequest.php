<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $maxSize = config('import.max_file_size'); // in KB

        return [
            'file' => [
                'required',
                'file',
                'mimes:csv,txt',
                "max:{$maxSize}",
            ],
        ];
    }

    public function messages(): array
    {
        $maxSizeMB = config('import.max_file_size') / 1024;

        return [
            'file.required' => 'Please select a CSV file to upload.',
            'file.file' => 'The uploaded item must be a file.',
            'file.mimes' => 'The file must be a CSV file.',
            'file.max' => "The file size must not exceed {$maxSizeMB} MB.",
        ];
    }
}

