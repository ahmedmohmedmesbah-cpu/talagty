import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import bcrypt from 'npm:bcryptjs@2.4.3'

const projectUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const jwtSecret = Deno.env.get('ADMIN_JWT_SECRET')!
const bootstrapEmail = Deno.env.get('BOOTSTRAP_ADMIN_EMAIL')!
const bootstrapPassword = Deno.env.get('BOOTSTRAP_ADMIN_PASSWORD')!
const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } })
const allowedOrigin = 'https://ahmedmohmedmesbah-cpu.github.io'

type Role = 'admin' | 'supplier'
type TokenClaims = { sub: number; role: Role; exp: number }

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin')
  return {
    'Access-Control-Allow-Origin': origin === allowedOrigin ? allowedOrigin : allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  }
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) })
}

function error(request: Request, message: string, status = 400) {
  return response(request, { detail: message }, status)
}

function base64Url(bytes: Uint8Array) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function bytesFromBase64Url(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const raw = atob(padded)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

async function jwtSignature(value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}

async function issueToken(userId: number, role: Role) {
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ sub: userId, role, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })))
  return `${header}.${payload}.${await jwtSignature(`${header}.${payload}`)}`
}

async function requireRole(request: Request, role: Role): Promise<TokenClaims | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null
  const expected = await jwtSignature(`${header}.${payload}`)
  const receivedBytes = bytesFromBase64Url(signature); const expectedBytes = bytesFromBase64Url(expected)
  if (receivedBytes.length !== expectedBytes.length) return null
  let mismatch = 0; for (let index = 0; index < receivedBytes.length; index++) mismatch |= receivedBytes[index] ^ expectedBytes[index]
  if (mismatch !== 0) return null
  try {
    const claims = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(payload))) as TokenClaims
    return claims.role === role && claims.exp > Math.floor(Date.now() / 1000) ? claims : null
  } catch { return null }
}

async function ensureBootstrapAdmin() {
  const email = bootstrapEmail.trim().toLowerCase()
  const { data } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (!data) {
    const passwordHash = await bcrypt.hash(bootstrapPassword, 12)
    const { error: insertError } = await admin.from('users').insert({ email, full_name: 'مدير تلاجتي', password_hash: passwordHash, role: 'admin', is_active: true })
    if (insertError) throw new Error('تعذر إنشاء حساب الإدارة الأول')
  }
}

function mapOrder(order: any) {
  const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers
  const supplierUser = supplier?.users ? (Array.isArray(supplier.users) ? supplier.users[0] : supplier.users) : null
  return {
    order_id: order.public_id,
    order_number: order.order_number,
    customer_name: order.customers?.full_name,
    customer_phone: order.customers?.phone_normalized,
    customer_address_text: order.delivery_address,
    status: order.status,
    total: order.total,
    created_at: order.created_at,
    assigned_supplier_name: supplierUser?.full_name ?? null,
    items: (order.order_items ?? []).map((item: any) => ({ product_id: item.product_sku, name: item.product_name_ar, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total })),
  }
}

async function getOrders(phone?: string, supplierUserId?: number) {
  let supplierId: number | null = null
  if (supplierUserId) {
    const { data: supplier } = await admin.from('suppliers').select('id').eq('user_id', supplierUserId).maybeSingle()
    supplierId = supplier?.id ?? null
    if (!supplierId) throw new Error('حساب المورد غير مكتمل')
  }
  let query = admin.from('orders').select('public_id,order_number,delivery_address,status,total,created_at,customers(full_name,phone_normalized),order_items(product_sku,product_name_ar,quantity,unit_price,line_total),suppliers(users(full_name))').order('created_at', { ascending: false })
  if (phone) {
    const normalized = phone.replace(/[^0-9+]/g, '').replace(/^00/, '+')
    const { data: customer } = await admin.from('customers').select('id').eq('phone_normalized', normalized).maybeSingle()
    if (!customer) return []
    query = query.eq('customer_id', customer.id)
  }
  if (supplierId) query = query.eq('assigned_supplier_id', supplierId)
  const { data, error: queryError } = await query
  if (queryError) throw new Error('تعذر تحميل الطلبات')
  return (data ?? []).map(mapOrder)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  const url = new URL(request.url)
  const route = url.pathname.replace(/^\/(?:functions\/v1\/)?talagty-api(?=\/|$)/, '') || '/'
  try {
    if (request.method === 'GET' && route === '/health') return response(request, { status: 'ok' })

    if (request.method === 'POST' && route === '/api/orders') {
      const body = await request.json()
      const { data, error: rpcError } = await admin.rpc('create_customer_order', { p_name: body.customer_name, p_phone: body.customer_phone, p_address: body.customer_address_text, p_items: body.items })
      if (rpcError) return error(request, rpcError.message.includes('رقم') ? rpcError.message : 'تعذر حفظ الطلب', 422)
      const order = Array.isArray(data) ? data[0] : data
      return response(request, { order_id: order.order_id, order_number: order.order_number, status: order.status, total: order.total }, 201)
    }

    if (request.method === 'GET' && route === '/api/orders') return response(request, await getOrders(url.searchParams.get('phone') ?? undefined))

    if (request.method === 'POST' && route === '/api/auth/login') {
      await ensureBootstrapAdmin()
      const body = await request.json()
      const { data: user } = await admin.from('users').select('id,password_hash,role,is_active').eq('email', String(body.email ?? '').trim().toLowerCase()).maybeSingle()
      if (!user || !user.is_active || !(await bcrypt.compare(String(body.password ?? ''), user.password_hash))) return error(request, 'بيانات الدخول غير صحيحة', 401)
      return response(request, { access_token: await issueToken(user.id, user.role), token_type: 'bearer', role: user.role })
    }

    if (route.startsWith('/api/admin/')) {
      if (!(await requireRole(request, 'admin'))) return error(request, 'يلزم تسجيل الدخول كمدير', 401)
      if (request.method === 'GET' && route === '/api/admin/orders') return response(request, await getOrders())
      if (request.method === 'GET' && route === '/api/admin/suppliers') {
        const { data, error: suppliersError } = await admin.from('suppliers').select('id,business_name,is_available,users(full_name)').order('business_name')
        if (suppliersError) throw suppliersError
        return response(request, (data ?? []).map((supplier: any) => ({ supplier_id: supplier.id, full_name: supplier.users?.full_name, business_name: supplier.business_name, is_available: supplier.is_available })))
      }
      if (request.method === 'POST' && route === '/api/admin/suppliers') {
        const body = await request.json(); const email = String(body.email ?? '').trim().toLowerCase()
        const passwordHash = await bcrypt.hash(String(body.password ?? ''), 12)
        const { data: user, error: userError } = await admin.from('users').insert({ email, full_name: String(body.full_name ?? '').trim(), password_hash: passwordHash, role: 'supplier', is_active: true }).select('id,full_name').single()
        if (userError) return error(request, 'تعذر إنشاء حساب المورد', 422)
        const { data: supplier, error: supplierError } = await admin.from('suppliers').insert({ user_id: user.id, business_name: String(body.business_name ?? '').trim(), is_available: true }).select('id,business_name,is_available').single()
        if (supplierError) { await admin.from('users').delete().eq('id', user.id); throw supplierError }
        return response(request, { supplier_id: supplier.id, full_name: user.full_name, business_name: supplier.business_name, is_available: supplier.is_available }, 201)
      }
      const assignmentMatch = route.match(/^\/api\/admin\/orders\/([^/]+)\/assignment$/)
      if (request.method === 'PATCH' && assignmentMatch) {
        const body = await request.json(); const { data, error: assignError } = await admin.rpc('assign_order_supplier', { p_order_public_id: assignmentMatch[1], p_supplier_id: body.supplier_id })
        if (assignError) return error(request, assignError.message, 422)
        return response(request, data)
      }
      const statusMatch = route.match(/^\/api\/admin\/orders\/([^/]+)\/status$/)
      if (request.method === 'PATCH' && statusMatch) {
        const body = await request.json(); const { data, error: statusError } = await admin.rpc('transition_order_status', { p_order_public_id: statusMatch[1], p_new_status: body.status, p_note: body.note ?? null })
        if (statusError) return error(request, statusError.message, 422)
        return response(request, data)
      }
    }

    if (request.method === 'GET' && route === '/api/supplier/orders') {
      const supplier = await requireRole(request, 'supplier'); if (!supplier) return error(request, 'يلزم تسجيل الدخول كمورد', 401)
      return response(request, await getOrders(undefined, supplier.sub))
    }
    return error(request, 'المسار غير موجود', 404)
  } catch (caught) {
    console.error(caught)
    return error(request, 'حدث خطأ غير متوقع في الخدمة', 500)
  }
})
