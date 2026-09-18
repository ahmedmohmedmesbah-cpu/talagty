-- Archive removed accounts; retain orders, signed invoices and identity history.
BEGIN;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.supplier_account_removals (
  supplier_id BIGINT PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  removed_by BIGINT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_removals_actor_idx ON public.supplier_account_removals(removed_by);
ALTER TABLE public.supplier_account_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_account_removals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supplier_account_removals TO service_role;

CREATE OR REPLACE FUNCTION public.remove_supplier_account(p_supplier_id BIGINT, p_actor_user_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s suppliers%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor_user_id AND role='admin' AND is_active)
  THEN RAISE EXCEPTION 'حساب الإدارة غير متاح'; END IF;
  SELECT * INTO s FROM suppliers WHERE id=p_supplier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'حساب المندوب غير موجود'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=s.user_id AND role='supplier')
  THEN RAISE EXCEPTION 'يمكن إزالة حسابات المندوبين فقط'; END IF;
  IF s.removed_at IS NOT NULL THEN
    RETURN jsonb_build_object('supplier_id',s.id,'removed',true,'already_removed',true);
  END IF;
  IF EXISTS(SELECT 1 FROM orders o WHERE o.status NOT IN ('completed','cancelled') AND
    (o.assigned_supplier_id=s.id OR EXISTS(SELECT 1 FROM order_supplier_assignments a WHERE a.order_id=o.id AND a.supplier_id=s.id)))
  THEN RAISE EXCEPTION 'لا يمكن إزالة المندوب لأن لديه طلبات نشطة. أكمل معالجة طلباته أولاً'; END IF;
  UPDATE users SET is_active=false,device_id_hash=NULL,device_activated_at=NULL,
    phone_verified_at=NULL,activation_code_hash=NULL,activation_expires_at=NULL WHERE id=s.user_id;
  UPDATE suppliers SET is_available=false,removed_at=now(),updated_at=now() WHERE id=s.id;
  INSERT INTO supplier_account_removals(supplier_id,removed_by) VALUES(s.id,p_actor_user_id);
  RETURN jsonb_build_object('supplier_id',s.id,'removed',true,'already_removed',false);
END; $$;
REVOKE ALL ON FUNCTION public.remove_supplier_account(BIGINT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.remove_supplier_account(BIGINT,BIGINT) TO service_role;

-- Serialize assignment with removal, including legacy primary-supplier assignments.
CREATE OR REPLACE FUNCTION public.guard_supplier_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_supplier_id BIGINT; s suppliers%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='orders' THEN v_supplier_id := NEW.assigned_supplier_id;
  ELSE v_supplier_id := NEW.supplier_id; END IF;
  IF v_supplier_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM suppliers WHERE id=v_supplier_id FOR UPDATE;
  IF NOT FOUND OR s.removed_at IS NOT NULL OR NOT s.is_available THEN
    RAISE EXCEPTION 'حساب المندوب غير متاح أو تمت إزالته';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=s.user_id AND role='supplier' AND is_active)
  THEN RAISE EXCEPTION 'حساب المندوب غير متاح'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_supplier_assignment() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_supplier_assignment ON public.order_supplier_assignments;
CREATE TRIGGER guard_supplier_assignment BEFORE INSERT OR UPDATE OF supplier_id ON public.order_supplier_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_assignment();
DROP TRIGGER IF EXISTS guard_primary_supplier_assignment ON public.orders;
CREATE TRIGGER guard_primary_supplier_assignment BEFORE INSERT OR UPDATE OF assigned_supplier_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_assignment();
COMMIT;
