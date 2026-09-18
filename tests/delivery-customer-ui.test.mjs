import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../track.js',import.meta.url),'utf8');
async function render(status) {
  const nodes = new Map(), listeners={};
  const node=id=>{
    if (!nodes.has(id)) nodes.set(id,{innerHTML:'',textContent:'',hidden:false,value:'',dataset:{},classList:{toggle(){}},addEventListener(){}});
    return nodes.get(id);
  };
  const steps=['pending_assignment','approved','assigned','preparing','out_for_delivery','pending_delivery_review',status];
  const order={order_id:'order1',order_number:'TEST-1',status,customer_name:'عميل تجريبي',customer_phone:'01000000000',customer_address_text:'عنوان تجريبي',total:40,amount_paid:40,completed_at:'2026-09-18T10:00:00Z',created_at:'2026-09-17T10:00:00Z',items:[{name:'حليب',quantity:2,unit_price:20,line_total:40}],timeline:steps.map((status,i)=>({status,created_at:`2026-09-18T0${i}:00:00Z`}))};
  const storage=new Map([['talagtyCustomerToken','local-test-token']]);
  const context={document:{getElementById:node,addEventListener:(type,listener)=>listeners[type]=listener},
    window:{TALLAGTY_API_BASE_URL:'https://example.test',addEventListener(){},print(){}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    crypto:globalThis.crypto,navigator:{onLine:true},Intl,Date,URLSearchParams,setTimeout(){},
    fetch:async()=>({ok:true,json:async()=>[order]})};
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,click:listeners.click};
}
test('customer sees full status history but no final invoice while review is pending',async()=>{
  const {nodes}=await render('pending_delivery_review'),html=nodes.get('track-list').innerHTML;
  assert.ok(html.includes('بانتظار تأكيد التسليم'));
  assert.ok(html.includes('بانتظار مراجعة الإدارة'));
  assert.ok(html.includes('قيد التجهيز'));
  assert.ok(!html.includes('data-invoice'));
  assert.ok(!html.includes('data-receive'));
  assert.ok(!html.includes('data-cancel'));
});
test('completed order exposes final invoice and opens printable details',async()=>{
  const {nodes,click}=await render('completed');
  assert.ok(nodes.get('track-list').innerHTML.includes('data-invoice'));
  await click({target:{closest:selector=>selector==='[data-invoice]'?{dataset:{invoice:'order1'}}:null}});
  assert.equal(nodes.get('receipt-modal').hidden,false);
  assert.ok(nodes.get('final-invoice').innerHTML.includes('فاتورة نهائية'));
  assert.ok(nodes.get('final-invoice').innerHTML.includes('حليب'));
});
test('correction is visible but never offers cancel or final invoice',async()=>{
  const {nodes}=await render('delivery_proof_rejected'),html=nodes.get('track-list').innerHTML;
  assert.ok(html.includes('إثبات التسليم قيد التصحيح'));
  assert.ok(!html.includes('data-invoice')); assert.ok(!html.includes('data-cancel'));
});
