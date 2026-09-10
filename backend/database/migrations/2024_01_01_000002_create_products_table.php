<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku', 50)->unique();
            $table->string('name', 255);
            $table->string('category', 100);
            $table->decimal('price', 10, 2);
            $table->unsignedInteger('quantity');
            $table->foreignId('import_batch_id')->nullable()->constrained('import_batches')->nullOnDelete();
            $table->timestamps();

            $table->index('category');
            $table->index('import_batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};

