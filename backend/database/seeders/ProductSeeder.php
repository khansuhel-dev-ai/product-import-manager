<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            [
                'sku' => 'SKU-1001',
                'name' => 'Ronaldo Home Jersey',
                'category' => 'Football Jerseys',
                'price' => 1999.00,
                'quantity' => 25,
            ],
            [
                'sku' => 'SKU-1002',
                'name' => 'Madrid Training Jersey',
                'category' => 'Training Wear',
                'price' => 1499.00,
                'quantity' => 15,
            ],
            [
                'sku' => 'SKU-1003',
                'name' => 'Football Socks',
                'category' => 'Accessories',
                'price' => 499.00,
                'quantity' => 50,
            ],
        ];

        foreach ($products as $product) {
            Product::updateOrCreate(
                ['sku' => $product['sku']],
                $product
            );
        }
    }
}

