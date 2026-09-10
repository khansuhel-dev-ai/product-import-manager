const http = require('http');
const URL = require('url').URL;

const PORT = 8000;
const MAX_PRODUCTS = 1000;

// In-memory state matching Laravel DB tables
const products = [
  { id: 1, sku: 'SKU-1001', name: 'Ronaldo Home Jersey', category: 'Football Jerseys', price: 1999.00, quantity: 25, import_batch_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, sku: 'SKU-1002', name: 'Madrid Training Jersey', category: 'Training Wear', price: 1499.00, quantity: 15, import_batch_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, sku: 'SKU-1003', name: 'Football Socks', category: 'Accessories', price: 499.00, quantity: 50, import_batch_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const batches = new Map();
const batchErrors = new Map();
let batchIdCounter = 1;
let productIdCounter = 4;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function processImportRows(dataRows, batchId) {
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
      products.push({ id: productIdCounter++, sku, name, category, price, quantity: qty, import_batch_id: batchId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
  });

  return { successCount, failCount, errors };
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:8000'}`);
  const urlPath = url.pathname;

  // GET /api/products
  if (req.method === 'GET' && urlPath === '/api/products') {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '10', 10);
    
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedItems = products.slice(startIndex, endIndex);
    const total = products.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: paginatedItems,
      meta: {
        current_page: page,
        last_page: lastPage,
        per_page: perPage,
        total: total,
        max_limit: MAX_PRODUCTS
      },
      links: {
        first: `/api/products?page=1&per_page=${perPage}`,
        last: `/api/products?page=${lastPage}&per_page=${perPage}`,
        prev: page > 1 ? `/api/products?page=${page - 1}&per_page=${perPage}` : null,
        next: page < lastPage ? `/api/products?page=${page + 1}&per_page=${perPage}` : null
      }
    }));
    return;
  }

  // GET /api/products/sample
  if (req.method === 'GET' && urlPath === '/api/products/sample') {
    const csv = "sku,name,category,price,quantity\nSKU-1001,Ronaldo Home Jersey,Football Jerseys,1999.00,25\nSKU-1002,Madrid Training Jersey,Training Wear,1499.00,15\nSKU-1003,Football Socks,Accessories,499.00,50\n";
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="product-import-template.csv"'
    });
    res.end(csv);
    return;
  }

  // GET /api/products/import/:id
  const matchBatch = urlPath.match(/^\/api\/products\/import\/(\d+)$/);
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
  const matchErrors = urlPath.match(/^\/api\/products\/import\/(\d+)\/errors$/);
  if (req.method === 'GET' && matchErrors) {
    const id = parseInt(matchErrors[1], 10);
    const errs = batchErrors.get(id) || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: errs }));
    return;
  }

  // GET /api/products/import/:id/products
  const matchBatchProducts = urlPath.match(/^\/api\/products\/import\/(\d+)\/products$/);
  if (req.method === 'GET' && matchBatchProducts) {
    const id = parseInt(matchBatchProducts[1], 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '10', 10);
    
    const batchProds = products.filter(p => p.import_batch_id === id);
    const startIndex = (page - 1) * perPage;
    const paginated = batchProds.slice(startIndex, startIndex + perPage);
    const lastPage = Math.max(1, Math.ceil(batchProds.length / perPage));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: paginated,
      meta: { current_page: page, last_page: lastPage, per_page: perPage, total: batchProds.length, max_limit: MAX_PRODUCTS },
      links: { first: null, last: null, prev: null, next: null }
    }));
    return;
  }

  // POST /api/products/bulk-update
  if (req.method === 'POST' && urlPath === '/api/products/bulk-update') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const { ids, category, price, quantity } = parsed;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'No product IDs provided for bulk update.' }));
        return;
      }

      let updatedCount = 0;
      products.forEach(p => {
        if (ids.includes(p.id)) {
          if (category !== undefined && category !== null && category !== '') p.category = category;
          if (price !== undefined && price !== null && !isNaN(Number(price))) p.price = Number(price);
          if (quantity !== undefined && quantity !== null && !isNaN(Number(quantity))) p.quantity = Number(quantity);
          p.updated_at = new Date().toISOString();
          updatedCount++;
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `${updatedCount} product(s) updated successfully.`, count: updatedCount }));
    });
    return;
  }

  // POST /api/products/bulk-delete
  if (req.method === 'POST' && urlPath === '/api/products/bulk-delete') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const { ids } = parsed;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'No product IDs provided for deletion.' }));
        return;
      }

      const initialLen = products.length;
      for (let i = products.length - 1; i >= 0; i--) {
        if (ids.includes(products[i].id)) {
          products.splice(i, 1);
        }
      }
      const deletedCount = initialLen - products.length;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `${deletedCount} product(s) deleted successfully.`, count: deletedCount }));
    });
    return;
  }

  // POST /api/products (Manual single product addition)
  if (req.method === 'POST' && urlPath === '/api/products') {
    if (products.length >= MAX_PRODUCTS) {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `System storage limit reached (${MAX_PRODUCTS} products). Please delete existing products before adding more.` }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const { sku, name, category, price, quantity } = parsed;

      if (!sku || !name || !category || price === undefined || quantity === undefined) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'All fields (SKU, Name, Category, Price, Quantity) are required.' }));
        return;
      }

      if (products.some(p => p.sku.toUpperCase() === String(sku).trim().toUpperCase())) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Product with SKU "${sku}" already exists.` }));
        return;
      }

      const numPrice = parseFloat(price);
      const numQty = parseInt(quantity, 10);
      if (isNaN(numPrice) || numPrice < 0) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Price must be a non-negative number.' }));
        return;
      }
      if (isNaN(numQty) || numQty < 0) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Quantity must be a non-negative integer.' }));
        return;
      }

      const newProduct = {
        id: productIdCounter++,
        sku: String(sku).trim(),
        name: String(name).trim(),
        category: String(category).trim(),
        price: numPrice,
        quantity: numQty,
        import_batch_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      products.push(newProduct);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Product created successfully.', data: newProduct }));
    });
    return;
  }

  // PUT /api/products/:id
  const matchSingleProduct = urlPath.match(/^\/api\/products\/(\d+)$/);
  if (req.method === 'PUT' && matchSingleProduct) {
    const id = parseInt(matchSingleProduct[1], 10);
    const productIdx = products.findIndex(p => p.id === id);
    if (productIdx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Product not found.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const { sku, name, category, price, quantity } = parsed;

      if (sku && products.some(p => p.id !== id && p.sku.toUpperCase() === String(sku).trim().toUpperCase())) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Another product with SKU "${sku}" already exists.` }));
        return;
      }

      const prod = products[productIdx];
      if (sku) prod.sku = String(sku).trim();
      if (name) prod.name = String(name).trim();
      if (category) prod.category = String(category).trim();
      if (price !== undefined) prod.price = parseFloat(price);
      if (quantity !== undefined) prod.quantity = parseInt(quantity, 10);
      prod.updated_at = new Date().toISOString();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Product updated successfully.', data: prod }));
    });
    return;
  }

  // DELETE /api/products/:id
  if (req.method === 'DELETE' && matchSingleProduct) {
    const id = parseInt(matchSingleProduct[1], 10);
    const productIdx = products.findIndex(p => p.id === id);
    if (productIdx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Product not found.' }));
      return;
    }

    const deleted = products.splice(productIdx, 1)[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Product "${deleted.sku}" deleted successfully.`, data: deleted }));
    return;
  }

  // POST /api/products/import
  if (req.method === 'POST' && urlPath === '/api/products/import') {
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

      // Check 1000 product limit
      const incomingSkus = new Set();
      dataRows.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts[0]) incomingSkus.add(parts[0].toUpperCase());
      });

      let newSkuCount = 0;
      incomingSkus.forEach(sku => {
        if (!products.some(p => p.sku.toUpperCase() === sku)) {
          newSkuCount++;
        }
      });

      if (products.length + newSkuCount > MAX_PRODUCTS) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: `Storage limit exceeded! Adding ${newSkuCount} new product(s) would exceed the maximum limit of ${MAX_PRODUCTS} products (Currently: ${products.length}/${MAX_PRODUCTS}). Please delete existing products first.`,
          errors: { file: [`Storage limit reached (${products.length}/${MAX_PRODUCTS} products stored).`] }
        }));
        return;
      }

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

      batches.set(batchId, batch);
      batchErrors.set(batchId, []);

      if (isQueued) {
        // ASYNC QUEUE DISPATCH: Return HTTP 202 immediately and process products in background worker!
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'File uploaded successfully and queued for processing.',
          batch_id: batchId,
          status: 'pending'
        }));

        // Background Queue Worker Simulation
        setTimeout(() => {
          batch.status = 'processing';
          setTimeout(() => {
            const { successCount, failCount, errors } = processImportRows(dataRows, batchId);
            batch.processed_rows = totalRows;
            batch.successful_rows = successCount;
            batch.failed_rows = failCount;
            batch.status = failCount > 0 && successCount === 0 ? 'failed' : failCount > 0 ? 'completed_with_errors' : 'completed';
            batch.completed_at = new Date().toISOString();
            batchErrors.set(batchId, errors);
          }, 2500);
        }, 1500);
      } else {
        // SYNCHRONOUS: Process immediately (<= 50 rows)
        const { successCount, failCount, errors } = processImportRows(dataRows, batchId);
        batch.successful_rows = successCount;
        batch.failed_rows = failCount;
        batch.status = failCount > 0 && successCount === 0 ? 'failed' : failCount > 0 ? 'completed_with_errors' : 'completed';
        batchErrors.set(batchId, errors);

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
  console.log(`Mock API Server running at http://127.0.0.1:${PORT}/api (Max Products Limit: ${MAX_PRODUCTS})`);
});
