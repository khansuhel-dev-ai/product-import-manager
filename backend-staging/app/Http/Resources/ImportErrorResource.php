<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ImportErrorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'import_batch_id' => $this->import_batch_id,
            'row_number' => $this->row_number,
            'field' => $this->field,
            'error_message' => $this->error_message,
            'row_data' => $this->row_data,
        ];
    }
}

