(() => {
    'use strict';
    const apiBase = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
    const previewMode = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('preview');
    const deviceId = localStorage.getItem('talagtySupplierDevice') || (crypto.randomUUID ? crypto.randomUUID() + crypto.randomUUID() : String(Date.now()) + Math.random());
    localStorage.setItem('talagtySupplierDevice', deviceId);
    let token = localStorage.getItem('talagtySupplierToken') || '';
    let orders = [], notifications = [], activeTab = 'active', currentOrder = null, cameraStream = null, scanTimer = null, installPrompt = null;
    const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
    const labels = { assigned: 'طلب جديد', preparing: 'قيد التجهيز', out_for_delivery: 'خرج للتوصيل', completed: 'مكتمل' };
    const demoOrders = [{ order_id: 'demo-supplier-1', order_number: 'TLG-20260827-E56F7G8H', customer_name: 'سارة محمد', customer_phone: '01111111111', customer_address_text: 'التجمع الخامس، الحي الأول، عمارة ٨', admin_note: 'تم التأكيد هاتفياً. الدفع نقداً.', status: 'assigned', subtotal: 160, delivery_fee: 20, total: 180, amount_paid: 0, payment_method: 'cash', created_at: new Date().toISOString(), items: [{ name: 'جبن شيدر', quantity: 4, unit_price: 40, line_total: 160 }] }, { order_id: 'demo-supplier-2', order_number: 'TLG-20260827-P12Q3R4S', customer_name: 'محمود السيد', customer_phone: '01002500273', customer_address_text: 'مدينة نصر، شارع الطيران، عمارة ١٢', admin_note: '', status: 'out_for_delivery', subtotal: 116, delivery_fee: 15, total: 131, amount_paid: 0, payment_method: 'cash', created_at: new Date(Date.now() - 7200000).toISOString(), items: [{ name: 'حليب كامل الدسم', quantity: 2, unit_price: 18, line_total: 36 }, { name: 'لانشون بيتزا', quantity: 2, unit_price: 40, line_total: 80 }] }, { order_id: 'demo-supplier-3', order_number: 'TLG-20260826-K91L2M3N', customer_name: 'عمر حسن', customer_phone: '01222222222', customer_address_text: 'المعادي، شارع ٩', status: 'completed', subtotal: 250, delivery_fee: 0, total: 250, amount_paid: 250, payment_method: 'cash', completed_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 90000000).toISOString(), items: [{ name: 'لانشون بيتزا', quantity: 5, unit_price: 50, line_total: 250 }] }];

    function $(id) { return document.getElementById(id); }
    function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
    function formatDate(value) { return value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
    function toast(message, error = false) { const element = $('supplier-toast'); element.textContent = message; element.classList.toggle('error', error); element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3500); }
    function formMessage(form, message, error = true) { const element = form.querySelector('.form-message'); element.textContent = message; element.style.color = error ? 'var(--danger)' : 'var(--success)'; }
    async function api(path, options = {}) {
        if (previewMode) return null;
        const response = await fetch(apiBase + path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-Device-ID': deviceId, ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
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
        const nextButton = currentOrder.status === 'assigned' ? `<button class="action-primary" data-next-status="preparing">بدء تجهيز الطلب</button>` : currentOrder.status === 'preparing' ? `<button class="action-primary" data-next-status="out_for_delivery">خرج للتوصيل</button>` : currentOrder.status === 'out_for_delivery' ? '<button class="action-success" id="scan-this-order">تسليم أوردر</button>' : '';
        $('supplier-order-detail').innerHTML = `<header class="detail-header"><small>${escapeHtml(currentOrder.order_number)}</small><h2>${escapeHtml(currentOrder.customer_name || '—')}</h2><p>${formatDate(currentOrder.created_at)}</p></header><section class="detail-section"><h3>بيانات العميل</h3><p><strong>الهاتف:</strong> <a href="tel:${escapeHtml(currentOrder.customer_phone || '')}">${escapeHtml(currentOrder.customer_phone || '')}</a></p><p><strong>العنوان:</strong> ${escapeHtml(currentOrder.customer_address_text || '')}</p>${currentOrder.admin_note ? `<p><strong>ملاحظة الإدارة:</strong> ${escapeHtml(currentOrder.admin_note)}</p>` : ''}</section><section class="detail-section invoice-print-area"><h3>الفاتورة التفصيلية</h3><table class="invoice-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${(currentOrder.items || []).map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money.format(Number(item.unit_price))}</td><td>${money.format(Number(item.line_total))}</td></tr>`).join('')}</tbody></table><div class="invoice-summary"><div><span>الإجمالي الفرعي</span><strong>${money.format(Number(currentOrder.subtotal || 0))}</strong></div><div><span>التوصيل</span><strong>${money.format(Number(currentOrder.delivery_fee || 0))}</strong></div><div><span>طريقة الدفع</span><strong>${paymentLabel(currentOrder.payment_method)}</strong></div><div><span>المدفوع</span><strong>${money.format(Number(currentOrder.amount_paid || 0))}</strong></div><div class="total"><span>الإجمالي النهائي</span><strong>${money.format(Number(currentOrder.total || 0))}</strong></div></div></section><div class="order-actions">${nextButton}<button class="action-print" id="print-invoice">طباعة PDF</button></div>`;
        $('order-sheet').hidden = false;
    }
    async function updateStatus(status) { if (!currentOrder) return; try { if (previewMode) currentOrder.status = status; else await api('/api/supplier/orders/' + encodeURIComponent(currentOrder.order_id) + '/status', { method: 'PATCH', body: { status } }); $('order-sheet').hidden = true; await loadData(); toast(status === 'preparing' ? 'تم بدء تجهيز الطلب' : 'تم تحديث الطلب إلى خرج للتوصيل'); } catch (error) { toast(error.message, true); } }

    function openScanner() { $('scanner-overlay').hidden = false; startCamera(); }
    async function startCamera() {
        const status = $('scanner-status');
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            const video = $('scanner-video'); video.srcObject = cameraStream; await video.play();
            if ('BarcodeDetector' in window) { const detector = new BarcodeDetector({ formats: ['qr_code'] }); status.textContent = 'الكاميرا جاهزة للمسح'; scanTimer = setInterval(async () => { try { const codes = await detector.detect(video); if (codes[0]?.rawValue) await confirmDelivery(codes[0].rawValue); } catch {} }, 500); }
            else status.textContent = 'المسح التلقائي غير مدعوم في هذا المتصفح. استخدم رمز التسليم الاحتياطي.';
        } catch { status.textContent = 'تعذر تشغيل الكاميرا. اسمح للتطبيق باستخدام الكاميرا أو أدخل الرمز يدوياً.'; }
    }
    function stopCamera() { if (scanTimer) clearInterval(scanTimer); scanTimer = null; cameraStream?.getTracks().forEach(track => track.stop()); cameraStream = null; $('scanner-overlay').hidden = true; }
    function parseDeliveryCode(raw) { try { const parsed = JSON.parse(raw); return { orderId: parsed.order_id, token: parsed.token }; } catch { const parts = String(raw).split(':'); return parts.length >= 3 && parts[0] === 'talagty' ? { orderId: parts[1], token: parts.slice(2).join(':') } : { orderId: currentOrder?.order_id, token: raw }; } }
    function queueDeliveryConfirmation(data) {
        const pending = JSON.parse(localStorage.getItem('talagtyPendingDeliveries') || '[]');
        if (!pending.some(item => item.orderId === data.orderId)) pending.push({ ...data, queuedAt: new Date().toISOString() });
        localStorage.setItem('talagtyPendingDeliveries', JSON.stringify(pending));
        const order = orders.find(item => item.order_id === data.orderId) || currentOrder;
        if (order) { order.status = 'completed'; order.completed_at = new Date().toISOString(); order.amount_paid = order.total; }
    }
    async function flushPendingDeliveries() {
        if (!navigator.onLine || previewMode || !token) return;
        const pending = JSON.parse(localStorage.getItem('talagtyPendingDeliveries') || '[]');
        const remaining = [];
        for (const item of pending) {
            try { await api('/api/supplier/orders/' + encodeURIComponent(item.orderId) + '/delivery/confirm', { method: 'POST', body: { token: item.token } }); }
            catch { remaining.push(item); }
        }
        localStorage.setItem('talagtyPendingDeliveries', JSON.stringify(remaining));
        if (pending.length && !remaining.length) toast('تمت مزامنة عمليات التسليم المحفوظة');
    }
    async function confirmDelivery(raw) {
        const data = parseDeliveryCode(raw);
        if (!data.orderId || !data.token) { toast('رمز التسليم غير صحيح', true); return; }
        try {
            if (previewMode) {
                queueDeliveryConfirmation(data);
                localStorage.removeItem('talagtyPendingDeliveries');
            } else if (!navigator.onLine) {
                queueDeliveryConfirmation(data);
                stopCamera(); $('order-sheet').hidden = true; renderOrders();
                toast('تم حفظ التسليم على الهاتف وسيتم إرساله عند عودة الإنترنت');
                return;
            } else await api('/api/supplier/orders/' + encodeURIComponent(data.orderId) + '/delivery/confirm', { method: 'POST', body: { token: data.token } });
            stopCamera(); $('order-sheet').hidden = true; await loadData(); toast('تم تسليم الطلب وإغلاق الفاتورة بنجاح');
        } catch (error) { toast(error.message, true); }
    }

    document.addEventListener('click', event => {
        const authTab = event.target.closest('[data-auth-tab]'); if (authTab) { document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button === authTab)); document.querySelectorAll('.auth-form').forEach(form => form.classList.toggle('active', form.id === 'supplier-' + authTab.dataset.authTab + '-form')); }
        const orderTab = event.target.closest('[data-order-tab]'); if (orderTab) { activeTab = orderTab.dataset.orderTab; document.querySelectorAll('[data-order-tab]').forEach(button => button.classList.toggle('active', button === orderTab)); renderOrders(); }
        const openOrder = event.target.closest('[data-open-order]'); if (openOrder) showOrder(openOrder.dataset.openOrder);
        const next = event.target.closest('[data-next-status]'); if (next) updateStatus(next.dataset.nextStatus);
        if (event.target.closest('[data-close-sheet]') || event.target.classList.contains('sheet-overlay')) { $('order-sheet').hidden = true; $('notifications-sheet').hidden = true; }
        if (event.target.id === 'print-invoice') window.print();
        if (event.target.id === 'scan-this-order' || event.target.closest('#quick-scan')) openScanner();
    });
    $('supplier-login-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; formMessage(form, 'جاري تسجيل الدخول...', false); try { if (previewMode) token = 'preview'; else { const result = await api('/api/auth/login', { method: 'POST', body: { phone: $('login-phone').value.trim(), password: $('login-password').value, device_id: deviceId } }); token = result.access_token; } localStorage.setItem('talagtySupplierToken', token); formMessage(form, '', false); showApp(); await loadData(); } catch (error) { formMessage(form, error.activation_required ? 'الحساب يحتاج التفعيل أولاً. افتح تبويب تفعيل أول مرة.' : error.message); } });
    $('supplier-activate-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; formMessage(form, 'جاري تفعيل الهاتف...', false); try { const result = previewMode ? { access_token: 'preview' } : await api('/api/auth/activate', { method: 'POST', body: { phone: $('activate-phone').value.trim(), password: $('activate-password').value, code: $('activation-code').value.trim(), device_id: deviceId } }); token = result.access_token; localStorage.setItem('talagtySupplierToken', token); showApp(); await loadData(); toast('تم تفعيل هذا الهاتف بنجاح'); } catch (error) { formMessage(form, error.message); } });
    $('notifications-button').addEventListener('click', () => { $('notifications-sheet').hidden = false; }); $('close-scanner').addEventListener('click', stopCamera); $('confirm-manual-code').addEventListener('click', () => confirmDelivery($('manual-delivery-code').value.trim()));
    window.addEventListener('online', async () => { $('connection-status').textContent = 'متصل'; await flushPendingDeliveries(); loadData(); }); window.addEventListener('offline', () => { $('connection-status').textContent = 'دون اتصال'; toast('لا يوجد اتصال. ستظهر آخر بيانات محفوظة.', true); });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install-app').hidden = false; }); $('install-app').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('install-app').hidden = true; });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./supplier-sw.js').catch(() => {});
    if (previewMode) { showApp(); loadData(); } else if (token) { showApp(); flushPendingDeliveries().then(loadData); } else showAuth();
})();
