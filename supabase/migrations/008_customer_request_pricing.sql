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
  v_requested_count INTEGER;
  v_available_count INTEGER;
BEGIN
  IF v_phone LIKE '00%' THEN v_phone := '+' || substr(v_phone, 3); END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 THEN RAISE EXCEPTION 'الاسم يجب ألا يقل عن حرفين'; END IF;
  IF length(trim(coalesce(p_address, ''))) < 5 THEN RAISE EXCEPTION 'العنوان يجب ألا يقل عن خمسة أحرف'; END IF;
  IF v_phone !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'رقم الهاتف غير صحيح'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'السلة فارغة'; END IF;

  WITH requested AS (
    SELECT product_id, sum(quantity)::INTEGER quantity FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, quantity INTEGER)
    WHERE quantity > 0 AND quantity <= 1000 AND product_id IS NOT NULL GROUP BY product_id
  ), priced AS (
    SELECT r.product_id, r.quantity, p.id,
      CASE
        WHEN p.sale_type = 'percentage' AND (p.sale_start IS NULL OR p.sale_start <= now()) AND (p.sale_end IS NULL OR p.sale_end >= now()) THEN greatest(0, p.unit_price * (1 - p.sale_value / 100))
        WHEN p.sale_type = 'fixed' AND (p.sale_start IS NULL OR p.sale_start <= now()) AND (p.sale_end IS NULL OR p.sale_end >= now()) THEN greatest(0, p.sale_value)
        ELSE p.unit_price
      END AS price
    FROM requested r JOIN products p ON p.sku = r.product_id AND p.is_active = TRUE
    WHERE p.stock_quantity - p.reserved_quantity >= r.quantity
  )
  SELECT (SELECT count(*) FROM requested), (SELECT count(*) FROM priced), coalesce((SELECT sum(price * quantity) FROM priced), 0)
  INTO v_requested_count, v_available_count, v_total;
  IF v_total <= 0 OR v_requested_count <> v_available_count THEN RAISE EXCEPTION 'يوجد منتج غير متاح أو كميته غير كافية'; END IF;

  INSERT INTO customers(full_name, phone_normalized, address) VALUES(trim(p_name), v_phone, trim(p_address))
  ON CONFLICT(phone_normalized) DO UPDATE SET full_name = EXCLUDED.full_name, address = EXCLUDED.address, updated_at = now()
  RETURNING id INTO v_customer_id;
  INSERT INTO orders(public_id, order_number, customer_id, delivery_address, status, subtotal, total)
  VALUES(v_public_id, v_order_number, v_customer_id, trim(p_address), 'pending_assignment', v_total, v_total) RETURNING id INTO v_order_id;
  INSERT INTO order_items(order_id, product_id, product_sku, product_name_ar, unit_price, quantity, line_total)
  SELECT v_order_id, p.id, p.sku, p.name_ar, priced.price, priced.quantity, priced.price * priced.quantity
  FROM (
    SELECT r.product_id, r.quantity,
      CASE
        WHEN p.sale_type = 'percentage' AND (p.sale_start IS NULL OR p.sale_start <= now()) AND (p.sale_end IS NULL OR p.sale_end >= now()) THEN greatest(0, p.unit_price * (1 - p.sale_value / 100))
        WHEN p.sale_type = 'fixed' AND (p.sale_start IS NULL OR p.sale_start <= now()) AND (p.sale_end IS NULL OR p.sale_end >= now()) THEN greatest(0, p.sale_value)
        ELSE p.unit_price
      END AS price
    FROM (SELECT product_id, sum(quantity)::INTEGER quantity FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, quantity INTEGER) WHERE quantity > 0 GROUP BY product_id) r
    JOIN products p ON p.sku = r.product_id AND p.is_active = TRUE
  ) priced JOIN products p ON p.sku = priced.product_id;
  INSERT INTO order_status_history(order_id, previous_status, new_status, note) VALUES(v_order_id, NULL, 'pending_assignment', 'تم إرسال طلب جديد لمراجعة الإدارة');
  RETURN QUERY SELECT v_public_id, v_order_number, 'pending_assignment'::order_status, v_total;
END;
$$;
