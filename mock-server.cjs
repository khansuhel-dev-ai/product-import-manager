const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// In-memory state matching Laravel DB tables
const products = [
  { id: 1, sku: 'SKU-1001', name: 'Ronaldo Home Jersey', category: 'Football Jerseys', price: 1999.00, quantity: 25, import_batch_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, sku: 'SKU-1002', name: 'Madrid Training Jersey', category: 'Training Wear', price: 1499.00, quantity: 15, import_batch_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, sku: 'SKU-1003', name: 'Football Socks', category: 'Accessories', price: 499.00, quantity: 50, import_batch_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const batches = new Map();
const batchErrors = new Map();
let batchIdCounter = 1;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET /api/products
  if (req.method === 'GET' && url.pathname === '/api/products') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: products,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: products.length },
      links: { first: '/api/products?page=1', last: '/api/products?page=1', prev: null, next: null }
    }));
    return;
  }

  // GET /api/products/sample
  if (req.method === 'GET' && url.pathname === '/api/products/sample') {
    const csv = "sku,name,category,price,quantity\nSKU-1001,Ronaldo Home Jersey,Football Jerseys,1999.00,25\nSKU-1002,Madrid Training Jersey,Training Wear,1499.00,15\nSKU-1003,Football Socks,Accessories,499.00,50\n";
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="product-import-template.csv"'
    });
    res.end(csv);
    return;
  }

  // GET /api/products/import/:id
  const matchBatch = url.pathname.match(/^\/api\/products\/import\/(\d+)$/);
  if (req.method === 'GET' && matchBatch) {
    const id = parseInt(matchBatch[1], 10);
    const batch = batches.get(id);
    if (!batch) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Import batch not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: batch }));
    return;
  }

  // GET /api/products/import/:id/errors
  const matchErrors = url.pathname.match(/^\/api\/products\/import\/(\d+)\/errors$/);
  if (req.method === 'GET' && matchErrors) {
    const id = parseInt(matchErrors[1], 10);
    const errs = batchErrors.get(id) || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: errs }));
    return;
  }

  // GET /api/products/import/:id/products
  const matchBatchProducts = url.pathname.match(/^\/api\/products\/import\/(\d+)\/products$/);
  if (req.method === 'GET' && matchBatchProducts) {
    const id = parseInt(matchBatchProducts[1], 10);
    const batchProds = products.filter(p => p.import_batch_id === id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: batchProds,
      meta: { current_page: 1, last_page: 1, per_page: 15, total: batchProds.length },
      links: { first: null, last: null, prev: null, next: null }
    }));
    return;
  }

  // POST /api/products/import
  if (req.method === 'POST' && url.pathname === '/api/products/import') {
    let body = Buffer.alloc(0);
    req.on('data', chunk => body = Buffer.concat([body, chunk]));
    req.on('end', () => {
      const content = body.toString('utf8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      let csvLines = lines;
      const csvStartIndex = lines.findIndex(l => l.toLowerCase().startsWith('sku,'));
      if (csvStartIndex !== -1) {
        csvLines = lines.slice(csvStartIndex).filter(l => !l.startsWith('------'));
      }

      if (csvLines.length <= 1) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'The CSV file contains no data rows.', errors: { file: ['The CSV file must contain at least one data row.'] } }));
        return;
      }

      const headers = csvLines[0].split(',').map(h => h.trim().toLowerCase());
      const expected = ['sku', 'name', 'category', 'price', 'quantity'];
      const missing = expected.filter(e => !headers.includes(e));
      if (missing.length > 0) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Invalid CSV headers.', errors: { file: missing.map(m => `Missing required header: ${m}`) } }));
        return;
      }

      const dataRows = csvLines.slice(1);
      const batchId = batchIdCounter++;
      const totalRows = dataRows.length;
      
      const isQueued = totalRows > 50;
      const batch = {
        id: batchId,
        original_filename: 'uploaded.csv',
        total_rows: totalRows,
        processed_rows: isQueued ? 0 : totalRows,
        successful_rows: 0,
        failed_rows: 0,
        status: isQueued ? 'pending' : 'completed',
        error_summary: null,
        started_at: new Date().toISOString(),
        completed_at: isQueued ? null : new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const errors = [];
      let successCount = 0;
      let failCount = 0;
      const seenSkus = new Set();

      dataRows.forEach((line, idx) => {
        const rowNum = idx + 2;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 5) return;
        const [sku, name, category, priceStr, qtyStr] = parts;
        const price = parseFloat(priceStr);
        const qty = parseInt(qtyStr, 10);

        if (!sku) {
          errors.push({ id: errors.length + 1, import_batch_id: batchId, row_number: rowNum, field: 'sku', error_message: 'SKU is required.', row_data: { sku, name, category, price: priceStr, quantity: qtyStr } });
          failCount++;
          return;
        }
        if (seenSkus.has(sku.toUpperCase())) {
          errors.push({ id: errors.length + 1, import_batch_id: batchId, row_number: rowNum, field: 'sku', error_message: 'Duplicate SKU in uploaded file.', row_data: { sku, name, category, price: priceStr, quantity: qtyStr } });
          failCount++;
          return;
        }
        if (isNaN(price) || price < 0) {
          errors.push({ id: errors.length + 1, import_batch_id: batchId, row_number: rowNum, field: 'price', error_message: 'Price must be a positive number.', row_data: { sku, name, category, price: priceStr, quantity: qtyStr } });
          failCount++;
          return;
        }

        seenSkus.add(sku.toUpperCase());
        successCount++;

        const existingIdx = products.findIndex(p => p.sku === sku);
        if (existingIdx !== -1) {
          products[existingIdx] = { ...products[existingIdx], name, category, price, quantity: qty, import_batch_id: batchId, updated_at: new Date().toISOString() };
        } else {
          products.push({ id: products.length + 1, sku, name, category, price, quantity: qty, import_batch_id: batchId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
      });

      batch.successful_rows = successCount;
      batch.failed_rows = failCount;
      if (failCount > 0 && successCount > 0) batch.status = 'completed_with_errors';
      if (failCount > 0 && successCount === 0) batch.status = 'failed';

      batches.set(batchId, batch);
      batchErrors.set(batchId, errors);

      if (isQueued) {
        setTimeout(() => {
          batch.status = 'processing';
          setTimeout(() => {
            batch.processed_rows = totalRows;
            batch.status = failCount > 0 ? 'completed_with_errors' : 'completed';
            batch.completed_at = new Date().toISOString();
          }, 3000);
        }, 2000);

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'File uploaded successfully and queued for processing.',
          batch_id: batchId,
          status: 'pending'
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: `Import completed. ${successCount} product(s) imported.`,
          batch_id: batchId,
          status: batch.status,
          summary: { total_rows: totalRows, successful_rows: successCount, failed_rows: failCount },
          errors: errors
        }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not Found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock API Server running at http://127.0.0.1:${PORT}/api`);
});

