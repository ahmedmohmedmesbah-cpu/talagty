import { validateAppearance } from './appearance-config.mjs';

async function limitedBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('حجم البيانات أكبر من المسموح');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('البيانات مطلوبة');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('حجم البيانات أكبر من المسموح'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return data;
}

export async function appearanceApi(request, route, db, actorId = null) {
  const fail = (detail, status = 422) => ({ body: { detail }, status });
  const isPublic = route === '/api/storefront/appearance';
  if (isPublic && request.method !== 'GET') return fail('الطريقة غير مسموحة', 405);
  if (!isPublic) {
    if (!actorId) return fail('يلزم تسجيل الدخول كمدير', 401);
    const { data: actor, error } = await db.from('users').select('id').eq('id', actorId).eq('role', 'admin').eq('is_active', true).maybeSingle();
    if (error) return fail('تعذر التحقق من الحساب', 503);
    if (!actor) return fail('حساب الإدارة غير متاح', 403);
  }
  if (request.method === 'GET' && route !== '/api/admin/storefront-images') {
    const { data, error } = await db.from('storefront_appearance').select('settings,revision,updated_at').eq('id', 1).maybeSingle();
    if (error || !data) return fail('إعدادات المظهر غير جاهزة. يجب تطبيق ترقية قاعدة البيانات أولاً.', 503);
    return { body: { ...data, settings: validateAppearance(data.settings) }, status: 200 };
  }
  if (request.method === 'PATCH' && route === '/api/admin/storefront/appearance') {
    let body, settings;
    try {
      body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 32768)));
      if (!Number.isInteger(body?.revision) || body.revision < 0) throw new Error('أعد تحميل المظهر قبل الحفظ');
      settings = validateAppearance(body.settings);
    } catch (error) { return fail(error instanceof SyntaxError ? 'صيغة البيانات غير صحيحة' : error.message); }
    const { data, error } = await db.from('storefront_appearance')
      .update({ settings, revision: body.revision + 1, updated_at: new Date().toISOString(), updated_by: actorId })
      .eq('id', 1).eq('revision', body.revision).select('settings,revision,updated_at').maybeSingle();
    if (error) return fail('تعذر حفظ المظهر. تحقق من ترقية قاعدة البيانات وحاول مرة أخرى.', 503);
    if (!data) return fail('تم تعديل المظهر من جلسة أخرى. أعد تحميل النسخة المحفوظة ثم حاول مجدداً.', 409);
    return { body: data, status: 200 };
  }
  if (request.method === 'POST' && route === '/api/admin/storefront-images') {
    let file, bytes;
    try {
      const raw = await limitedBody(request, 6 * 1024 * 1024);
      const form = await new Response(raw, { headers: { 'content-type': request.headers.get('content-type') || '' } }).formData();
      file = form.get('image');
      if (!(file instanceof File) || file.size < 12 || file.size > 5 * 1024 * 1024) throw new Error('اختر صورة لا تتجاوز 5 ميجابايت');
      bytes = new Uint8Array(await file.arrayBuffer());
      const png = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
      if (!((file.type === 'image/png' && png) || (file.type === 'image/jpeg' && jpeg) || (file.type === 'image/webp' && webp))) throw new Error('اختر صورة JPG أو PNG أو WebP صحيحة');
    } catch (error) { return fail(error.message || 'تعذر قراءة الصورة'); }
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
    const path = `${actorId}/${crypto.randomUUID()}.${ext}`;
    const bucket = db.storage.from('storefront-images');
    const { error } = await bucket.upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '31536000' });
    if (error) return fail('تعذر رفع الصورة. تأكد من تجهيز مساحة صور المتجر.', 503);
    return { body: { url: bucket.getPublicUrl(path).data.publicUrl }, status: 201 };
  }
  return fail('الطريقة غير مسموحة', 405);
}
