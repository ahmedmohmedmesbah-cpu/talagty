-- Run and commit this migration BEFORE 014 (PostgreSQL enum visibility).
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_delivery_review';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivery_proof_rejected';
