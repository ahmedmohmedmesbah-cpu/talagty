import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryApi, validateProof, MAX_PROOF_BYTES } from '../supabase/functions/talagty-api/delivery-api.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const actor = { sub: 2, role: 'supplier' };
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
function mock({ active=true, assigned=true, status='out_for_delivery', uploadError=false, rpcError=false }={}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const query = {
        select() {return this;}, eq() {return this;},
        async maybeSingle() {return {data: table==='users' ? (active?{id:2}:null) : table==='orders' ? {id:1,status} : table==='suppliers' ? {id:2} : assigned?{id:1}:null};},
        async order() {return {data:[{id:'proof',status:'pending',storage_path:'private/path',submitted_by:2}]};}
      }; return query;
    },
    storage:{from(bucket) { assert.equal(bucket,'delivery-proofs'); return {
      async upload(path,bytes,options) {calls.push(['upload',path,options]);return {error:uploadError?{message:'failed'}:null};},
      async createSignedUrl(path,ttl) {calls.push(['signed',path,ttl]);return {data:{signedUrl:'https://example.test/private?token=short-lived'}};}
    };}},
    async rpc(name,args) {calls.push(['rpc',name,args]);return {data:{status: name==='submit_delivery_proof'?'pending_delivery_review':'completed'},error:rpcError?{message:'transaction rejected'}:null};}
  };
}
function upload(bytes=png,type='image/png') {
  const form = new FormData(); form.append('image',new File([bytes],'invoice.png',{type}));
  return new Request('https://example.test',{method:'POST',body:form});
}
test('proof validation rejects spoofed MIME, empty files and oversize images',()=>{
  assert.equal(validateProof(png,'image/png'),'png');
  assert.throws(()=>validateProof(png,'image/jpeg'));
  assert.throws(()=>validateProof(new Uint8Array(0),'image/png'));
  assert.throws(()=>validateProof(new Uint8Array(MAX_PROOF_BYTES+1),'image/png'));
  assert.throws(()=>validateProof(new TextEncoder().encode('<svg onload="alert(1)"></svg>'),'image/svg+xml'));
});
test('inactive users, customers and unrelated suppliers cannot access photos',async()=>{
  for (const [db,who] of [[mock({active:false}),actor],[mock({assigned:false}),actor],[mock(),{sub:3,role:'customer'}]]) {
    assert.equal((await deliveryApi(new Request('https://example.test'),id,db,who,'admin@example.test')).status,403);
    assert.equal(db.calls.length,0);
  }
});
test('valid upload has unique private key and submits for review, never completes',async()=>{
  const db=mock(); const result=await deliveryApi(upload(),id,db,actor,'admin@example.test');
  assert.equal(result.status,201); assert.equal(result.body.status,'pending_delivery_review');
  assert.match(db.calls[0][1],new RegExp('^'+id+'/2/[0-9a-f-]+\\.png$'));
  assert.equal(db.calls[0][2].upsert,false);
  assert.equal(db.calls[1][1],'submit_delivery_proof');
});
test('invalid status, bad file or failed storage upload never calls submit RPC',async()=>{
  for (const [db,req] of [[mock({status:'completed'}),upload()],[mock(),upload(png,'image/jpeg')],[mock({uploadError:true}),upload()]]) {
    assert.ok((await deliveryApi(req,id,db,actor,'admin@example.test')).status>=400);
    assert.ok(!db.calls.some(call=>call[0]==='rpc'));
  }
});
test('rejected proof can be resubmitted; pending duplicate gets a conflict',async()=>{
  assert.equal((await deliveryApi(upload(),id,mock({status:'delivery_proof_rejected'}),actor,'admin@example.test')).status,201);
  assert.equal((await deliveryApi(upload(),id,mock({status:'pending_delivery_review'}),actor,'admin@example.test')).status,409);
});
test('photo reads use short-lived signed URLs and hide storage paths',async()=>{
  const db=mock(); const result=await deliveryApi(new Request('https://example.test'),id,db,actor,'admin@example.test');
  assert.equal(result.status,200); assert.equal(result.body[0].storage_path,undefined); assert.equal(db.calls[0][2],300);
});
test('only admin can review and decision is strictly boolean',async()=>{
  const request=(approve)=>new Request('https://example.test',{method:'PATCH',body:JSON.stringify({proof_id:id,approve})});
  assert.equal((await deliveryApi(request(true),id,mock(),actor,'admin@example.test')).status,405);
  assert.equal((await deliveryApi(request('true'),id,mock(),{sub:1,role:'admin'},'admin@example.test')).status,422);
  const db=mock(); assert.equal((await deliveryApi(request(true),id,db,{sub:1,role:'admin'},'admin@example.test')).status,200);
  assert.equal(db.calls[0][1],'review_delivery_proof'); assert.equal(db.calls[0][2].p_actor,1);
});
