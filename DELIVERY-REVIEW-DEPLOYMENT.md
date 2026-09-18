# Signed-invoice delivery approval

This replaces QR delivery confirmation. No Git commit or push has been made, and these changes are not live until deployed.

## Deploy in this order

1. Back up the database. In the Supabase SQL editor for project `evhqnshvlblkphzhcqql`, run `supabase/migrations/013_delivery_review_statuses.sql` by itself. Let it finish before the next migration: PostgreSQL must commit new enum values first.
2. Run `supabase/migrations/014_signed_delivery_review.sql`. It preserves orders and historical QR data, disables QR completion, creates the private `delivery-proofs` bucket, and installs the audited review transactions. Do not rerun older migrations afterward: they can restore the old QR functions.
3. Update the existing `talagty-api` Edge Function with the repository's `index.ts` and new `delivery-api.mjs`. Retain `appearance-api.mjs` and `appearance-config.mjs`. Deploy all files together. Keep the existing custom JWT configuration and secrets unchanged. The existing email integration still requires `RESEND_API_KEY` and a valid sending address; without them, completion succeeds and its report remains queued, not emailed.
4. Check `/functions/v1/talagty-api/health` returns version `2.2-signed-delivery-review`.
5. Commit and push the frontend changes yourself. GitHub Pages needs no private credentials. Close/reopen the installed supplier PWA or refresh it to load cache version 6. Old QR clients receive an explicit update-required error.

The brief migration-to-function deployment window disables old QR completion intentionally. Perform these steps during a quiet period.

## Acceptance test with a test order

1. Submit a customer order, approve/assign it as admin, then move it to preparing and out for delivery as the assigned supplier.
2. Print the supplier invoice; the print layout includes a signature line. Take a clear signed-invoice photo. Upload JPG, PNG or WebP, at most 5 MB. Verify the preview before sending. Upload requires internet; the app does not claim successful offline completion.
3. The supplier and customer must see **بانتظار تأكيد التسليم**. Stock must not be deducted yet, and the customer must not see a final-invoice button.
4. As admin, open the order and view the photo. Request a clearer photo with a reason. The supplier sees the reason and can submit a new photo. Previous photos and review records are retained; the customer sees the status, not the internal reason/photo.
5. Approve the new proof. Verify completed status, exactly one inventory sale deduction, one email-outbox record, and the customer's printable final invoice.
6. Refresh and retry approval: inventory and reports must not duplicate. An unrelated supplier and a customer must not be able to read proof images or approve delivery. Proof links expire after five minutes; reopen the order to renew them.
7. Test on a second physical phone and mobile data, including taking a photo, PDF printing/sharing, and refreshing customer status.

Historical completed orders stay completed. Old pending offline QR confirmations are not automatically replayed; review those deliveries manually using the new signed-photo flow.

## Read-only SQL checks

```sql
SELECT o.order_number, o.status, o.completed_at,
       p.status AS proof_status, p.submitted_by, p.submitted_at,
       p.reviewed_by, p.reviewed_at
FROM public.orders o
LEFT JOIN public.delivery_proofs p ON p.order_id = o.id
ORDER BY o.created_at DESC, p.submitted_at DESC;

SELECT order_id, product_id, count(*) AS sale_rows, sum(quantity_delta) AS sold_delta
FROM public.inventory_movements WHERE movement_type = 'sale'
GROUP BY order_id, product_id ORDER BY order_id DESC;

SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'delivery-proofs';
SELECT id, subject, status, attempts, last_error FROM public.email_outbox ORDER BY id DESC LIMIT 10;
```

## Local verification

```powershell
node --test tests/*.test.mjs
node --check admin.js
node --check supplier.js
node --check track.js
node --experimental-strip-types --check supabase/functions/talagty-api/index.ts
# Isolated PostgreSQL tests; install @electric-sql/pglite outside the repository first.
$env:PGLITE_MODULE='D:\Talagty\.delivery-test-runtime\node_modules\@electric-sql\pglite\dist\index.js'
node tests/delivery-database.mjs
```

Database tests use the repository's base schema and operational migrations with a minimal Storage schema. They do not exercise hosted Supabase Storage policies, the real email provider, or concurrent connections; verify those in staging/live acceptance testing. No production orders are changed by local tests.
