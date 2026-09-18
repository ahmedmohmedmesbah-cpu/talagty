import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const file = async name => db.exec(await readFile(new URL('../'+name,import.meta.url),'utf8'));
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  for (const name of ['backend/sql/001_initial_schema.sql','backend/sql/003_users_and_admin.sql','backend/sql/004_supplier_notifications.sql',
    'supabase/migrations/006_admin_supplier_operations.sql','supabase/migrations/013_delivery_review_statuses.sql',
    'supabase/migrations/015_remove_supplier_accounts.sql']) await file(name);
  await file('supabase/migrations/015_remove_supplier_accounts.sql');
  await db.exec(`INSERT INTO users(email,full_name,password_hash,role,device_id_hash,activation_code_hash) VALUES
    ('admin@example.test','مدير الاختبار','test-only','admin',null,null),
    ('supplier@example.test','أحمد مندوب','test-only','supplier','old-device','old-code'),
    ('other@example.test','مندوب آخر','test-only','supplier',null,null);
    INSERT INTO suppliers(user_id,business_name) VALUES(2,'تلاجتى'),(3,'تلاجتى');
    INSERT INTO customers(full_name,phone_normalized,address) VALUES('متجر الاختبار','+201000000000','عنوان تجريبي');
    INSERT INTO orders(public_id,order_number,customer_id,delivery_address,status,subtotal,total,assigned_supplier_id)
    VALUES('11111111-1111-4111-8111-111111111111','TEST-1',1,'عنوان تجريبي','assigned',40,40,1);
    INSERT INTO order_supplier_assignments(order_id,supplier_id,is_primary) VALUES(1,1,true);`);
  const remove=(supplier=1,actor=1)=>db.query('SELECT remove_supplier_account($1,$2) result',[supplier,actor]);
  await assert.rejects(remove(1,2),/حساب الإدارة/);
  await assert.rejects(remove(999),/غير موجود/);
  for (const status of ['assigned','preparing','out_for_delivery','pending_delivery_review','delivery_proof_rejected']) {
    await db.query('UPDATE orders SET status=$1',[status]);
    await assert.rejects(remove(),/طلبات نشطة/);
    assert.equal((await db.query('SELECT is_active FROM users WHERE id=2')).rows[0].is_active,true);
  }
  // Split assignment must block even when the supplier is not the primary one.
  await db.exec('UPDATE orders SET assigned_supplier_id=2');
  await assert.rejects(remove(),/طلبات نشطة/);
  // Legacy primary-only assignment must also block removal.
  await db.exec('DELETE FROM order_supplier_assignments');
  await assert.rejects(remove(2),/طلبات نشطة/);
  await db.exec("UPDATE orders SET status='completed'; INSERT INTO order_supplier_assignments(order_id,supplier_id,is_primary) VALUES(1,1,false);");
  assert.equal((await remove()).rows[0].result.removed,true);
  assert.equal((await remove()).rows[0].result.already_removed,true);
  const user=(await db.query('SELECT is_active,device_id_hash,activation_code_hash FROM users WHERE id=2')).rows[0];
  assert.deepEqual(user,{is_active:false,device_id_hash:null,activation_code_hash:null});
  assert.equal((await db.query('SELECT count(*)::int n FROM suppliers WHERE removed_at IS NULL')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM orders')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM order_supplier_assignments')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM supplier_account_removals')).rows[0].n,1);
  await assert.rejects(db.exec('UPDATE orders SET assigned_supplier_id=1'),/غير متاح/);
  await assert.rejects(db.exec('UPDATE order_supplier_assignments SET supplier_id=1'),/غير متاح/);
  await db.exec('UPDATE users SET is_active=false WHERE id=1');
  await assert.rejects(remove(2),/حساب الإدارة/);
  await db.exec('UPDATE users SET is_active=true WHERE id=1');
  await db.exec('SET ROLE anon');
  await assert.rejects(remove(2),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM supplier_account_removals'),/permission denied/);
  await db.exec('RESET ROLE');
  await db.exec("UPDATE orders SET status='cancelled'");
  assert.equal((await remove(2)).rows[0].result.removed,true);
  console.log('PASS: admin-only removal, active/split/legacy order blockers, session revocation, history preservation, repeat requests, assignment guard and private audit.');
} catch (error) { console.error('Employee removal test failed:',error.message,error.detail || '',error.where || ''); process.exitCode=1; }
finally { await db.close(); }
