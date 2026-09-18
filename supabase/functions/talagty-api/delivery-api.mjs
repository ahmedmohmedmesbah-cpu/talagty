export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export function validateProof(bytes, type) {
  if (bytes.length < 12 || bytes.length > MAX_PROOF_BYTES) throw new Error('اختر صورة لا تتجاوز 5 ميجابايت');
  const png = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (!((type === 'image/png' && png) || (type === 'image/jpeg' && jpeg) || (type === 'image/webp' && webp))) throw new Error('اختر صورة JPG أو PNG أو WebP صحيحة');
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[type];
}

async function readUpload(request) {
  const limit = MAX_PROOF_BYTES + 65536;
  if (Number(request.headers.get('content-length')) > limit) throw new Error('الصورة أكبر من الحجم المسموح');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('صورة الفاتورة مطلوبة');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('الصورة أكبر من الحجم المسموح'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
  const form = await new Response(raw, { headers: { 'content-type': request.headers.get('content-type') || '' } }).formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw new Error('صورة الفاتورة مطلوبة');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, type: file.type, ext: validateProof(bytes, file.type) };
}

// Called only after verifying the role/device JWT. Recheck active account and order scope here.
export async function deliveryApi(request, orderId, db, actor, reportEmail) {
  const fail = (detail, status = 422) => ({ body: { detail }, status });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return fail('رقم الطلب غير صحيح');
  if (!actor || !['admin','supplier'].includes(actor.role)) return fail('غير مصرح',403);
  const { data: user, error: userError } = await db.from('users').select('id').eq('id',actor.sub).eq('role',actor.role).eq('is_active',true).maybeSingle();
  if (userError) return fail('تعذر التحقق من الحساب',503);
  if (!user) return fail('الحساب غير متاح',403);
  const { data: order, error } = await db.from('orders').select('id,status').eq('public_id',orderId).maybeSingle();
  if (error) return fail('تعذر تحميل الطلب',503);
  if (!order) return fail('الطلب غير موجود',404);
  if (actor.role === 'supplier') {
    const { data: supplier, error: supplierError } = await db.from('suppliers').select('id').eq('user_id',actor.sub).eq('is_available',true).maybeSingle();
    if (supplierError || !supplier) return fail('حساب المندوب غير متاح',403);
    const { data: assignment, error: assignmentError } = await db.from('order_supplier_assignments').select('id').eq('order_id',order.id).eq('supplier_id',supplier.id).maybeSingle();
    if (assignmentError || !assignment) return fail('الطلب غير مسند إليك',403);
  }
  const bucket = db.storage.from('delivery-proofs');
  if (request.method === 'GET') {
    const { data, error } = await db.from('delivery_proofs').select('id,status,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note,storage_path').eq('order_id',order.id).order('submitted_at',{ascending:false});
    if (error) return fail('تعذر تحميل إثباتات التسليم. تحقق من ترقية قاعدة البيانات.',503);
    const proofs = [];
    for (const proof of data || []) {
      const { data: signed, error } = await bucket.createSignedUrl(proof.storage_path,300);
      if (error) return fail('تعذر عرض صورة الفاتورة',503);
      const { storage_path, ...safe } = proof;
      proofs.push({ ...safe, image_url: signed.signedUrl });
    }
    return { body: proofs, status:200 };
  }
  if (request.method === 'POST' && actor.role === 'supplier') {
    if (!['out_for_delivery','delivery_proof_rejected'].includes(order.status)) return fail('لا يمكن رفع إثبات في حالة الطلب الحالية',409);
    let image;
    try { image = await readUpload(request); } catch (error) { return fail(error.message); }
    const path = `${orderId}/${actor.sub}/${crypto.randomUUID()}.${image.ext}`;
    const { error: uploadError } = await bucket.upload(path,image.bytes,{contentType:image.type,upsert:false,cacheControl:'0'});
    if (uploadError) return fail('تعذر رفع الصورة. تحقق من الاتصال وحاول مجدداً.',503);
    const { data, error: submitError } = await db.rpc('submit_delivery_proof',{p_order_public_id:orderId,p_actor:actor.sub,p_path:path});
    // Do not delete on an ambiguous database/network error: the transaction may have committed.
    if (submitError) return fail(submitError.message,409);
    return { body:data,status:201 };
  }
  if (request.method === 'PATCH' && actor.role === 'admin') {
    let body;
    try { body = await request.json(); } catch { return fail('بيانات المراجعة غير صحيحة'); }
    if (typeof body?.approve !== 'boolean' || !/^[0-9a-f-]{36}$/i.test(body.proof_id || '')) return fail('قرار المراجعة غير صحيح');
    if (typeof (body.note ?? '') !== 'string' || (body.note || '').length > 1000) return fail('ملاحظة المراجعة طويلة');
    const { data, error } = await db.rpc('review_delivery_proof',{p_order_public_id:orderId,p_proof_id:body.proof_id,p_actor:actor.sub,p_approve:body.approve,p_note:body.note || null,p_email:reportEmail});
    if (error) return fail(error.message,409);
    return { body:data,status:200 };
  }
  return fail('الطريقة غير مسموحة',405);
}
