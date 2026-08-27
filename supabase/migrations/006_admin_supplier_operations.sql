-- Tallagty operational schema: admin catalog, central inventory, supplier PWA and audited delivery.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'deferred_review';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'assigned';

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_code_hash VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id_hash VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_activated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone_normalized ON users(phone_normalized) WHERE phone_normalized IS NOT NULL;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS national_id VARCHAR(32);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vehicle_details VARCHAR(300);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_national_id ON suppliers(national_id) WHERE national_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    name_ar VARCHAR(150) NOT NULL,
    description_ar TEXT,
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories(slug, name_ar, description_ar, sort_order) VALUES
('dairy', 'ألبان', 'منتجات الألبان الطازجة', 1),
('cheese', 'أجبان', 'تشكيلة الأجبان', 2),
('luncheon', 'لانشون', 'منتجات اللانشون', 3)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE products ADD COLUMN IF NOT EXISTS description_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_type VARCHAR(16) NOT NULL DEFAULT 'none' CHECK (sale_type IN ('none', 'percentage', 'fixed'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sale_value >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_start TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_end TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS ix_products_category_id ON products(category_id);
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = CASE WHEN sku LIKE 'mc%' THEN 'dairy' WHEN sku LIKE 'ch%' THEN 'cheese' ELSE 'luncheon' END) WHERE category_id IS NULL;
UPDATE products SET image_url = CASE sku
    WHEN 'mc1' THEN 'https://picsum.photos/400/400?random=30'
    WHEN 'mc2' THEN 'https://picsum.photos/400/400?random=31'
    WHEN 'ch1' THEN 'https://picsum.photos/400/400?random=33'
    WHEN 'ch2' THEN 'https://picsum.photos/400/400?random=34'
    ELSE image_url END
WHERE image_url IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(24) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'credit'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'EGP';

CREATE TABLE IF NOT EXISTS order_supplier_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(order_id, supplier_id)
);
CREATE INDEX IF NOT EXISTS ix_order_supplier_assignments_supplier ON order_supplier_assignments(supplier_id, assigned_at DESC);

CREATE TABLE IF NOT EXISTS order_item_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES order_supplier_assignments(id) ON DELETE CASCADE,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE(assignment_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS ix_order_item_assignments_item ON order_item_assignments(order_item_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment_add', 'adjustment_remove', 'return')),
    quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    note TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_product ON inventory_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_confirmation_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by_supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_delivery_tokens_order ON delivery_confirmation_tokens(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_outbox (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_email VARCHAR(254) NOT NULL,
    subject VARCHAR(250) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_email_outbox_pending ON email_outbox(status, created_at) WHERE status = 'pending';

ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.admin_review_order(
    p_order_public_id UUID,
    p_decision order_status,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_address TEXT,
    p_admin_note TEXT,
    p_items JSONB,
    p_actor_user_id BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_phone TEXT := regexp_replace(trim(coalesce(p_customer_phone, '')), '[^0-9+]', '', 'g');
    v_total NUMERIC(12,2);
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
    IF v_order.status NOT IN ('pending_assignment', 'deferred_review') THEN RAISE EXCEPTION 'تمت مراجعة هذا الطلب من قبل'; END IF;
    IF p_decision NOT IN ('approved', 'deferred_review', 'cancelled') THEN RAISE EXCEPTION 'قرار المراجعة غير صحيح'; END IF;
    IF length(trim(coalesce(p_customer_name, ''))) < 2 OR length(trim(coalesce(p_customer_address, ''))) < 5 THEN RAISE EXCEPTION 'بيانات العميل غير مكتملة'; END IF;
    IF v_phone !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'رقم الهاتف غير صحيح'; END IF;
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'يجب أن يحتوي الطلب على منتج واحد'; END IF;

    SELECT coalesce(sum((item->>'quantity')::INTEGER * (item->>'unit_price')::NUMERIC), 0) INTO v_total FROM jsonb_array_elements(p_items) item
    WHERE (item->>'quantity')::INTEGER > 0 AND (item->>'unit_price')::NUMERIC >= 0;
    IF v_total <= 0 THEN RAISE EXCEPTION 'إجمالي الطلب غير صحيح'; END IF;

    UPDATE customers SET full_name = trim(p_customer_name), phone_normalized = v_phone, address = trim(p_customer_address), updated_at = now() WHERE id = v_order.customer_id;
    DELETE FROM order_items WHERE order_id = v_order.id;
    INSERT INTO order_items(order_id, product_id, product_sku, product_name_ar, unit_price, quantity, line_total)
    SELECT v_order.id, p.id, p.sku, p.name_ar, (item->>'unit_price')::NUMERIC, (item->>'quantity')::INTEGER,
           (item->>'unit_price')::NUMERIC * (item->>'quantity')::INTEGER
    FROM jsonb_array_elements(p_items) item JOIN products p ON p.sku = item->>'product_id'
    WHERE (item->>'quantity')::INTEGER > 0 AND (item->>'unit_price')::NUMERIC >= 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر حفظ منتجات الطلب'; END IF;

    IF p_decision = 'approved' THEN
        FOR v_item IN SELECT oi.product_id, oi.quantity, p.stock_quantity, p.reserved_quantity FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = v_order.id FOR UPDATE OF p LOOP
            IF v_item.stock_quantity - v_item.reserved_quantity < v_item.quantity THEN RAISE EXCEPTION 'المخزون المتاح لا يكفي لاعتماد الطلب'; END IF;
            UPDATE products SET reserved_quantity = reserved_quantity + v_item.quantity, updated_at = now() WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    UPDATE orders SET delivery_address = trim(p_customer_address), admin_note = nullif(trim(p_admin_note), ''), status = p_decision,
        subtotal = v_total, total = v_total + delivery_fee, approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE approved_at END, updated_at = now()
    WHERE id = v_order.id;
    INSERT INTO order_status_history(order_id, previous_status, new_status, note, actor_user_id)
    VALUES(v_order.id, v_order.status, p_decision, p_admin_note, p_actor_user_id);
    RETURN jsonb_build_object('order_id', v_order.public_id, 'status', p_decision, 'total', v_total + v_order.delivery_fee);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_order_suppliers(
    p_order_public_id UUID,
    p_assignments JSONB,
    p_actor_user_id BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_assignment JSONB;
    v_assignment_id BIGINT;
    v_supplier_id BIGINT;
    v_first_supplier BIGINT;
    v_item JSONB;
BEGIN
    SELECT * INTO v_order FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
    IF v_order.status <> 'approved' THEN RAISE EXCEPTION 'يجب اعتماد الطلب قبل الإسناد'; END IF;
    IF jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN RAISE EXCEPTION 'اختر مورداً واحداً على الأقل'; END IF;
    DELETE FROM order_supplier_assignments WHERE order_id = v_order.id;
    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
        v_supplier_id := (v_assignment->>'supplier_id')::BIGINT;
        IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = v_supplier_id AND is_available) THEN RAISE EXCEPTION 'أحد الموردين غير متاح'; END IF;
        IF v_first_supplier IS NULL THEN v_first_supplier := v_supplier_id; END IF;
        INSERT INTO order_supplier_assignments(order_id, supplier_id, is_primary) VALUES(v_order.id, v_supplier_id, v_first_supplier = v_supplier_id) RETURNING id INTO v_assignment_id;
        IF jsonb_array_length(coalesce(v_assignment->'items', '[]'::jsonb)) = 0 THEN
            INSERT INTO order_item_assignments(assignment_id, order_item_id, quantity) SELECT v_assignment_id, id, quantity FROM order_items WHERE order_id = v_order.id;
        ELSE
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_assignment->'items') LOOP
                INSERT INTO order_item_assignments(assignment_id, order_item_id, quantity)
                SELECT v_assignment_id, id, (v_item->>'quantity')::INTEGER FROM order_items
                WHERE id = (v_item->>'order_item_id')::BIGINT AND order_id = v_order.id;
            END LOOP;
        END IF;
        INSERT INTO supplier_notifications(supplier_id, order_id, message_ar) VALUES(v_supplier_id, v_order.id, 'تم إسناد طلب جديد إليك');
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM order_items oi LEFT JOIN (
            SELECT oia.order_item_id, sum(oia.quantity) assigned_quantity FROM order_item_assignments oia
            JOIN order_supplier_assignments osa ON osa.id = oia.assignment_id WHERE osa.order_id = v_order.id GROUP BY oia.order_item_id
        ) assigned ON assigned.order_item_id = oi.id
        WHERE oi.order_id = v_order.id AND coalesce(assigned.assigned_quantity, 0) <> oi.quantity
    ) THEN RAISE EXCEPTION 'يجب توزيع كل كميات الطلب بالكامل دون زيادة أو نقص'; END IF;
    UPDATE orders SET assigned_supplier_id = v_first_supplier, status = 'assigned', updated_at = now() WHERE id = v_order.id;
    INSERT INTO order_status_history(order_id, previous_status, new_status, note, actor_user_id) VALUES(v_order.id, v_order.status, 'assigned', 'تم إسناد الطلب للمورد', p_actor_user_id);
    RETURN jsonb_build_object('order_id', v_order.public_id, 'status', 'assigned');
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_transition_order(
    p_order_public_id UUID,
    p_new_status order_status,
    p_supplier_user_id BIGINT,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order orders%ROWTYPE; v_supplier_id BIGINT;
BEGIN
    SELECT id INTO v_supplier_id FROM suppliers WHERE user_id = p_supplier_user_id AND is_available;
    IF NOT FOUND THEN RAISE EXCEPTION 'حساب المورد غير متاح'; END IF;
    SELECT * INTO v_order FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM order_supplier_assignments WHERE order_id = v_order.id AND supplier_id = v_supplier_id) THEN RAISE EXCEPTION 'الطلب غير مسند إلى هذا المورد'; END IF;
    IF NOT ((v_order.status = 'assigned' AND p_new_status = 'preparing') OR (v_order.status = 'preparing' AND p_new_status = 'out_for_delivery')) THEN RAISE EXCEPTION 'لا يمكن تنفيذ هذا الانتقال'; END IF;
    UPDATE orders SET status = p_new_status, updated_at = now() WHERE id = v_order.id;
    UPDATE order_supplier_assignments SET accepted_at = coalesce(accepted_at, now()) WHERE order_id = v_order.id AND supplier_id = v_supplier_id;
    INSERT INTO order_status_history(order_id, previous_status, new_status, note, actor_user_id) VALUES(v_order.id, v_order.status, p_new_status, p_note, p_supplier_user_id);
    RETURN jsonb_build_object('order_id', v_order.public_id, 'status', p_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
    p_product_id BIGINT,
    p_movement_type VARCHAR,
    p_quantity INTEGER,
    p_note TEXT,
    p_actor_user_id BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product products%ROWTYPE; v_delta INTEGER;
BEGIN
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر'; END IF;
    IF p_movement_type NOT IN ('purchase', 'adjustment_add', 'adjustment_remove', 'return') THEN RAISE EXCEPTION 'نوع الحركة غير صحيح'; END IF;
    SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'المنتج غير موجود'; END IF;
    v_delta := CASE WHEN p_movement_type = 'adjustment_remove' THEN -p_quantity ELSE p_quantity END;
    IF v_product.stock_quantity + v_delta < 0 THEN RAISE EXCEPTION 'لا توجد كمية كافية في المخزون'; END IF;
    UPDATE products SET stock_quantity = stock_quantity + v_delta, stock_updated_at = now(), updated_at = now() WHERE id = p_product_id;
    INSERT INTO inventory_movements(product_id, movement_type, quantity_delta, balance_after, note, created_by)
    VALUES(p_product_id, p_movement_type, v_delta, v_product.stock_quantity + v_delta, p_note, p_actor_user_id);
    RETURN jsonb_build_object('product_id', p_product_id, 'stock_quantity', v_product.stock_quantity + v_delta);
END;
$$;
