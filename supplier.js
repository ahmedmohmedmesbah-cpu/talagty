(() => {
    'use strict';
    const apiBase = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
    const previewMode = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('preview');
    const deviceId = localStorage.getItem('talagtySupplierDevice') || (crypto.randomUUID ? crypto.randomUUID() + crypto.randomUUID() : String(Date.now()) + Math.random());
    localStorage.setItem('talagtySupplierDevice', deviceId);
    let token = localStorage.getItem('talagtySupplierToken') || '';
    let orders = [], notifications = [], activeTab = 'active', currentOrder = null, installPrompt = null;
    const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
    const labels = { assigned: 'طلب جديد', preparing: 'قيد التجهيز', out_for_delivery: 'خرج للتوصيل', pending_delivery_review: 'بانتظار تأكيد التسليم', delivery_proof_rejected: 'مطلوب إعادة تصوير الفاتورة', completed: 'مكتمل' };
    const demoOrders = [{ order_id: 'demo-supplier-1', order_number: 'TLG-20260827-E56F7G8H', customer_name: 'سارة محمد', customer_phone: '01111111111', customer_address_text: 'التجمع الخامس، الحي الأول، عمارة ٨', admin_note: 'تم التأكيد هاتفياً. الدفع نقداً.', status: 'assigned', subtotal: 160, delivery_fee: 20, total: 180, amount_paid: 0, payment_method: 'cash', created_at: new Date().toISOString(), items: [{ name: 'جبن شيدر', quantity: 4, unit_price: 40, line_total: 160 }] }, { order_id: 'demo-supplier-2', order_number: 'TLG-20260827-P12Q3R4S', customer_name: 'محمود السيد', customer_phone: '01002500273', customer_address_text: 'مدينة نصر، شارع الطيران، عمارة ١٢', admin_note: '', status: 'out_for_delivery', subtotal: 116, delivery_fee: 15, total: 131, amount_paid: 0, payment_method: 'cash', created_at: new Date(Date.now() - 7200000).toISOString(), items: [{ name: 'حليب كامل الدسم', quantity: 2, unit_price: 18, line_total: 36 }, { name: 'لانشون بيتزا', quantity: 2, unit_price: 40, line_total: 80 }] }, { order_id: 'demo-supplier-3', order_number: 'TLG-20260826-K91L2M3N', customer_name: 'عمر حسن', customer_phone: '01222222222', customer_address_text: 'المعادي، شارع ٩', status: 'completed', subtotal: 250, delivery_fee: 0, total: 250, amount_paid: 250, payment_method: 'cash', completed_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 90000000).toISOString(), items: [{ name: 'لانشون بيتزا', quantity: 5, unit_price: 50, line_total: 250 }] }];

    function $(id) { return document.getElementById(id); }
    function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
    function formatDate(value) { return value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
    function toast(message, error = false) { const element = $('supplier-toast'); element.textContent = message; element.classList.toggle('error', error); element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3500); }
    function formMessage(form, message, error = true) { const element = form.querySelector('.form-message'); element.textContent = message; element.style.color = error ? 'var(--danger)' : 'var(--success)'; }
    async function api(path, options = {}) {
        if (previewMode) return null;
        const multipart = options.body instanceof FormData;
        const response = await fetch(apiBase + path, { ...options, headers: { ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-Device-ID': deviceId, ...(options.headers || {}) }, body: multipart ? options.body : options.body ? JSON.stringify(options.body) : undefined });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 && !path.startsWith('/api/auth/')) logout();
        if (!response.ok) { const error = new Error(payload.detail || 'تعذر تنفيذ الطلب'); Object.assign(error, payload); throw error; }
        return payload;
    }
    function showAuth() { $('supplier-auth').hidden = false; $('supplier-app').hidden = true; }
    function showApp() { $('supplier-auth').hidden = true; $('supplier-app').hidden = false; }
    function logout() { token = ''; localStorage.removeItem('talagtySupplierToken'); showAuth(); }

    async function loadData() {
        try {
            if (previewMode) { orders = structuredClone(demoOrders); notifications = [{ id: 1, message_ar: 'تم إسناد طلب جديد إليك', created_at: new Date().toISOString(), is_read: false }]; }
            else [orders, notifications] = await Promise.all([api('/api/supplier/orders'), api('/api/supplier/notifications')]);
            renderOrders(); renderNotifications(); $('connection-status').textContent = navigator.onLine ? 'متصل' : 'دون اتصال';
        } catch (error) { toast(error.message, true); }
    }
    function filteredOrders() { return orders.filter(order => activeTab === 'completed' ? order.status === 'completed' : order.status !== 'completed' && order.status !== 'cancelled'); }
    function orderCard(order) { return `<article class="supplier-order-card"><div class="order-card-head"><div><span class="order-number">${escapeHtml(order.order_number)}</span><span class="order-date">${formatDate(order.created_at)}</span></div><span class="order-status ${escapeHtml(order.status)}">${labels[order.status] || escapeHtml(order.status)}</span></div><div class="order-customer-line"><strong>${escapeHtml(order.customer_name || '—')}</strong><span>·</span><a href="tel:${escapeHtml(order.customer_phone || '')}">${escapeHtml(order.customer_phone || '')}</a></div><p class="order-address">${escapeHtml(order.customer_address_text || '')}</p><div class="order-card-footer"><strong>${money.format(Number(order.total || 0))}</strong><button data-open-order="${escapeHtml(order.order_id)}">عرض التفاصيل</button></div></article>`; }
    function renderOrders() { const list = filteredOrders(); $('active-count').textContent = orders.filter(order => order.status !== 'completed' && order.status !== 'cancelled').length; $('supplier-orders').innerHTML = list.length ? list.map(orderCard).join('') : '<div class="loading-card">لا توجد طلبات في هذا القسم.</div>'; }
    function renderNotifications() { const unread = notifications.filter(item => !item.is_read).length; $('notifications-count').textContent = unread; $('notifications-count').hidden = unread === 0; $('notifications-list').innerHTML = notifications.length ? notifications.map(item => `<article class="notification-item"><p>${escapeHtml(item.message_ar)}</p><small>${formatDate(item.created_at)}</small></article>`).join('') : '<div class="loading-card">لا توجد إشعارات.</div>'; }
    function paymentLabel(value) { return { cash: 'نقداً', card: 'بطاقة', transfer: 'تحويل', credit: 'آجل' }[value] || value || 'نقداً'; }
    function showOrder(orderId) {
        currentOrder = orders.find(order => String(order.order_id) === String(orderId)); if (!currentOrder) return;
        const nextButton = currentOrder.status === 'assigned' ? `<button class="action-primary" data-next-status="preparing">بدء تجهيز الطلب</button>` : currentOrder.status === 'preparing' ? `<button class="action-primary" data-next-status="out_for_delivery">خرج للتوصيل</button>` : '';
        $('supplier-order-detail').innerHTML = `<header class="detail-header"><small>${escapeHtml(currentOrder.order_number)}</small><h2>${escapeHtml(currentOrder.customer_name || '—')}</h2><p>${formatDate(currentOrder.created_at)}</p></header><section class="detail-section"><h3>بيانات العميل</h3><p><strong>الهاتف:</strong> <a href="tel:${escapeHtml(currentOrder.customer_phone || '')}">${escapeHtml(currentOrder.customer_phone || '')}</a></p><p><strong>العنوان:</strong> ${escapeHtml(currentOrder.customer_address_text || '')}</p>${currentOrder.admin_note ? `<p><strong>ملاحظة الإدارة:</strong> ${escapeHtml(currentOrder.admin_note)}</p>` : ''}</section><section class="detail-section invoice-print-area"><h3>الفاتورة التفصيلية</h3><table class="invoice-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${(currentOrder.items || []).map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money.format(Number(item.unit_price))}</td><td>${money.format(Number(item.line_total))}</td></tr>`).join('')}</tbody></table><div class="invoice-summary"><div><span>الإجمالي الفرعي</span><strong>${money.format(Number(currentOrder.subtotal || 0))}</strong></div><div><span>التوصيل</span><strong>${money.format(Number(currentOrder.delivery_fee || 0))}</strong></div><div><span>طريقة الدفع</span><strong>${paymentLabel(currentOrder.payment_method)}</strong></div><div><span>المدفوع</span><strong>${money.format(Number(currentOrder.amount_paid || 0))}</strong></div><div class="total"><span>الإجمالي النهائي</span><strong>${money.format(Number(currentOrder.total || 0))}</strong></div></div></section><div class="order-actions">${nextButton}<button class="action-print" id="print-invoice">طباعة PDF</button></div>`;
        $('supplier-order-detail').insertAdjacentHTML('beforeend', `<section class="detail-section"><h3>${escapeHtml(labels[currentOrder.status] || currentOrder.status)}</h3><div id="proof-history">جاري تحميل إثباتات التسليم…</div>${['out_for_delivery','delivery_proof_rejected'].includes(currentOrder.status) ? '<form id="proof-form"><label for="proof-photo">صورة الفاتورة بتوقيع كاشير المتجر</label><input id="proof-photo" type="file" accept="image/jpeg,image/png,image/webp" required><p>التقط صورة واضحة أو اخترها من الهاتف (حتى 5 ميجابايت). يلزم اتصال بالإنترنت للإرسال.</p><img id="proof-preview" alt="معاينة الفاتورة الموقعة" hidden style="width:100%;max-height:380px;object-fit:contain"><button type="submit" class="action-success">إرسال إثبات التسليم للإدارة</button><p class="form-message" role="status"></p></form>' : ''}</section>`);
        $('proof-photo')?.addEventListener('change', previewProof);
        $('proof-form')?.addEventListener('submit', submitProof);
        loadProofHistory(currentOrder.order_id);
        $('order-sheet').hidden = false;
    }
    async function updateStatus(status) { if (!currentOrder) return; try { if (previewMode) currentOrder.status = status; else await api('/api/supplier/orders/' + encodeURIComponent(currentOrder.order_id) + '/status', { method: 'PATCH', body: { status } }); $('order-sheet').hidden = true; await loadData(); toast(status === 'preparing' ? 'تم بدء تجهيز الطلب' : 'تم تحديث الطلب إلى خرج للتوصيل'); } catch (error) { toast(error.message, true); } }

    async function loadProofHistory(orderId) {
        const target = $('proof-history');
        try {
            const proofs = previewMode ? [] : await api('/api/supplier/orders/' + encodeURIComponent(orderId) + '/delivery-proof');
            if (!target.isConnected) return;
            target.innerHTML = proofs.length ? proofs.map(proof => `<p>${escapeHtml({pending:'بانتظار مراجعة الإدارة',approved:'معتمد',rejected:'مطلوب إعادة التصوير'}[proof.status])} — ${formatDate(proof.submitted_at)}</p>${proof.review_note ? `<p>ملاحظة الإدارة: ${escapeHtml(proof.review_note)}</p>` : ''}<a href="${escapeHtml(proof.image_url)}" target="_blank" rel="noopener">عرض الصورة المرسلة</a>`).join('') : '<p>لم يتم إرسال إثبات تسليم بعد.</p>';
        } catch (error) { if (target.isConnected) target.textContent = error.message; }
    }
    function previewProof(event) {
        const img = $('proof-preview'), file = event.target.files[0];
        if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
        img.hidden = true;
        if (!file) return;
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { event.target.value = ''; toast('اختر صورة JPG أو PNG أو WebP حتى 5 ميجابايت', true); return; }
        img.src = img.dataset.objectUrl = URL.createObjectURL(file); img.hidden = false;
    }
    async function submitProof(event) {
        event.preventDefault();
        const form = event.currentTarget, button = form.querySelector('button'), file = $('proof-photo').files[0], orderId = currentOrder?.order_id;
        if (!file || !orderId || button.disabled) return;
        button.disabled = true; formMessage(form, 'جاري إرسال الصورة…', false);
        try {
            if (!navigator.onLine) throw new Error('لا يوجد اتصال. احتفظ بالصورة وأرسلها عند عودة الإنترنت. لم يتم تأكيد التسليم.');
            const body = new FormData(); body.append('image', file);
            if (previewMode) demoOrders.find(order => order.order_id === orderId).status = 'pending_delivery_review';
            else await api('/api/supplier/orders/' + encodeURIComponent(orderId) + '/delivery-proof', {method:'POST',body});
            await loadData(); showOrder(orderId); toast('تم إرسال الإثبات. الطلب بانتظار اعتماد الإدارة.');
        } catch (error) { formMessage(form, error.message); } finally { button.disabled = false; }
    }

    document.addEventListener('click', event => {
        const authTab = event.target.closest('[data-auth-tab]'); if (authTab) { document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button === authTab)); document.querySelectorAll('.auth-form').forEach(form => form.classList.toggle('active', form.id === 'supplier-' + authTab.dataset.authTab + '-form')); }
        const orderTab = event.target.closest('[data-order-tab]'); if (orderTab) { activeTab = orderTab.dataset.orderTab; document.querySelectorAll('[data-order-tab]').forEach(button => button.classList.toggle('active', button === orderTab)); renderOrders(); }
        const openOrder = event.target.closest('[data-open-order]'); if (openOrder) showOrder(openOrder.dataset.openOrder);
        const next = event.target.closest('[data-next-status]'); if (next) updateStatus(next.dataset.nextStatus);
        if (event.target.closest('[data-close-sheet]') || event.target.classList.contains('sheet-overlay')) { $('order-sheet').hidden = true; $('notifications-sheet').hidden = true; }
        if (event.target.id === 'print-invoice') window.print();
    });
    $('supplier-login-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; formMessage(form, 'جاري تسجيل الدخول...', false); try { if (previewMode) token = 'preview'; else { const result = await api('/api/auth/login', { method: 'POST', body: { phone: $('login-phone').value.trim(), password: $('login-password').value, device_id: deviceId } }); token = result.access_token; } localStorage.setItem('talagtySupplierToken', token); formMessage(form, '', false); showApp(); await loadData(); } catch (error) { formMessage(form, error.activation_required ? 'الحساب يحتاج التفعيل أولاً. افتح تبويب تفعيل أول مرة.' : error.message); } });
    $('supplier-activate-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; formMessage(form, 'جاري تفعيل الهاتف...', false); try { const result = previewMode ? { access_token: 'preview' } : await api('/api/auth/activate', { method: 'POST', body: { phone: $('activate-phone').value.trim(), password: $('activate-password').value, code: $('activation-code').value.trim(), device_id: deviceId } }); token = result.access_token; localStorage.setItem('talagtySupplierToken', token); showApp(); await loadData(); toast('تم تفعيل هذا الهاتف بنجاح'); } catch (error) { formMessage(form, error.message); } });
    $('notifications-button').addEventListener('click', () => { $('notifications-sheet').hidden = false; });
    window.addEventListener('online', () => { $('connection-status').textContent = 'متصل'; loadData(); }); window.addEventListener('offline', () => { $('connection-status').textContent = 'دون اتصال'; toast('لا يوجد اتصال. لا يمكن إرسال إثبات التسليم حالياً.', true); });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install-app').hidden = false; }); $('install-app').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('install-app').hidden = true; });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./track-sw.js?v=6').catch(() => {});
    if (previewMode) { showApp(); loadData(); } else if (token) { showApp(); loadData(); } else showAuth();
})();
