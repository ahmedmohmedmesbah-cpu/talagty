CREATE TYPE user_role AS ENUM ('admin', 'supplier');

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(200) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE orders
    ADD COLUMN assigned_supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL;
CREATE INDEX ix_orders_assigned_supplier_id ON orders(assigned_supplier_id);
