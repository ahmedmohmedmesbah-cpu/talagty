BEGIN;
CREATE TABLE IF NOT EXISTS public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  submitted_by BIGINT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by BIGINT REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
         (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (review_note IS NULL OR length(review_note) <= 1000),
  CHECK (status <> 'rejected' OR (review_note IS NOT NULL AND length(trim(review_note)) > 0))
);
CREATE INDEX IF NOT EXISTS delivery_proofs_order_idx ON public.delivery_proofs(order_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS delivery_proofs_submitter_idx ON public.delivery_proofs(submitted_by);
CREATE INDEX IF NOT EXISTS delivery_proofs_reviewer_idx ON public.delivery_proofs(reviewed_by);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_proofs_one_pending ON public.delivery_proofs(order_id) WHERE status = 'pending';
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_proofs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_proofs TO service_role;
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-proofs', 'delivery-proofs', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Old clients must not complete orders using QR codes or the generic transition RPC.
DROP TRIGGER IF EXISTS trg_orders_create_delivery_token ON public.orders;
CREATE OR REPLACE FUNCTION public.confirm_order_delivery(p_order_public_id UUID, p_token_hash VARCHAR, p_supplier_user_id BIGINT, p_report_email VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'يلزم رفع الفاتورة الموقعة واعتماد الإدارة'; END; $$;
CREATE OR REPLACE FUNCTION public.create_delivery_confirmation_token(p_order_public_id UUID, p_token_hash VARCHAR, p_valid_minutes INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'تم إلغاء نظام رموز التسليم'; END; $$;
CREATE OR REPLACE FUNCTION public.transition_order_status(p_order_public_id UUID, p_new_status order_status, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'استخدم مسارات مراجعة الطلب والتسليم المعتمدة'; END; $$;

CREATE OR REPLACE FUNCTION public.submit_delivery_proof(p_order_public_id UUID, p_actor BIGINT, p_path TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; proof_id UUID;
BEGIN
  SELECT * INTO o FROM orders WHERE public_id = p_order_public_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF NOT EXISTS (SELECT 1 FROM users u JOIN suppliers s ON s.user_id=u.id
    JOIN order_supplier_assignments a ON a.supplier_id=s.id
    WHERE u.id=p_actor AND u.role='supplier' AND u.is_active AND s.is_available AND a.order_id=o.id)
  THEN RAISE EXCEPTION 'الطلب غير مسند إلى هذا المندوب'; END IF;
  IF o.status NOT IN ('out_for_delivery','delivery_proof_rejected') THEN RAISE EXCEPTION 'لا يمكن إرسال إثبات التسليم في هذه الحالة'; END IF;
  IF p_path IS NULL OR p_path NOT LIKE p_order_public_id::text || '/' || p_actor::text || '/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='delivery-proofs' AND name=p_path)
  THEN RAISE EXCEPTION 'صورة الفاتورة غير موجودة'; END IF;
  INSERT INTO delivery_proofs(order_id,submitted_by,storage_path) VALUES(o.id,p_actor,p_path) RETURNING id INTO proof_id;
  UPDATE orders SET status='pending_delivery_review',updated_at=now() WHERE id=o.id;
  INSERT INTO order_status_history(order_id,previous_status,new_status,note,actor_user_id)
  VALUES(o.id,o.status,'pending_delivery_review','أرسل المندوب الفاتورة الموقعة لمراجعة الإدارة',p_actor);
  RETURN jsonb_build_object('proof_id',proof_id,'status','pending_delivery_review');
END; $$;

CREATE OR REPLACE FUNCTION public.review_delivery_proof(p_order_public_id UUID, p_proof_id UUID,
  p_actor BIGINT, p_approve BOOLEAN, p_note TEXT, p_email TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; proof delivery_proofs%ROWTYPE; item RECORD; balance INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin' AND is_active)
  THEN RAISE EXCEPTION 'حساب الإدارة غير متاح'; END IF;
  SELECT * INTO o FROM orders WHERE public_id=p_order_public_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  SELECT * INTO proof FROM delivery_proofs WHERE id=p_proof_id AND order_id=o.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'إثبات التسليم غير موجود'; END IF;
  IF proof.status='approved' AND o.status='completed' AND p_approve THEN
    RETURN jsonb_build_object('status','completed','already_reviewed',true);
  END IF;
  IF proof.status <> 'pending' OR o.status <> 'pending_delivery_review' THEN RAISE EXCEPTION 'تمت مراجعة الإثبات بالفعل. أعد تحميل الطلب'; END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'قرار المراجعة مطلوب'; END IF;
  IF NOT p_approve AND (p_note IS NULL OR length(trim(p_note)) NOT BETWEEN 1 AND 1000)
  THEN RAISE EXCEPTION 'اكتب سبب طلب إعادة التصوير (حتى 1000 حرف)'; END IF;
  IF p_approve THEN
    -- Aggregate duplicate product lines and lock consistently across concurrent orders.
    FOR item IN SELECT product_id,sum(quantity)::integer quantity FROM order_items WHERE order_id=o.id GROUP BY product_id ORDER BY product_id LOOP
      SELECT stock_quantity INTO balance FROM products WHERE id=item.product_id FOR UPDATE;
      IF NOT FOUND OR balance IS NULL OR balance < item.quantity THEN RAISE EXCEPTION 'المخزون غير كاف لإتمام التسليم'; END IF;
      balance := balance-item.quantity;
      UPDATE products SET stock_quantity=balance,reserved_quantity=greatest(0,reserved_quantity-item.quantity),stock_updated_at=now(),updated_at=now() WHERE id=item.product_id;
      INSERT INTO inventory_movements(product_id,order_id,movement_type,quantity_delta,balance_after,note,created_by)
      VALUES(item.product_id,o.id,'sale',-item.quantity,balance,'اعتماد الإدارة للفاتورة الموقعة',p_actor);
    END LOOP;
  END IF;
  UPDATE delivery_proofs SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') WHERE id=proof.id;
  UPDATE orders SET status=CASE WHEN p_approve THEN 'completed'::order_status ELSE 'delivery_proof_rejected'::order_status END,
    completed_at=CASE WHEN p_approve THEN now() ELSE completed_at END,
    amount_paid=CASE WHEN p_approve THEN total ELSE amount_paid END,updated_at=now() WHERE id=o.id;
  INSERT INTO order_status_history(order_id,previous_status,new_status,note,actor_user_id)
  VALUES(o.id,o.status,CASE WHEN p_approve THEN 'completed'::order_status ELSE 'delivery_proof_rejected'::order_status END,
    CASE WHEN p_approve THEN 'اعتمدت الإدارة اكتمال التسليم' ELSE 'طلبت الإدارة إعادة إرسال إثبات التسليم' END,p_actor);
  IF p_approve THEN
    INSERT INTO email_outbox(recipient_email,subject,payload) VALUES(p_email,'تقرير إتمام الطلب ' || o.order_number,
      jsonb_build_object('order_id',o.public_id,'proof_id',proof.id,'submitted_by',proof.submitted_by,'approved_by',p_actor,'completed_at',now(),
        'order_number',o.order_number,'total',o.total,
        'customer',(SELECT jsonb_build_object('name',full_name,'phone',phone_normalized) FROM customers WHERE id=o.customer_id),
        'items',(SELECT jsonb_agg(jsonb_build_object('name',product_name_ar,'quantity',quantity,'unit_price',unit_price,'line_total',line_total)) FROM order_items WHERE order_id=o.id),
        'timeline',(SELECT jsonb_agg(jsonb_build_object('status',new_status,'at',created_at,'actor',actor_user_id) ORDER BY created_at,id) FROM order_status_history WHERE order_id=o.id)));
  END IF;
  RETURN jsonb_build_object('status',CASE WHEN p_approve THEN 'completed' ELSE 'delivery_proof_rejected' END,'already_reviewed',false);
END; $$;
REVOKE ALL ON FUNCTION public.submit_delivery_proof(UUID,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_delivery_proof(UUID,UUID,BIGINT,BOOLEAN,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_delivery_proof(UUID,BIGINT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_delivery_proof(UUID,UUID,BIGINT,BOOLEAN,TEXT,TEXT) TO service_role;
COMMIT;
