# Tallagty order service

This is the backend for the existing Arabic storefront. It accepts customer orders, calculates totals from its own catalog, provides phone-based customer lookup, and exposes a JWT-protected admin feed.

## What is included

- Customer order API: `POST /api/orders`
- Customer order lookup: `GET /api/orders?phone=...`
- Admin login: `POST /api/auth/login`
- Protected order feed: `GET /api/admin/orders`
- Controlled status transitions: `PATCH /api/admin/orders/{order_id}/status`
- Supplier account creation and order assignment for administrators
- Supplier-specific assigned-order feed
- Arabic product seed data and PostgreSQL database migrations

## Local verification

1. Copy `.env.example` to `.env`. Keep the provided values only for a local test.
2. Install packages with `python -m pip install -r requirements.txt`.
3. Start the service: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
4. Set `TALLAGTY_API_BASE_URL` in `../talagty/api-config.js` to `http://YOUR_COMPUTER_LAN_IP:8000` for devices connected to the same Wi-Fi.
5. Open the customer storefront, place an order, and then open `admin.html`.
6. Sign in using the bootstrap values from `.env`, then verify the new order and move it through Preparing, Out for Delivery, and Completed.

## Public deployment for different Wi-Fi/mobile data

GitHub Pages only serves the storefront. Deploy this directory as a Docker service on a public HTTPS host and use PostgreSQL. Configure these environment values at the host:

- `DATABASE_URL`: hosted PostgreSQL connection string.
- `ALLOWED_ORIGINS`: `https://ahmedmohmedmesbah-cpu.github.io`
- `JWT_SECRET`: a long random secret.
- `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`: secure administrator credentials.

Apply the database migrations in this order before the first production start:

1. `sql/001_initial_schema.sql`
2. `sql/002_seed_products.sql`
3. `sql/003_users_and_admin.sql`
4. `sql/004_supplier_notifications.sql`

After deployment, replace the URL in `../talagty/api-config.js` with the public HTTPS API URL and publish the updated storefront to GitHub Pages. Customer and admin devices can then use any internet connection.

Never publish the default local administrator password or the `.env` file.
