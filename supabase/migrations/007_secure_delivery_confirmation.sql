CREATE OR REPLACE FUNCTION public.confirm_order_delivery(
    p_order_public_id UUID,
    p_token_hash VARCHAR,
    p_supplier_user_id BIGINT,
    p_report_email VARCHAR
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_supplier_id BIGINT;
    v_token delivery_confirmation_tokens%ROWTYPE;
    v_item RECORD;
    v_new_balance INTEGER;
BEGIN
    SELECT id INTO v_supplier_id FROM suppliers WHERE user_id = p_supplier_user_id AND is_available;
    IF NOT FOUND THEN RAISE EXCEPTION 'حساب المورد غير متاح'; END IF;
    SELECT * INTO v_order FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
    IF v_order.status <> 'out_for_delivery' THEN RAISE EXCEPTION 'الطلب غير جاهز للتسليم'; END IF;
    IF NOT EXISTS (SELECT 1 FROM order_supplier_assignments WHERE order_id = v_order.id AND supplier_id = v_supplier_id) THEN RAISE EXCEPTION 'الطلب غير مسند إلى هذا المورد'; END IF;
    SELECT * INTO v_token FROM delivery_confirmation_tokens WHERE order_id = v_order.id AND token_hash = p_token_hash AND used_at IS NULL AND expires_at > now() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'رمز الاستلام غير صحيح أو انتهت صلاحيته'; END IF;

    FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = v_order.id LOOP
        SELECT stock_quantity INTO v_new_balance FROM products WHERE id = v_item.product_id FOR UPDATE;
        IF v_new_balance < v_item.quantity THEN RAISE EXCEPTION 'المخزون غير كاف لإتمام التسليم'; END IF;
        v_new_balance := v_new_balance - v_item.quantity;
        UPDATE products SET stock_quantity = v_new_balance, reserved_quantity = greatest(0, reserved_quantity - v_item.quantity), stock_updated_at = now(), updated_at = now() WHERE id = v_item.product_id;
        INSERT INTO inventory_movements(product_id, order_id, movement_type, quantity_delta, balance_after, note, created_by)
        VALUES(v_item.product_id, v_order.id, 'sale', -v_item.quantity, v_new_balance, 'خصم تلقائي بعد تسليم الطلب', p_supplier_user_id);
    END LOOP;

    UPDATE delivery_confirmation_tokens SET used_at = now(), used_by_supplier_id = v_supplier_id WHERE id = v_token.id;
    UPDATE orders SET status = 'completed', completed_at = now(), amount_paid = total, updated_at = now() WHERE id = v_order.id;
    INSERT INTO order_status_history(order_id, previous_status, new_status, note, actor_user_id)
    VALUES(v_order.id, v_order.status, 'completed', 'تم تأكيد الاستلام بمسح الرمز', p_supplier_user_id);
    INSERT INTO email_outbox(recipient_email, subject, payload)
    VALUES(p_report_email, 'تقرير إتمام الطلب ' || v_order.order_number,
        jsonb_build_object(
            'order_id', v_order.public_id,
            'order_number', v_order.order_number,
            'completed_at', now(),
            'supplier_id', v_supplier_id,
            'customer_id', v_order.customer_id,
            'total', v_order.total,
            'timeline', (SELECT coalesce(jsonb_agg(jsonb_build_object('status', new_status, 'note', note, 'at', created_at) ORDER BY created_at), '[]'::jsonb) FROM order_status_history WHERE order_id = v_order.id)
        ));
    RETURN jsonb_build_object('order_id', v_order.public_id, 'status', 'completed', 'completed_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.create_delivery_confirmation_token(
    p_order_public_id UUID,
    p_token_hash VARCHAR,
    p_valid_minutes INTEGER DEFAULT 5
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id BIGINT;
BEGIN
    SELECT id INTO v_order_id FROM orders WHERE public_id = p_order_public_id AND status = 'out_for_delivery';
    IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير جاهز للاستلام'; END IF;
    UPDATE delivery_confirmation_tokens SET used_at = now() WHERE order_id = v_order_id AND used_at IS NULL;
    INSERT INTO delivery_confirmation_tokens(order_id, token_hash, expires_at) VALUES(v_order_id, p_token_hash, now() + make_interval(mins => greatest(1, least(p_valid_minutes, 10))));
    RETURN jsonb_build_object('order_id', p_order_public_id, 'expires_in_seconds', greatest(1, least(p_valid_minutes, 10)) * 60);
END;
$$;
