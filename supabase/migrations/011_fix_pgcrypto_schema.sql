-- Supabase installs pgcrypto in the extensions schema. The delivery-token
-- trigger uses a restricted search_path, so cryptographic calls must be
-- schema-qualified.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

        v_token := encode(extensions.gen_random_bytes(32), 'hex');
        INSERT INTO delivery_confirmation_tokens(order_id, token_hash, token_value, expires_at)
        VALUES (
            NEW.id,
            encode(extensions.digest(v_token, 'sha256'), 'hex'),
            v_token,
            now() + interval '365 days'
        );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_order_delivery_token() FROM PUBLIC;
