const MAX_PRODUCTS = 1000;

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

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = urlObj.pathname;

  // GET /api/products
  if (req.method === 'GET' && (urlPath === '/api/products' || urlPath === '/products')) {
    const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
    const perPage = parseInt(urlObj.searchParams.get('per_page') || '10', 10);
    
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedItems = products.slice(startIndex, endIndex);
    const total = products.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));

    return res.status(200).json({
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
    });
  }

  // GET /api/products/sample
  if (req.method === 'GET' && (urlPath === '/api/products/sample' || urlPath === '/products/sample')) {
    const csv = "sku,name,category,price,quantity\nSKU-1001,Ronaldo Home Jersey,Football Jerseys,1999.00,25\nSKU-1002,Madrid Training Jersey,Training Wear,1499.00,15\nSKU-1003,Football Socks,Accessories,499.00,50\n";
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
    return res.status(200).send(csv);
  }

  // GET /api/products/import/:id
  const matchBatch = urlPath.match(/^\/(?:api\/)?products\/import\/(\d+)$/);
  if (req.method === 'GET' && matchBatch) {
    const id = parseInt(matchBatch[1], 10);
    const batch = batches.get(id);
    if (!batch) {
      return res.status(404).json({ message: 'Import batch not found' });
    }
    return res.status(200).json({ data: batch });
  }

  // GET /api/products/import/:id/errors
  const matchErrors = urlPath.match(/^\/(?:api\/)?products\/import\/(\d+)\/errors$/);
  if (req.method === 'GET' && matchErrors) {
    const id = parseInt(matchErrors[1], 10);
    const errs = batchErrors.get(id) || [];
    return res.status(200).json({ data: errs });
  }

  // GET /api/products/import/:id/products
  const matchBatchProducts = urlPath.match(/^\/(?:api\/)?products\/import\/(\d+)\/products$/);
  if (req.method === 'GET' && matchBatchProducts) {
    const id = parseInt(matchBatchProducts[1], 10);
    const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
    const perPage = parseInt(urlObj.searchParams.get('per_page') || '10', 10);
    
    const batchProds = products.filter(p => p.import_batch_id === id);
    const startIndex = (page - 1) * perPage;
    const paginated = batchProds.slice(startIndex, startIndex + perPage);
    const lastPage = Math.max(1, Math.ceil(batchProds.length / perPage));

    return res.status(200).json({
      data: paginated,
      meta: { current_page: page, last_page: lastPage, per_page: perPage, total: batchProds.length, max_limit: MAX_PRODUCTS },
      links: { first: null, last: null, prev: null, next: null }
    });
  }

  // POST /api/products/bulk-update
  if (req.method === 'POST' && (urlPath === '/api/products/bulk-update' || urlPath === '/products/bulk-update')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const { ids, category, price, quantity } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(422).json({ message: 'No product IDs provided for bulk update.' });
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

    return res.status(200).json({ message: `${updatedCount} product(s) updated successfully.`, count: updatedCount });
  }

  // POST /api/products/bulk-delete
  if (req.method === 'POST' && (urlPath === '/api/products/bulk-delete' || urlPath === '/products/bulk-delete')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(422).json({ message: 'No product IDs provided for deletion.' });
    }

    const initialLen = products.length;
    for (let i = products.length - 1; i >= 0; i--) {
      if (ids.includes(products[i].id)) {
        products.splice(i, 1);
      }
    }
    const deletedCount = initialLen - products.length;

    return res.status(200).json({ message: `${deletedCount} product(s) deleted successfully.`, count: deletedCount });
  }

  // POST /api/products (Manual single product addition)
  if (req.method === 'POST' && (urlPath === '/api/products' || urlPath === '/products')) {
    if (products.length >= MAX_PRODUCTS) {
      return res.status(422).json({
        message: `System storage limit reached (${MAX_PRODUCTS} products). Please delete existing products before adding more.`
      });
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const { sku, name, category, price, quantity } = body;

    if (!sku || !name || !category || price === undefined || quantity === undefined) {
      return res.status(422).json({ message: 'All fields (SKU, Name, Category, Price, Quantity) are required.' });
    }

    if (products.some(p => p.sku.toUpperCase() === String(sku).trim().toUpperCase())) {
      return res.status(422).json({ message: `Product with SKU "${sku}" already exists.` });
    }

    const numPrice = parseFloat(price);
    const numQty = parseInt(quantity, 10);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(422).json({ message: 'Price must be a non-negative number.' });
    }
    if (isNaN(numQty) || numQty < 0) {
      return res.status(422).json({ message: 'Quantity must be a non-negative integer.' });
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
    return res.status(201).json({ message: 'Product created successfully.', data: newProduct });
  }

  // PUT /api/products/:id
  const matchSingleProduct = urlPath.match(/^\/(?:api\/)?products\/(\d+)$/);
  if (req.method === 'PUT' && matchSingleProduct) {
    const id = parseInt(matchSingleProduct[1], 10);
    const productIdx = products.findIndex(p => p.id === id);
    if (productIdx === -1) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const { sku, name, category, price, quantity } = body;

    if (sku && products.some(p => p.id !== id && p.sku.toUpperCase() === String(sku).trim().toUpperCase())) {
      return res.status(422).json({ message: `Another product with SKU "${sku}" already exists.` });
    }

    const prod = products[productIdx];
    if (sku) prod.sku = String(sku).trim();
    if (name) prod.name = String(name).trim();
    if (category) prod.category = String(category).trim();
    if (price !== undefined) prod.price = parseFloat(price);
    if (quantity !== undefined) prod.quantity = parseInt(quantity, 10);
    prod.updated_at = new Date().toISOString();

    return res.status(200).json({ message: 'Product updated successfully.', data: prod });
  }

  // DELETE /api/products/:id
  if (req.method === 'DELETE' && matchSingleProduct) {
    const id = parseInt(matchSingleProduct[1], 10);
    const productIdx = products.findIndex(p => p.id === id);
    if (productIdx === -1) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const deleted = products.splice(productIdx, 1)[0];
    return res.status(200).json({ message: `Product "${deleted.sku}" deleted successfully.`, data: deleted });
  }

  // POST /api/products/import
  if (req.method === 'POST' && (urlPath === '/api/products/import' || urlPath === '/products/import')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyString = Buffer.concat(chunks).toString('utf8');

    const lines = bodyString.split(/\r?\n/).filter(l => l.trim().length > 0);
    let csvLines = lines;
    const csvStartIndex = lines.findIndex(l => l.toLowerCase().startsWith('sku,'));
    if (csvStartIndex !== -1) {
      csvLines = lines.slice(csvStartIndex).filter(l => !l.startsWith('------'));
    }

    if (csvLines.length <= 1) {
      return res.status(422).json({
        message: 'The CSV file contains no data rows.',
        errors: { file: ['The CSV file must contain at least one data row.'] }
      });
    }

    const headers = csvLines[0].split(',').map(h => h.trim().toLowerCase());
    const expected = ['sku', 'name', 'category', 'price', 'quantity'];
    const missing = expected.filter(e => !headers.includes(e));
    if (missing.length > 0) {
      return res.status(422).json({
        message: 'Invalid CSV headers.',
        errors: { file: missing.map(m => `Missing required header: ${m}`) }
      });
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
      return res.status(422).json({
        message: `Storage limit exceeded! Adding ${newSkuCount} new product(s) would exceed the maximum limit of ${MAX_PRODUCTS} products (Currently: ${products.length}/${MAX_PRODUCTS}). Please delete existing products first.`,
        errors: { file: [`Storage limit reached (${products.length}/${MAX_PRODUCTS} products stored).`] }
      });
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

      return res.status(202).json({
        message: 'File uploaded successfully and queued for processing.',
        batch_id: batchId,
        status: 'pending'
      });
    } else {
      return res.status(200).json({
        message: `Import completed. ${successCount} product(s) imported.`,
        batch_id: batchId,
        status: batch.status,
        summary: { total_rows: totalRows, successful_rows: successCount, failed_rows: failCount },
        errors: errors
      });
    }
  }

  return res.status(404).json({ message: 'Not Found' });
}
