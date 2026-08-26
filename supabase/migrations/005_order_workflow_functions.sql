CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_name TEXT, p_phone TEXT, p_address TEXT, p_items JSONB
)
RETURNS TABLE(order_id UUID, order_number TEXT, status order_status, total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone TEXT := regexp_replace(trim(coalesce(p_phone, '')), '[^0-9+]', '', 'g');
  v_customer_id BIGINT;
  v_order_id BIGINT;
  v_public_id UUID := gen_random_uuid();
  v_order_number TEXT := 'TLG-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(v_public_id::text, '-', ''), 1, 8));
  v_total NUMERIC(12,2);
BEGIN
  IF v_phone LIKE '00%' THEN v_phone := '+' || substr(v_phone, 3); END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 OR length(trim(coalesce(p_address, ''))) < 5 THEN RAISE EXCEPTION 'بيانات العميل غير مكتملة'; END IF;
  IF v_phone !~ '^\\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'رقم الهاتف غير صحيح'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'السلة فارغة'; END IF;

  WITH requested AS (
    SELECT product_id, sum(quantity)::INTEGER quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, quantity INTEGER)
    WHERE quantity > 0 AND quantity <= 1000 AND product_id IS NOT NULL
    GROUP BY product_id
  )
  SELECT coalesce(sum(p.unit_price * r.quantity), 0) INTO v_total FROM requested r JOIN products p ON p.sku = r.product_id AND p.is_active = TRUE;
  IF v_total = 0 OR (SELECT count(*) FROM requested) <> (SELECT count(*) FROM requested r JOIN products p ON p.sku = r.product_id AND p.is_active = TRUE) THEN RAISE EXCEPTION 'يوجد منتج غير متاح في الطلب'; END IF;

  INSERT INTO customers(full_name, phone_normalized, address) VALUES(trim(p_name), v_phone, trim(p_address))
  ON CONFLICT(phone_normalized) DO UPDATE SET full_name = EXCLUDED.full_name, address = EXCLUDED.address, updated_at = now()
  RETURNING id INTO v_customer_id;
  INSERT INTO orders(public_id, order_number, customer_id, delivery_address, status, subtotal, total)
  VALUES(v_public_id, v_order_number, v_customer_id, trim(p_address), 'pending_assignment', v_total, v_total) RETURNING id INTO v_order_id;
  INSERT INTO order_items(order_id, product_id, product_sku, product_name_ar, unit_price, quantity, line_total)
  SELECT v_order_id, p.id, p.sku, p.name_ar, p.unit_price, r.quantity, p.unit_price * r.quantity
  FROM (SELECT product_id, sum(quantity)::INTEGER quantity FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, quantity INTEGER) WHERE quantity > 0 GROUP BY product_id) r JOIN products p ON p.sku = r.product_id;
  INSERT INTO order_status_history(order_id, previous_status, new_status, note) VALUES(v_order_id, NULL, 'pending_assignment', 'تم إنشاء الطلب');
  RETURN QUERY SELECT v_public_id, v_order_number, 'pending_assignment'::order_status, v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_order_supplier(p_order_public_id UUID, p_supplier_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order orders%ROWTYPE; v_supplier suppliers%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF v_order.status <> 'pending_assignment' THEN RAISE EXCEPTION 'لا يمكن إسناد هذا الطلب بعد بدء التجهيز'; END IF;
  SELECT * INTO v_supplier FROM suppliers WHERE id = p_supplier_id AND is_available = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المورد غير متاح'; END IF;
  UPDATE orders SET assigned_supplier_id = p_supplier_id, status = 'preparing', updated_at = now() WHERE id = v_order.id;
  INSERT INTO order_status_history(order_id, previous_status, new_status, note) VALUES(v_order.id, 'pending_assignment', 'preparing', 'تم إسناد الطلب إلى مورد');
  INSERT INTO supplier_notifications(supplier_id, order_id, message_ar) VALUES(p_supplier_id, v_order.id, 'تم إسناد طلب جديد إليك');
  RETURN jsonb_build_object('order_id', v_order.public_id, 'status', 'preparing', 'supplier_id', p_supplier_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status(p_order_public_id UUID, p_new_status order_status, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF NOT ((v_order.status = 'pending_assignment' AND p_new_status IN ('preparing', 'cancelled'))
       OR (v_order.status = 'preparing' AND p_new_status IN ('out_for_delivery', 'cancelled'))
       OR (v_order.status = 'out_for_delivery' AND p_new_status = 'completed')) THEN
    RAISE EXCEPTION 'لا يمكن تنفيذ هذا الانتقال لحالة الطلب';
  END IF;
  UPDATE orders SET status = p_new_status, updated_at = now() WHERE id = v_order.id;
  INSERT INTO order_status_history(order_id, previous_status, new_status, note) VALUES(v_order.id, v_order.status, p_new_status, p_note);
  RETURN jsonb_build_object('order_id', v_order.public_id, 'status', p_new_status);
END;
$$;
