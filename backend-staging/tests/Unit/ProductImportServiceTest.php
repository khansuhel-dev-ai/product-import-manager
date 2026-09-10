<?php

namespace Tests\Unit;

use App\Services\ProductImportService;
use Tests\TestCase;

class ProductImportServiceTest extends TestCase
{
    private ProductImportService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ProductImportService();
    }

    public function test_parse_csv_with_valid_headers(): void
    {
        $filePath = $this->createTempCsv([
            ['sku', 'name', 'category', 'price', 'quantity'],
            ['SKU-001', 'Product 1', 'Category', '29.99', '10'],
        ]);

        $result = $this->service->parseCsv($filePath);

        $this->assertEmpty($result['header_errors']);
        $this->assertCount(1, $result['rows']);
        $this->assertEquals('SKU-001', $result['rows'][0]['sku']);

        @unlink($filePath);
    }

    public function test_parse_csv_with_missing_headers(): void
    {
        $filePath = $this->createTempCsv([
            ['sku', 'name'],
            ['SKU-001', 'Product 1'],
        ]);

        $result = $this->service->parseCsv($filePath);

        $this->assertNotEmpty($result['header_errors']);
        $this->assertEmpty($result['rows']);

        @unlink($filePath);
    }

    public function test_parse_csv_with_empty_file(): void
    {
        $filePath = tempnam(sys_get_temp_dir(), 'csv_');
        file_put_contents($filePath, '');

        $result = $this->service->parseCsv($filePath);

        $this->assertNotEmpty($result['header_errors']);
        $this->assertStringContainsString('empty', $result['header_errors'][0]);

        @unlink($filePath);
    }

    public function test_parse_csv_trims_whitespace_in_headers(): void
    {
        $filePath = $this->createTempCsv([
            [' sku ', ' name ', ' category ', ' price ', ' quantity '],
            ['SKU-001', 'Product 1', 'Category', '29.99', '10'],
        ]);

        $result = $this->service->parseCsv($filePath);

        $this->assertEmpty($result['header_errors']);
        $this->assertCount(1, $result['rows']);

        @unlink($filePath);
    }

    public function test_parse_csv_skips_empty_rows(): void
    {
        $filePath = tempnam(sys_get_temp_dir(), 'csv_');
        $content = "sku,name,category,price,quantity\n";
        $content .= "SKU-001,Product 1,Category,29.99,10\n";
        $content .= "\n"; // Empty row
        $content .= "SKU-002,Product 2,Category,39.99,20\n";
        file_put_contents($filePath, $content);

        $result = $this->service->parseCsv($filePath);

        $this->assertCount(2, $result['rows']);

        @unlink($filePath);
    }

    public function test_parse_csv_case_insensitive_headers(): void
    {
        $filePath = $this->createTempCsv([
            ['SKU', 'Name', 'CATEGORY', 'Price', 'Quantity'],
            ['SKU-001', 'Product 1', 'Category', '29.99', '10'],
        ]);

        $result = $this->service->parseCsv($filePath);

        $this->assertEmpty($result['header_errors']);
        $this->assertCount(1, $result['rows']);

        @unlink($filePath);
    }

    private function createTempCsv(array $rows): string
    {
        $filePath = tempnam(sys_get_temp_dir(), 'csv_');
        $handle = fopen($filePath, 'w');
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        fclose($handle);

        return $filePath;
    }
}

