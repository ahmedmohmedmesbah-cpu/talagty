import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import bcrypt from 'npm:bcryptjs@2.4.3'

const projectUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const jwtSecret = Deno.env.get('ADMIN_JWT_SECRET')!
const bootstrapEmail = Deno.env.get('BOOTSTRAP_ADMIN_EMAIL')!
const bootstrapPassword = Deno.env.get('BOOTSTRAP_ADMIN_PASSWORD')!
const adminReportEmail = Deno.env.get('ADMIN_REPORT_EMAIL') || bootstrapEmail
const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
const reportFromEmail = Deno.env.get('REPORT_FROM_EMAIL') || 'Tallagty <onboarding@resend.dev>'
const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } })
const allowedOrigins = new Set(['https://ahmedmohmedmesbah-cpu.github.io', 'http://127.0.0.1:8040', 'http://localhost:8040'])

type Role = 'admin' | 'supplier'
type TokenClaims = { sub: number; role: Role; exp: number; device?: string }

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || ''
  const allowedOrigin = allowedOrigins.has(origin) ? origin : 'https://ahmedmohmedmesbah-cpu.github.io'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-device-id',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  }
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) })
}

function apiError(request: Request, message: string, status = 400, extras: Record<string, unknown> = {}) {
  return response(request, { detail: message, ...extras }, status)
}

function normalizePhone(value: unknown) {
  let phone = String(value ?? '').trim().replace(/[^0-9+]/g, '')
  if (phone.startsWith('00')) phone = '+' + phone.slice(2)
  return phone
}

function normalizeDriveUrl(value: unknown) {
  const url = String(value ?? '').trim()
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/)
  return match ? 'https://drive.google.com/uc?export=view&id=' + match[1] : (url || null)
}

function validateProductInput(body: any) {
  const sku = String(body.sku ?? '').trim()
  const name = String(body.name_ar ?? '').trim()
  const price = Number(body.unit_price)
  const saleType = String(body.sale_type || 'none')
  const saleValue = Number(body.sale_value || 0)
  const saleStart = body.sale_start ? new Date(body.sale_start) : null
  const saleEnd = body.sale_end ? new Date(body.sale_end) : null
  if (!sku || sku.length > 32 || /[\u0000-\u001f]/.test(sku)) return 'كود المنتج غير صحيح'
  if (name.length < 2) return 'اسم المنتج يجب ألا يقل عن حرفين'
  if (!Number.isFinite(price) || price <= 0) return 'السعر الأساسي يجب أن يكون أكبر من صفر'
  if (!['none', 'percentage', 'fixed'].includes(saleType)) return 'نوع العرض غير صحيح'
  if (saleType === 'percentage' && (!Number.isFinite(saleValue) || saleValue <= 0 || saleValue > 100)) return 'نسبة الخصم يجب أن تكون بين 1 و100%'
  if (saleType === 'fixed' && (!Number.isFinite(saleValue) || saleValue <= 0 || saleValue >= price)) return 'السعر المخفض يجب أن يكون أقل من السعر الأساسي'
  if (saleStart && Number.isNaN(saleStart.getTime())) return 'تاريخ بداية العرض غير صحيح'
  if (saleEnd && Number.isNaN(saleEnd.getTime())) return 'تاريخ نهاية العرض غير صحيح'
  if (saleStart && saleEnd && saleEnd <= saleStart) return 'نهاية العرض يجب أن تكون بعد بدايته'
  const stock = Number(body.stock_quantity ?? 0)
  const threshold = Number(body.low_stock_threshold ?? 0)
  if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(threshold) || threshold < 0) return 'كميات المخزون يجب أن تكون أرقاماً صحيحة غير سالبة'
  return null
}

function categoryRow(body: any) {
  const requestedSlug = String(body.slug ?? '').trim().toLowerCase()
  return {
    slug: requestedSlug || `category-${crypto.randomUUID().slice(0, 8)}`,
    name_ar: String(body.name_ar ?? '').trim(),
    description_ar: String(body.description_ar ?? '').trim() || null,
    image_url: normalizeDriveUrl(body.image_url),
    sort_order: Number(body.sort_order ?? 0),
    is_active: body.is_active !== false,
  }
}

function validateCategoryInput(row: ReturnType<typeof categoryRow>) {
  if (row.name_ar.length < 2 || row.name_ar.length > 150) return 'اسم الفئة يجب أن يكون بين حرفين و150 حرفاً'
  if (!/^[a-z0-9-]+$/.test(row.slug) || row.slug.length > 80) return 'الرابط المختصر يقبل حروفاً إنجليزية صغيرة وأرقاماً وشرطة (-) فقط'
  if (!Number.isInteger(row.sort_order) || row.sort_order < 0) return 'ترتيب الظهور يجب أن يكون رقماً صحيحاً يبدأ من صفر'
  return null
}

function base64Url(bytes: Uint8Array) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function bytesFromBase64Url(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0))
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function jwtSignature(value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}

async function issueToken(userId: number, role: Role, device?: string) {
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ sub: userId, role, device, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })))
  return header + '.' + payload + '.' + await jwtSignature(header + '.' + payload)
}

async function requireRole(request: Request, role: Role): Promise<TokenClaims | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null
  const expected = await jwtSignature(header + '.' + payload)
  const receivedBytes = bytesFromBase64Url(signature)
  const expectedBytes = bytesFromBase64Url(expected)
  if (receivedBytes.length !== expectedBytes.length) return null
  let mismatch = 0
  for (let index = 0; index < receivedBytes.length; index++) mismatch |= receivedBytes[index] ^ expectedBytes[index]
  if (mismatch !== 0) return null
  try {
    const claims = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(payload))) as TokenClaims
    return claims.role === role && claims.exp > Math.floor(Date.now() / 1000) ? claims : null
  } catch {
    return null
  }
}

async function requireSupplier(request: Request) {
  const claims = await requireRole(request, 'supplier')
  if (!claims) return null
  const deviceId = request.headers.get('x-device-id') || ''
  if (!deviceId || claims.device !== await sha256(deviceId)) return null
  const { data: user } = await admin.from('users').select('device_id_hash,is_active').eq('id', claims.sub).maybeSingle()
  if (!user?.is_active || user.device_id_hash !== claims.device) return null
  return claims
}

async function ensureBootstrapAdmin() {
  const email = bootstrapEmail.trim().toLowerCase()
  const { data } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (!data) {
    const passwordHash = await bcrypt.hash(bootstrapPassword, 12)
    const { error } = await admin.from('users').insert({ email, full_name: 'مدير تلاجتى', password_hash: passwordHash, role: 'admin', is_active: true })
    if (error) throw new Error('تعذر إنشاء حساب الإدارة الأول')
  }
}

function relationOne(value: any) {
  return Array.isArray(value) ? value[0] : value
}

function databaseMessage(error: any, entity: 'product' | 'supplier' | 'category') {
  const code = String(error?.code || '')
  const details = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  if (code === '23505') {
    if (details.includes('products_sku')) return 'كود المنتج مستخدم بالفعل. اترك خانة الكود فارغة لإنشاء كود تلقائي.'
    if (details.includes('phone_normalized')) return 'رقم الهاتف مرتبط بحساب موجود بالفعل.'
    if (details.includes('national_id')) return 'الرقم القومي مرتبط بمندوب موجود بالفعل.'
    if (details.includes('email')) return 'البريد الإلكتروني مرتبط بحساب موجود بالفعل.'
    if (entity === 'category') return 'الرابط المختصر مستخدم لفئة أخرى. اتركه فارغاً لإنشاء رابط تلقائي.'
    return entity === 'product' ? 'هذا المنتج موجود بالفعل.' : 'بيانات هذا المندوب مستخدمة في حساب موجود.'
  }
  if (code === '23514') return entity === 'product' ? 'بيانات السعر أو العرض أو المخزون غير صحيحة.' : entity === 'category' ? 'بيانات الفئة غير صحيحة.' : 'بيانات المندوب غير مكتملة.'
  return entity === 'product' ? 'تعذر حفظ المنتج. راجع البيانات وحاول مرة أخرى.' : entity === 'category' ? 'تعذر حفظ الفئة. راجع البيانات وحاول مرة أخرى.' : 'تعذر إنشاء حساب المندوب. راجع البيانات وحاول مرة أخرى.'
}

function htmlEscape(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character))
}

function effectivePrice(product: any) {
  const now = Date.now()
  const inPeriod = (!product.sale_start || new Date(product.sale_start).getTime() <= now) && (!product.sale_end || new Date(product.sale_end).getTime() >= now)
  if (!inPeriod) return Number(product.unit_price)
  if (product.sale_type === 'percentage') return Math.max(0, Number(product.unit_price) * (1 - Number(product.sale_value) / 100))
  if (product.sale_type === 'fixed') return Math.max(0, Number(product.sale_value))
  return Number(product.unit_price)
}

function mapProduct(product: any) {
  const category = relationOne(product.categories)
  return {
    id: product.id, sku: product.sku, name_ar: product.name_ar, description_ar: product.description_ar,
    unit_price: Number(product.unit_price), effective_price: effectivePrice(product), image_url: product.image_url,
    category_id: product.category_id, category_name: category?.name_ar ?? null, category_slug: category?.slug ?? null,
    sale_type: product.sale_type, sale_value: Number(product.sale_value || 0), sale_start: product.sale_start, sale_end: product.sale_end,
    stock_quantity: product.stock_quantity, reserved_quantity: product.reserved_quantity || 0, available_stock: Math.max(0, Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0)), low_stock_threshold: product.low_stock_threshold, stock_updated_at: product.stock_updated_at,
    is_active: product.is_active, created_at: product.created_at, updated_at: product.updated_at,
  }
}

function mapOrder(order: any) {
  const customer = relationOne(order.customers)
  const legacySupplier = relationOne(order.suppliers)
  const supplierUser = relationOne(legacySupplier?.users)
  const assignments = (order.order_supplier_assignments ?? []).map((assignment: any) => {
    const supplier = relationOne(assignment.suppliers)
    const user = relationOne(supplier?.users)
    return { assignment_id: assignment.id, supplier_id: supplier?.id, supplier_name: user?.full_name, is_primary: assignment.is_primary }
  })
  return {
    database_id: order.id, order_id: order.public_id, order_number: order.order_number,
    customer_name: customer?.full_name, customer_phone: customer?.phone_normalized, customer_address_text: order.delivery_address,
    admin_note: order.admin_note, status: order.status, subtotal: Number(order.subtotal), delivery_fee: Number(order.delivery_fee || 0),
    total: Number(order.total), payment_method: order.payment_method, amount_paid: Number(order.amount_paid || 0), currency: order.currency || 'EGP',
    created_at: order.created_at, updated_at: order.updated_at, approved_at: order.approved_at, completed_at: order.completed_at,
    assigned_supplier_name: assignments[0]?.supplier_name ?? supplierUser?.full_name ?? null, assignments,
    items: (order.order_items ?? []).map((item: any) => ({ item_id: item.id, product_id: item.product_sku, name: item.product_name_ar, quantity: item.quantity, unit_price: Number(item.unit_price), line_total: Number(item.line_total) })),
    timeline: (order.order_status_history ?? []).map((entry: any) => ({ status: entry.new_status, previous_status: entry.previous_status, note: entry.note, created_at: entry.created_at })),
  }
}

const orderSelect = 'id,public_id,order_number,delivery_address,admin_note,status,subtotal,delivery_fee,total,payment_method,amount_paid,currency,created_at,updated_at,approved_at,completed_at,customers(full_name,phone_normalized),order_items(id,product_sku,product_name_ar,quantity,unit_price,line_total),suppliers(id,users(full_name)),order_supplier_assignments(id,is_primary,suppliers(id,users(full_name))),order_status_history(previous_status,new_status,note,created_at)'

async function getOrders(phone?: string, supplierUserId?: number) {
  let orderIds: number[] | null = null
  if (supplierUserId) {
    const { data: supplier } = await admin.from('suppliers').select('id').eq('user_id', supplierUserId).maybeSingle()
    if (!supplier) throw new Error('حساب المورد غير مكتمل')
    const { data: assignments, error } = await admin.from('order_supplier_assignments').select('order_id').eq('supplier_id', supplier.id)
    if (error) throw error
    orderIds = (assignments ?? []).map(item => item.order_id)
    if (!orderIds.length) return []
  }
  let query = admin.from('orders').select(orderSelect).order('created_at', { ascending: false })
  if (phone) {
    const { data: customer } = await admin.from('customers').select('id').eq('phone_normalized', normalizePhone(phone)).maybeSingle()
    if (!customer) return []
    query = query.eq('customer_id', customer.id)
  }
  if (orderIds) query = query.in('id', orderIds)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapOrder)
}

async function listProducts(includeInactive = false) {
  let query = admin.from('products').select('id,sku,name_ar,description_ar,unit_price,image_url,category_id,sale_type,sale_value,sale_start,sale_end,stock_quantity,reserved_quantity,low_stock_threshold,stock_updated_at,is_active,created_at,updated_at,categories(name_ar,slug)').order('created_at')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapProduct)
}

async function listCategories(includeInactive = false) {
  let query = admin.from('categories').select('*').order('sort_order').order('name_ar')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function sendCompletionReport(orderPublicId: string) {
  if (!resendApiKey) return
  const { data } = await admin.from('orders').select(orderSelect).eq('public_id', orderPublicId).maybeSingle()
  if (!data) return
  const order = mapOrder(data)
  const itemRows = order.items.map((item: any) => '<tr><td>' + htmlEscape(item.name) + '</td><td>' + item.quantity + '</td><td>' + item.unit_price + '</td><td>' + item.line_total + '</td></tr>').join('')
  const timelineRows = order.timeline.map((item: any) => '<li><strong>' + htmlEscape(item.status) + '</strong> — ' + htmlEscape(item.created_at) + (item.note ? ' — ' + htmlEscape(item.note) : '') + '</li>').join('')
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif"><h1>تقرير إتمام الطلب ' + htmlEscape(order.order_number) + '</h1><p><strong>العميل:</strong> ' + htmlEscape(order.customer_name) + ' — ' + htmlEscape(order.customer_phone) + '</p><p><strong>العنوان:</strong> ' + htmlEscape(order.customer_address_text) + '</p><p><strong>المورد:</strong> ' + htmlEscape(order.assigned_supplier_name) + '</p><table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>' + itemRows + '</tbody></table><h2>الإجمالي: ' + order.total + ' ' + htmlEscape(order.currency) + '</h2><h3>سجل التوقيتات</h3><ol>' + timelineRows + '</ol></div>'
  const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + resendApiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: reportFromEmail, to: [adminReportEmail], subject: 'تقرير إتمام الطلب ' + order.order_number, html }) })
  if (!sent.ok) {
    const message = await sent.text()
    await admin.from('email_outbox').update({ status: 'failed', attempts: 1, last_error: message }).eq('subject', 'تقرير إتمام الطلب ' + order.order_number).eq('status', 'pending')
    return
  }
  await admin.from('email_outbox').update({ status: 'sent', attempts: 1, sent_at: new Date().toISOString() }).eq('subject', 'تقرير إتمام الطلب ' + order.order_number).eq('status', 'pending')
}

async function parseBody(request: Request) {
  try { return await request.json() } catch { throw new Error('صيغة البيانات غير صحيحة') }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  const url = new URL(request.url)
  const route = url.pathname.replace(/^\/(?:functions\/v1\/)?talagty-api(?=\/|$)/, '') || '/'
  try {
    if (request.method === 'GET' && route === '/health') return response(request, { status: 'ok', version: '2.0' })
    if (request.method === 'GET' && route === '/api/catalog') return response(request, { categories: await listCategories(), products: await listProducts() })

    if (request.method === 'POST' && route === '/api/orders') {
      const body = await parseBody(request)
      const { data, error } = await admin.rpc('create_customer_order', { p_name: body.customer_name, p_phone: body.customer_phone, p_address: body.customer_address_text, p_items: body.items })
      if (error) return apiError(request, error.message, 422)
      const order = Array.isArray(data) ? data[0] : data
      return response(request, { order_id: order.order_id, order_number: order.order_number, status: order.status, total: order.total }, 201)
    }
    if (request.method === 'GET' && route === '/api/orders') return response(request, await getOrders(url.searchParams.get('phone') ?? undefined))
    const deliveryTokenMatch = route.match(/^\/api\/orders\/([^/]+)\/delivery-token$/)
    if (request.method === 'POST' && deliveryTokenMatch) {
      const body = await parseBody(request)
      const phone = normalizePhone(body.phone)
      const { data: order } = await admin.from('orders').select('id,status,customers(phone_normalized)').eq('public_id', deliveryTokenMatch[1]).maybeSingle()
      const customer = relationOne(order?.customers)
      if (!order || customer?.phone_normalized !== phone) return apiError(request, 'بيانات الطلب غير صحيحة', 404)
      if (order.status !== 'out_for_delivery') return apiError(request, 'رمز الاستلام يظهر بعد خروج الطلب للتوصيل', 422)
      const randomBytes = crypto.getRandomValues(new Uint8Array(32))
      const qrToken = base64Url(randomBytes)
      const manualCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0')
      const first = await admin.rpc('create_delivery_confirmation_token', { p_order_public_id: deliveryTokenMatch[1], p_token_hash: await sha256(qrToken), p_valid_minutes: 5 })
      if (first.error) return apiError(request, first.error.message, 422)
      const second = await admin.from('delivery_confirmation_tokens').insert({ order_id: order.id, token_hash: await sha256(manualCode), expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
      if (second.error) throw second.error
      return response(request, { qr_payload: 'talagty:' + deliveryTokenMatch[1] + ':' + qrToken, manual_code: manualCode, expires_in_seconds: 300 })
    }

    if (request.method === 'POST' && route === '/api/auth/activate') {
      const body = await parseBody(request)
      const phone = normalizePhone(body.phone)
      const deviceId = String(body.device_id ?? '')
      if (!deviceId || deviceId.length < 16) return apiError(request, 'تعذر التحقق من الهاتف', 422)
      const { data: user } = await admin.from('users').select('id,password_hash,activation_code_hash,activation_expires_at,role,is_active').eq('phone_normalized', phone).eq('role', 'supplier').maybeSingle()
      const codeHash = await sha256(String(body.code ?? ''))
      if (!user || !user.is_active || !(await bcrypt.compare(String(body.password ?? ''), user.password_hash)) || user.activation_code_hash !== codeHash || !user.activation_expires_at || new Date(user.activation_expires_at) < new Date()) return apiError(request, 'رمز التفعيل أو بيانات الحساب غير صحيحة', 401)
      const deviceHash = await sha256(deviceId)
      const { error } = await admin.from('users').update({ phone_verified_at: new Date().toISOString(), device_id_hash: deviceHash, device_activated_at: new Date().toISOString(), activation_code_hash: null, activation_expires_at: null, last_login_at: new Date().toISOString() }).eq('id', user.id)
      if (error) throw error
      return response(request, { access_token: await issueToken(user.id, 'supplier', deviceHash), token_type: 'bearer', role: 'supplier' })
    }

    if (request.method === 'POST' && route === '/api/auth/login') {
      await ensureBootstrapAdmin()
      const body = await parseBody(request)
      const identity = String(body.email || body.phone || body.identity || '').trim()
      let query = admin.from('users').select('id,password_hash,role,is_active,phone_verified_at,device_id_hash')
      query = identity.includes('@') ? query.eq('email', identity.toLowerCase()) : query.eq('phone_normalized', normalizePhone(identity))
      const { data: user } = await query.maybeSingle()
      if (!user || !user.is_active || !(await bcrypt.compare(String(body.password ?? ''), user.password_hash))) return apiError(request, 'بيانات الدخول غير صحيحة', 401)
      if (user.role === 'supplier') {
        if (!user.phone_verified_at || !user.device_id_hash) return apiError(request, 'يجب تفعيل الحساب أولاً', 403, { activation_required: true })
        const deviceHash = await sha256(String(body.device_id ?? ''))
        if (deviceHash !== user.device_id_hash) return apiError(request, 'هذا الحساب مرتبط بهاتف آخر. تواصل مع الإدارة.', 403, { device_mismatch: true })
        await admin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
        return response(request, { access_token: await issueToken(user.id, 'supplier', deviceHash), token_type: 'bearer', role: 'supplier' })
      }
      await admin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
      return response(request, { access_token: await issueToken(user.id, 'admin'), token_type: 'bearer', role: 'admin' })
    }

    if (route.startsWith('/api/admin/')) {
      const claims = await requireRole(request, 'admin')
      if (!claims) return apiError(request, 'يلزم تسجيل الدخول كمدير', 401)

      if (request.method === 'GET' && route === '/api/admin/orders') return response(request, await getOrders())
      const reviewMatch = route.match(/^\/api\/admin\/orders\/([^/]+)\/review$/)
      if (request.method === 'PATCH' && reviewMatch) {
        const body = await parseBody(request)
        const { data, error } = await admin.rpc('admin_review_order', { p_order_public_id: reviewMatch[1], p_decision: body.decision, p_customer_name: body.customer_name, p_customer_phone: body.customer_phone, p_customer_address: body.customer_address_text, p_admin_note: body.admin_note ?? null, p_items: body.items, p_actor_user_id: claims.sub })
        if (error) return apiError(request, error.message, 422)
        return response(request, data)
      }
      const assignmentMatch = route.match(/^\/api\/admin\/orders\/([^/]+)\/assignment$/)
      if (request.method === 'PATCH' && assignmentMatch) {
        const body = await parseBody(request)
        const assignments = body.assignments ?? [{ supplier_id: body.supplier_id, items: [] }]
        const { data, error } = await admin.rpc('assign_order_suppliers', { p_order_public_id: assignmentMatch[1], p_assignments: assignments, p_actor_user_id: claims.sub })
        if (error) return apiError(request, error.message, 422)
        return response(request, data)
      }

      if (request.method === 'GET' && route === '/api/admin/categories') return response(request, await listCategories(true))
      if (request.method === 'POST' && route === '/api/admin/categories') {
        const body = await parseBody(request)
        const row = categoryRow(body)
        const validationError = validateCategoryInput(row)
        if (validationError) return apiError(request, validationError, 422)
        const { data, error } = await admin.from('categories').insert(row).select().single()
        if (error) return apiError(request, databaseMessage(error, 'category'), 422)
        return response(request, data, 201)
      }
      const categoryMatch = route.match(/^\/api\/admin\/categories\/(\d+)$/)
      if (request.method === 'PATCH' && categoryMatch) {
        const body = await parseBody(request)
        const row = categoryRow(body)
        const validationError = validateCategoryInput(row)
        if (validationError) return apiError(request, validationError, 422)
        const { data, error } = await admin.from('categories').update({ ...row, updated_at: new Date().toISOString() }).eq('id', Number(categoryMatch[1])).select().single()
        if (error) return apiError(request, databaseMessage(error, 'category'), 422)
        return response(request, data)
      }

      if (request.method === 'GET' && route === '/api/admin/products') return response(request, await listProducts(true))
      if (request.method === 'POST' && route === '/api/admin/products') {
        const body = await parseBody(request)
        const validationError = validateProductInput(body)
        if (validationError) return apiError(request, validationError, 422)
        const row = { sku: String(body.sku ?? '').trim(), name_ar: String(body.name_ar ?? '').trim(), description_ar: String(body.description_ar ?? '').trim() || null, category_id: body.category_id || null, unit_price: Number(body.unit_price), image_url: normalizeDriveUrl(body.image_url), sale_type: body.sale_type || 'none', sale_value: Number(body.sale_value || 0), sale_start: body.sale_start || null, sale_end: body.sale_end || null, stock_quantity: Number(body.stock_quantity || 0), low_stock_threshold: Number(body.low_stock_threshold || 0), is_active: body.is_active !== false }
        const { data, error } = await admin.from('products').insert(row).select().single()
        if (error) return apiError(request, databaseMessage(error, 'product'), 422)
        if (row.stock_quantity > 0) await admin.from('inventory_movements').insert({ product_id: data.id, movement_type: 'purchase', quantity_delta: row.stock_quantity, balance_after: row.stock_quantity, note: 'رصيد افتتاحي', created_by: claims.sub })
        return response(request, data, 201)
      }
      const productMatch = route.match(/^\/api\/admin\/products\/(\d+)$/)
      if (request.method === 'PATCH' && productMatch) {
        const body = await parseBody(request)
        const validationError = validateProductInput(body)
        if (validationError) return apiError(request, validationError, 422)
        const productId = Number(productMatch[1])
        const { data: currentProduct } = await admin.from('products').select('stock_quantity').eq('id', productId).maybeSingle()
        if (!currentProduct) return apiError(request, 'المنتج غير موجود', 404)
        const updates = { sku: String(body.sku ?? '').trim(), name_ar: String(body.name_ar ?? '').trim(), description_ar: String(body.description_ar ?? '').trim() || null, category_id: body.category_id || null, unit_price: Number(body.unit_price), image_url: normalizeDriveUrl(body.image_url), sale_type: body.sale_type || 'none', sale_value: Number(body.sale_value || 0), sale_start: body.sale_start || null, sale_end: body.sale_end || null, low_stock_threshold: Number(body.low_stock_threshold || 0), is_active: body.is_active !== false, updated_at: new Date().toISOString() }
        const desiredStock = Number(body.stock_quantity ?? currentProduct.stock_quantity)
        const stockDelta = desiredStock - Number(currentProduct.stock_quantity)
        if (stockDelta !== 0) {
          const movement = await admin.rpc('apply_inventory_movement', { p_product_id: productId, p_movement_type: stockDelta > 0 ? 'adjustment_add' : 'adjustment_remove', p_quantity: Math.abs(stockDelta), p_note: 'تعديل من شاشة المنتج', p_actor_user_id: claims.sub })
          if (movement.error) return apiError(request, movement.error.message, 422)
        }
        const { data, error } = await admin.from('products').update(updates).eq('id', productId).select().single()
        if (error) return apiError(request, error.message, 422)
        return response(request, data)
      }

      if (request.method === 'POST' && route === '/api/admin/inventory/movements') {
        const body = await parseBody(request)
        const { data, error } = await admin.rpc('apply_inventory_movement', { p_product_id: body.product_id, p_movement_type: body.movement_type, p_quantity: body.quantity, p_note: body.note ?? null, p_actor_user_id: claims.sub })
        if (error) return apiError(request, error.message, 422)
        return response(request, data, 201)
      }

      if (request.method === 'GET' && route === '/api/admin/suppliers') {
        const { data, error } = await admin.from('suppliers').select('id,business_name,national_id,vehicle_details,is_available,users(full_name,email,phone_normalized,phone_verified_at)').order('id')
        if (error) throw error
        return response(request, (data ?? []).map((supplier: any) => { const user = relationOne(supplier.users); return { supplier_id: supplier.id, business_name: supplier.business_name, full_name: user?.full_name, email: user?.email, phone: user?.phone_normalized, national_id: supplier.national_id, vehicle_details: supplier.vehicle_details, is_available: supplier.is_available, is_activated: Boolean(user?.phone_verified_at) } }))
      }
      if (request.method === 'POST' && route === '/api/admin/suppliers') {
        const body = await parseBody(request)
        const phone = normalizePhone(body.phone)
        const fullName = String(body.full_name ?? '').trim()
        const nationalId = String(body.national_id ?? '').trim()
        const vehicleDetails = String(body.vehicle_details ?? '').trim()
        const email = String(body.email ?? '').trim().toLowerCase()
        if (fullName.length < 2) return apiError(request, 'الاسم الكامل غير صحيح', 422)
        if (!/^\+?[0-9]{7,15}$/.test(phone)) return apiError(request, 'رقم الهاتف غير صحيح', 422)
        if (String(body.password ?? '').length < 8) return apiError(request, 'كلمة المرور يجب ألا تقل عن 8 أحرف', 422)
        if (!nationalId || !vehicleDetails) return apiError(request, 'الرقم القومي وبيانات المركبة مطلوبان', 422)
        const { data: phoneOwner } = await admin.from('users').select('id').eq('phone_normalized', phone).maybeSingle()
        if (phoneOwner) return apiError(request, 'رقم الهاتف مرتبط بحساب موجود بالفعل', 409)
        if (email) {
          const { data: emailOwner } = await admin.from('users').select('id').eq('email', email).maybeSingle()
          if (emailOwner) return apiError(request, 'البريد الإلكتروني مرتبط بحساب موجود بالفعل', 409)
        }
        const { data: nationalIdOwner } = await admin.from('suppliers').select('id').eq('national_id', nationalId).maybeSingle()
        if (nationalIdOwner) return apiError(request, 'الرقم القومي مرتبط بمندوب موجود بالفعل', 409)
        const activationCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
        const passwordHash = await bcrypt.hash(String(body.password), 12)
        const { data: user, error: userError } = await admin.from('users').insert({ email: email || null, phone_normalized: phone, full_name: fullName, password_hash: passwordHash, role: 'supplier', is_active: true, activation_code_hash: await sha256(activationCode), activation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).select('id,full_name').single()
        if (userError) return apiError(request, databaseMessage(userError, 'supplier'), 422)
        const { data: supplier, error: supplierError } = await admin.from('suppliers').insert({ user_id: user.id, business_name: String(body.business_name || fullName).trim(), national_id: nationalId, vehicle_details: vehicleDetails, is_available: true }).select().single()
        if (supplierError) { await admin.from('users').delete().eq('id', user.id); return apiError(request, databaseMessage(supplierError, 'supplier'), 422) }
        return response(request, { supplier_id: supplier.id, full_name: user.full_name, activation_code: activationCode, activation_expires_in_hours: 24 }, 201)
      }
      const resetDeviceMatch = route.match(/^\/api\/admin\/suppliers\/(\d+)\/reset-device$/)
      if (request.method === 'POST' && resetDeviceMatch) {
        const { data: supplier } = await admin.from('suppliers').select('user_id').eq('id', Number(resetDeviceMatch[1])).maybeSingle()
        if (!supplier) return apiError(request, 'المورد غير موجود', 404)
        const activationCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
        const { error } = await admin.from('users').update({ phone_verified_at: null, device_id_hash: null, device_activated_at: null, activation_code_hash: await sha256(activationCode), activation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq('id', supplier.user_id)
        if (error) throw error
        return response(request, { activation_code: activationCode, activation_expires_in_hours: 24 })
      }
    }

    if (route.startsWith('/api/supplier/')) {
      const supplier = await requireSupplier(request)
      if (!supplier) return apiError(request, 'جلسة المورد غير صالحة لهذا الهاتف', 401)
      if (request.method === 'GET' && route === '/api/supplier/orders') return response(request, await getOrders(undefined, supplier.sub))
      if (request.method === 'GET' && route === '/api/supplier/notifications') {
        const { data: profile } = await admin.from('suppliers').select('id').eq('user_id', supplier.sub).single()
        const { data, error } = await admin.from('supplier_notifications').select('id,message_ar,is_read,created_at,orders(public_id,order_number)').eq('supplier_id', profile.id).order('created_at', { ascending: false }).limit(50)
        if (error) throw error
        return response(request, data ?? [])
      }
      const statusMatch = route.match(/^\/api\/supplier\/orders\/([^/]+)\/status$/)
      if (request.method === 'PATCH' && statusMatch) {
        const body = await parseBody(request)
        const { data, error } = await admin.rpc('supplier_transition_order', { p_order_public_id: statusMatch[1], p_new_status: body.status, p_supplier_user_id: supplier.sub, p_note: body.note ?? null })
        if (error) return apiError(request, error.message, 422)
        return response(request, data)
      }
      const deliveryMatch = route.match(/^\/api\/supplier\/orders\/([^/]+)\/delivery\/confirm$/)
      if (request.method === 'POST' && deliveryMatch) {
        const body = await parseBody(request)
        const rawToken = String(body.token ?? '')
        if (rawToken.length < 6) return apiError(request, 'رمز الاستلام غير صحيح', 422)
        const { data, error } = await admin.rpc('confirm_order_delivery', {
          p_order_public_id: deliveryMatch[1],
          p_token_hash: await sha256(rawToken),
          p_supplier_user_id: supplier.sub,
          p_report_email: adminReportEmail,
        })
        if (error) return apiError(request, error.message, 422)
        await sendCompletionReport(deliveryMatch[1])
        return response(request, data)
      }
    }

    return apiError(request, 'المسار غير موجود', 404)
  } catch (caught) {
    console.error(caught)
    return apiError(request, caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع في الخدمة', 500)
  }
})
