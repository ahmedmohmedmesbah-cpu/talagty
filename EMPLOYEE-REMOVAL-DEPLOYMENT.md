# Remove employee accounts

Admin → الموردون → **إزالة المندوب**. Confirm the employee name before removal.

- The account disappears from employee and assignment lists. Login, activation and subsequent authenticated requests are blocked; device and activation credentials are cleared.
- Orders, invoices, signed delivery proofs and the employee's historical identity are retained. This is account archival, not permanent erasure of personal data.
- Removal is blocked by any non-completed/non-cancelled assigned order, including split assignments and delivery proofs awaiting review. Resolve these orders first.
- Phone, email and national ID remain associated with the archived identity and cannot be used to create a new account. No restore interface is included in this change.
- The database records who removed the account and when. Repeat removal requests are safe.

## Deployment

1. Apply `supabase/migrations/015_remove_supplier_accounts.sql` in the existing Supabase project's SQL editor, after previous migrations.
2. Deploy the updated `supabase/functions/talagty-api/index.ts` with all existing Edge Function modules retained.
3. Commit and push `admin.html` and `admin.js` yourself, then refresh the admin page. Do not publish the frontend alone: the delete endpoint needs the migration and updated function.

No live employee account is removed by deploying the migration. No code has been committed or pushed by the assistant.

## Tests

```powershell
node --check admin.js
node --experimental-strip-types --check supabase/functions/talagty-api/index.ts
node --test tests/*.test.mjs
$env:PGLITE_MODULE='D:\Talagty\.delivery-test-runtime\node_modules\@electric-sql\pglite\dist\index.js'
node tests/employee-removal-database.mjs
node tests/delivery-database.mjs
```

After deployment, use a disposable test employee: cancel the confirmation once and verify no change, then confirm removal. Verify it disappears, cannot log in, and a previously signed-in phone receives a session error on refresh. An employee with an active order must remain unchanged. Confirm historical completed orders still show the original employee name.

Read-only audit query:

```sql
SELECT s.id, u.full_name, u.is_active, s.removed_at, a.removed_by
FROM public.suppliers s
JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.supplier_account_removals a ON a.supplier_id = s.id
ORDER BY s.id DESC;
```
