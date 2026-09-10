<?php

use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductImportController;
use Illuminate\Support\Facades\Route;

Route::get('/products', [ProductController::class, 'index']);

Route::get('/products/sample', [ProductImportController::class, 'sample']);
Route::post('/products/import', [ProductImportController::class, 'store']);
Route::get('/products/import/{batch}', [ProductImportController::class, 'show']);
Route::get('/products/import/{batch}/errors', [ProductImportController::class, 'errors']);
Route::get('/products/import/{batch}/products', [ProductImportController::class, 'products']);

