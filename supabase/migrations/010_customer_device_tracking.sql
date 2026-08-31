-- Secure customer tracking, one-device binding, cancellation and persistent delivery QR.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS device_id_hash VARCHAR(128);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS device_bound_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_customers_device_id_hash
    ON customers(device_id_hash)
    WHERE device_id_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    phone_normalized VARCHAR(20) NOT NULL,
    device_id_hash VARCHAR(128),
    code_hash VARCHAR(128) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'manual_whatsapp',
    provider_reference VARCHAR(160),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'expired', 'failed', 'cancelled')),
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- These ALTER statements keep this migration safe if the earlier SMS draft was
-- already created in the project before manual WhatsApp activation was selected.
ALTER TABLE customer_otp_challenges ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE customer_otp_challenges ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE customer_otp_challenges ADD COLUMN IF NOT EXISTS code_hash VARCHAR(128);
ALTER TABLE customer_otp_challenges ALTER COLUMN device_id_hash DROP NOT NULL;
ALTER TABLE customer_otp_challenges ALTER COLUMN provider SET DEFAULT 'manual_whatsapp';

CREATE INDEX IF NOT EXISTS ix_customer_otp_phone_created
    ON customer_otp_challenges(phone_normalized, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_customer_otp_cleanup
    ON customer_otp_challenges(expires_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ix_customer_otp_customer_created
    ON customer_otp_challenges(customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_customer_activation_challenge(
    p_customer_id BIGINT
) RETURNS TABLE (
    challenge_id UUID,
    phone_normalized VARCHAR,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE customer_otp_challenges AS challenge
    SET status = 'expired'
    WHERE challenge.customer_id = p_customer_id
      AND challenge.status = 'pending'
      AND challenge.expires_at <= now();

    RETURN QUERY
    SELECT challenge.id, challenge.phone_normalized, challenge.expires_at
    FROM customer_otp_challenges challenge
    WHERE challenge.customer_id = p_customer_id
      AND challenge.status = 'pending'
      AND challenge.expires_at > now()
      AND challenge.code_hash IS NOT NULL
    ORDER BY challenge.created_at DESC
    LIMIT 1;
END;
$$;

ALTER TABLE delivery_confirmation_tokens ADD COLUMN IF NOT EXISTS token_value TEXT;
ALTER TABLE delivery_confirmation_tokens ALTER COLUMN expires_at SET DEFAULT (now() + interval '365 days');

WITH ranked_tokens AS (
    SELECT id,
           row_number() OVER (PARTITION BY order_id ORDER BY created_at DESC, id DESC) AS position
    FROM delivery_confirmation_tokens
    WHERE used_at IS NULL
)
UPDATE delivery_confirmation_tokens token
SET used_at = now()
FROM ranked_tokens ranked
WHERE token.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_active_token_per_order
    ON delivery_confirmation_tokens(order_id)
    WHERE used_at IS NULL;

CREATE OR REPLACE FUNCTION public.bind_customer_device(
    p_customer_id BIGINT,
    p_device_id_hash VARCHAR
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer customers%ROWTYPE;
BEGIN
    SELECT * INTO v_customer
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'لا يوجد طلب مرتبط بهذا الرقم';
    END IF;
    IF length(coalesce(p_device_id_hash, '')) < 32 THEN
        RAISE EXCEPTION 'معرّف الجهاز غير صحيح';
    END IF;
    IF v_customer.device_id_hash IS NOT NULL AND v_customer.device_id_hash <> p_device_id_hash THEN
        RAISE EXCEPTION 'هذا الرقم مرتبط بجهاز آخر. تواصل مع الإدارة لتغيير الجهاز';
    END IF;

    UPDATE customers
    SET device_id_hash = coalesce(device_id_hash, p_device_id_hash),
        phone_verified_at = coalesce(phone_verified_at, now()),
        device_bound_at = coalesce(device_bound_at, now()),
        last_seen_at = now(),
        updated_at = now()
    WHERE id = v_customer.id;

    RETURN jsonb_build_object(
        'customer_id', v_customer.id,
        'phone', v_customer.phone_normalized,
        'full_name', v_customer.full_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_order_delivery_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    IF NEW.status = 'assigned' AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE delivery_confirmation_tokens
        SET used_at = coalesce(used_at, now())
        WHERE order_id = NEW.id AND used_at IS NULL;

        v_token := encode(gen_random_bytes(32), 'hex');
        INSERT INTO delivery_confirmation_tokens(order_id, token_hash, token_value, expires_at)
        VALUES (
            NEW.id,
            encode(digest(v_token, 'sha256'), 'hex'),
            v_token,
            now() + interval '365 days'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_create_delivery_token ON orders;
CREATE TRIGGER trg_orders_create_delivery_token
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_delivery_token();

-- Backfill a persistent QR for active orders that were assigned before this migration.
WITH existing AS (
    SELECT token.id, encode(gen_random_bytes(32), 'hex') AS token_value
    FROM delivery_confirmation_tokens token
    JOIN orders o ON o.id = token.order_id
    WHERE o.status IN ('assigned', 'preparing', 'out_for_delivery')
      AND token.used_at IS NULL
      AND token.token_value IS NULL
)
UPDATE delivery_confirmation_tokens token
SET token_value = existing.token_value,
    token_hash = encode(digest(existing.token_value, 'sha256'), 'hex'),
    expires_at = now() + interval '365 days'
FROM existing
WHERE token.id = existing.id;

WITH missing AS (
    SELECT o.id, encode(gen_random_bytes(32), 'hex') AS token_value
    FROM orders o
    WHERE o.status IN ('assigned', 'preparing', 'out_for_delivery')
      AND NOT EXISTS (
          SELECT 1 FROM delivery_confirmation_tokens token
          WHERE token.order_id = o.id AND token.used_at IS NULL AND token.token_value IS NOT NULL
      )
)
INSERT INTO delivery_confirmation_tokens(order_id, token_hash, token_value, expires_at)
SELECT id, encode(digest(token_value, 'sha256'), 'hex'), token_value, now() + interval '365 days'
FROM missing
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.customer_cancel_order(
    p_order_public_id UUID,
    p_customer_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order
    FROM orders
    WHERE public_id = p_order_public_id
      AND customer_id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود';
    END IF;
    IF v_order.status NOT IN ('pending_assignment', 'deferred_review', 'approved', 'assigned', 'preparing') THEN
        RAISE EXCEPTION 'لا يمكن إلغاء الطلب بعد خروجه للتوصيل';
    END IF;

    IF v_order.status IN ('approved', 'assigned', 'preparing') THEN
        FOR v_item IN
            SELECT product_id, quantity
            FROM order_items
            WHERE order_id = v_order.id
        LOOP
            UPDATE products
            SET reserved_quantity = greatest(0, reserved_quantity - v_item.quantity),
                updated_at = now()
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    UPDATE delivery_confirmation_tokens
    SET used_at = coalesce(used_at, now())
    WHERE order_id = v_order.id AND used_at IS NULL;

    UPDATE orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_order.id;

    INSERT INTO order_status_history(order_id, previous_status, new_status, note)
    VALUES(v_order.id, v_order.status, 'cancelled', 'ألغى العميل الطلب من صفحة متابعة الفاتورة');

    RETURN jsonb_build_object(
        'order_id', v_order.public_id,
        'status', 'cancelled',
        'cancelled_at', now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.bind_customer_device(BIGINT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_activation_challenge(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_cancel_order(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_order_delivery_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bind_customer_device(BIGINT, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_activation_challenge(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(UUID, BIGINT) TO service_role;

-- Customer and delivery secrets must never be readable through the public REST API.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_confirmation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_otp_challenges ENABLE ROW LEVEL SECURITY;
