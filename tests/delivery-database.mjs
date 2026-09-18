// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite/dist/index.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const sqlFile = async path => {
  const sql = await readFile(new URL('../'+path,import.meta.url),'utf8');
  // PGlite has gen_random_uuid built in; legacy pgcrypto is not needed by this workflow.
  return db.exec(sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g,''));
};
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);`);
  for (const file of ['backend/sql/001_initial_schema.sql','backend/sql/003_users_and_admin.sql','backend/sql/004_supplier_notifications.sql',
    'supabase/migrations/005_order_workflow_functions.sql','supabase/migrations/006_admin_supplier_operations.sql',
    'supabase/migrations/007_secure_delivery_confirmation.sql','supabase/migrations/013_delivery_review_statuses.sql',
    'supabase/migrations/014_signed_delivery_review.sql']) await sqlFile(file);
  // Applying the new migration twice must be harmless.
  await sqlFile('supabase/migrations/014_signed_delivery_review.sql');
  await db.exec(`INSERT INTO users(email,full_name,password_hash,role) VALUES
    ('admin@example.test','مدير الاختبار','not-a-real-password','admin'),
    ('supplier@example.test','أحمد مندوب','not-a-real-password','supplier'),
    ('other@example.test','مندوب آخر','not-a-real-password','supplier');
    INSERT INTO suppliers(user_id,business_name) VALUES(2,'تلاجتى'),(3,'تلاجتى');
    INSERT INTO customers(full_name,phone_normalized,address) VALUES('متجر الاختبار','+201000000000','عنوان تجريبي');
    INSERT INTO products(sku,name_ar,unit_price,stock_quantity,reserved_quantity) VALUES('test-milk','حليب',20,10,2);
    INSERT INTO orders(public_id,order_number,customer_id,delivery_address,status,subtotal,total)
    VALUES('11111111-1111-4111-8111-111111111111','TEST-1',1,'عنوان تجريبي','out_for_delivery',40,40);
    INSERT INTO order_items(order_id,product_id,product_sku,product_name_ar,quantity,unit_price,line_total) VALUES(1,1,'test-milk','حليب',2,20,40);
    INSERT INTO order_supplier_assignments(order_id,supplier_id,is_primary) VALUES(1,1,true);
    INSERT INTO storage.objects(bucket_id,name) VALUES('delivery-proofs','11111111-1111-4111-8111-111111111111/2/photo.jpg');`);
  const id='11111111-1111-4111-8111-111111111111', path=id+'/2/photo.jpg';
  const submit=(user=2,file=path)=>db.query('SELECT submit_delivery_proof($1,$2,$3) result',[id,user,file]);
  const review=(proof,approve,user=1,note=null)=>db.query('SELECT review_delivery_proof($1,$2,$3,$4,$5,$6) result',[id,proof,user,approve,note,'admin@example.test']);
  await assert.rejects(submit(3));
  await assert.rejects(submit(2,id+'/2/missing.jpg'));
  const proof=(await submit()).rows[0].result.proof_id;
  assert.equal((await db.query('SELECT stock_quantity FROM products')).rows[0].stock_quantity,10);
  await assert.rejects(submit());
  await assert.rejects(review(proof,true,2));
  await assert.rejects(review(proof,false));
  await review(proof,false,1,'التوقيع غير واضح');
  assert.equal((await db.query('SELECT status FROM orders')).rows[0].status,'delivery_proof_rejected');
  await assert.rejects(review(proof,true));
  await db.exec(`INSERT INTO storage.objects(bucket_id,name) VALUES('delivery-proofs','${id}/2/new.jpg');`);
  const next=(await submit(2,id+'/2/new.jpg')).rows[0].result.proof_id;
  await db.exec('UPDATE products SET stock_quantity=0');
  await assert.rejects(review(next,true));
  assert.equal((await db.query('SELECT status FROM orders')).rows[0].status,'pending_delivery_review');
  assert.equal((await db.query('SELECT count(*)::int n FROM inventory_movements')).rows[0].n,0);
  await db.exec('UPDATE products SET stock_quantity=10');
  await review(next,true);
  const repeat=(await review(next,true)).rows[0].result;
  assert.equal(repeat.already_reviewed,true);
  assert.equal((await db.query('SELECT stock_quantity FROM products')).rows[0].stock_quantity,8);
  assert.equal((await db.query('SELECT count(*)::int n FROM inventory_movements')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM email_outbox')).rows[0].n,1);
  assert.equal((await db.query('SELECT status FROM orders')).rows[0].status,'completed');
  await assert.rejects(db.query('SELECT confirm_order_delivery($1,$2,$3,$4)',[id,'old-qr',2,'admin@example.test']));
  await assert.rejects(db.query('SELECT create_delivery_confirmation_token($1,$2)',[id,'old-qr']));
  await assert.rejects(db.query("SELECT transition_order_status($1,'completed',null)",[id]));
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT * FROM delivery_proofs'));
  await assert.rejects(submit());
  await assert.rejects(review(next,true));
  await db.exec('RESET ROLE');
  console.log('PASS: migrations, private permissions, assigned supplier, rejection/resubmission, stock rollback, repeat approval, single report, disabled QR.');
} catch (error) { console.error('Database test failed:',error.message,error.detail || '',error.where || ''); process.exitCode=1; }
finally { await db.close(); }
