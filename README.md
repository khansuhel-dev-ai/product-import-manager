# Product Import Manager

A full-stack web application designed for uploading, validating, and importing CSV product catalog data into a database. It features real-time validation, partial import success (invalid rows don't block valid ones), duplicate SKU resolution, automatic sync (≤ 50 rows) vs async background queue (> 50 rows) processing with auto-polling, and a rich product catalog interface.

---

## 🌟 Key Features

- 📤 **CSV Upload & Drag-and-Drop**: Easy file selection with client-side & server-side validation.
- 📄 **Sample Template Download**: Instant download of pre-formatted CSV template (`sku,name,category,price,quantity`).
- 🛡️ **Comprehensive Validation**:
  - File format validation (`.csv` files only, max size 2MB).
  - Header structure verification (`sku`, `name`, `category`, `price`, `quantity`).
  - Row-level field validation (positive numeric prices, non-negative integers for quantity, non-empty text fields).
  - Duplicate SKU detection within the uploaded file.
- ⚡ **Sync & Async Processing**:
  - **Small Files (≤ 50 rows)**: Processed synchronously in real-time.
  - **Large Files (> 50 rows)**: Queued for asynchronous background processing with status polling (every 3 seconds).
- 🔄 **Idempotent Updates**: Existing SKUs in the database are automatically updated with fresh CSV data, while new SKUs are inserted.
- ⚠️ **Partial Success & Granular Error Reporting**: Valid rows are imported even if some rows contain errors. Detailed per-row errors (Row #, Field, Reason) are returned and displayed.
- 📊 **Product Catalog & History**: View all imported products with pagination and filter products by import batch.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, CSS Modules / Modern CSS |
| **Backend (Mock API Server)** | Node.js (Built-in HTTP server, zero external dependencies) |
| **Backend (Laravel)** | PHP 8.2+, Laravel 11/13, MySQL 8+, Laravel Queue (Database Driver) |

---

## 📁 Directory Structure

```
product-import-manager/
├── mock-server.js         # Zero-dependency Node.js Mock API Server (Port 8000)
├── mock-server.cjs        # CommonJS alias for mock server
├── README.md              # Project documentation and setup guide
├── .gitignore             # Git ignore patterns
├── frontend/              # React + Vite + TypeScript application
│   ├── src/               # UI components, services, types, CSS
│   ├── public/            # Static assets
│   ├── package.json       # Frontend dependencies & scripts
│   └── vite.config.ts     # Vite configuration
└── backend/              # Laravel application source code
    ├── app/               # Models, Controllers, Services, Jobs, Resources
    ├── config/            # Application & import configurations
    ├── database/          # Migrations & Seeders
    ├── routes/            # API endpoints (api.php)
    └── tests/             # Unit and Feature tests
```

---

## 🚀 End-to-End Setup Instructions

You can run this application on any machine using **Option A (Fastest - Node.js Mock Server)** or **Option B (Full Laravel + MySQL Backend)**.

---

### Option A: Fast Setup with Node.js Mock Server (Recommended for Quick Demo)

No PHP or MySQL setup is required for Option A.

#### 💡 Why the Mock Server Was Added
The standalone Node.js mock server (`mock-server.js`) was added to allow instant local testing and cloud serverless deployment (e.g., Vercel) out of the box without requiring PHP 8.2, Composer, or MySQL setup.

#### 💾 How Data is Stored In-Memory
- **In-Memory Storage**: Products, import batches, and validation errors are stored directly in Node.js runtime memory using JavaScript arrays and `Map` data structures (`products`, `batches`, `batchErrors`).
- **Persistence**: Data stays active in memory while the server process is running and resets when restarted, providing real-time CRUD operations without database installation.

#### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

#### Step-by-Step Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/khansuhel-dev-ai/product-import-manager.git
   cd product-import-manager
   ```

2. **Start the Mock API Server**
   In your project root directory, run:
   ```bash
   node mock-server.js
   ```
   *The server will start listening at `http://127.0.0.1:8000/api`.*

3. **Install & Start Frontend**
   Open a new terminal window/tab, navigate to the `frontend` folder, install dependencies, and start the development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the Application**
   Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

### Option B: Full Setup with Laravel & MySQL Backend

#### Prerequisites
- **PHP**: v8.2 or higher (with `pdo_mysql`, `mbstring`, `openssl`, `curl` extensions)
- **Composer**: v2.0 or higher
- **MySQL**: v8.0 or higher
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

#### Step-by-Step Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/khansuhel-dev-ai/product-import-manager.git
   cd product-import-manager
   ```

2. **Configure Database**
   Log into MySQL and create a database:
   ```sql
   CREATE DATABASE product_import_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Setup Backend (`backend`)**
   ```bash
   cd backend
   ```

   *If setting up a fresh Laravel environment:*
   - Copy environment configuration:
     ```bash
     cp .env.example .env
     ```
   - Update database credentials in `.env`:
     ```env
     DB_CONNECTION=mysql
     DB_HOST=127.0.0.1
     DB_PORT=3306
     DB_DATABASE=product_import_manager
     DB_USERNAME=root
     DB_PASSWORD=your_password
     QUEUE_CONNECTION=database
     ```
   - Run migrations and seed data:
     ```bash
     php artisan migrate
     php artisan db:seed --class=ProductSeeder
     ```

4. **Run Laravel Server & Queue Worker**
   - Start the API server (Terminal 1):
     ```bash
     php artisan serve --port=8000
     ```
   - Start the Queue Worker for async imports (Terminal 2):
     ```bash
     php artisan queue:work --tries=3
     ```

5. **Setup & Run Frontend**
   In a new terminal window (Terminal 3):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Open the Application**
   Navigate to `http://localhost:5173` in your browser.

---

## 📡 API Reference

Base URL: `http://127.0.0.1:8000/api`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | Fetch paginated product listing |
| `POST` | `/products/import` | Upload CSV file for validation and import |
| `GET` | `/products/import/{id}` | Get status and statistics of an import batch |
| `GET` | `/products/import/{id}/errors` | Retrieve detailed row errors for a batch |
| `GET` | `/products/import/{id}/products` | List products created/updated by a specific batch |
| `GET` | `/products/sample` | Download sample CSV template file |

---

## 🧪 Testing

### Frontend Build & Lint Verification
```bash
cd frontend
npm run build
npm run lint
```

### Backend PHPUnit Tests (Laravel)
```bash
cd backend
php artisan test
```

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
