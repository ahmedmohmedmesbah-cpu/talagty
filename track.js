(() => {
    'use strict';

    const apiBase = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
    const statusLabels = {
        pending_assignment: 'بانتظار مراجعة الإدارة', deferred_review: 'مؤجل للمراجعة', approved: 'تمت الموافقة',
        assigned: 'تم الإسناد للمندوب', preparing: 'قيد التجهيز', out_for_delivery: 'خرج للتوصيل', completed: 'مكتمل', cancelled: 'ملغي',
    };
    const cancellableStatuses = new Set(['pending_assignment', 'deferred_review', 'approved', 'assigned', 'preparing']);
    const qrStatuses = new Set(['assigned', 'preparing', 'out_for_delivery']);
    const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
    const deviceKey = 'talagtyCustomerDevice';
    const tokenKey = 'talagtyCustomerToken';
    const phoneKey = 'talagtyCustomerPhone';
    const ordersKey = 'talagtyCustomerOrders';
    const deviceId = localStorage.getItem(deviceKey) || createDeviceId();
    let token = localStorage.getItem(tokenKey) || '';
    let phone = localStorage.getItem(phoneKey) || '';
    let challengeId = '';
    let orders = readCachedOrders();

    localStorage.setItem(deviceKey, deviceId);

    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

    function createDeviceId() {
        if (crypto.randomUUID) return crypto.randomUUID() + '-' + crypto.randomUUID();
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function readCachedOrders() {
        try { const cached = JSON.parse(localStorage.getItem(ordersKey) || '[]'); return Array.isArray(cached) ? cached : []; }
        catch { return []; }
    }

    function showView(viewId) { ['phone-view', 'otp-view', 'orders-view'].forEach(id => { $(id).hidden = id !== viewId; }); }
    function setMessage(id, message = '', error = true) { const element = $(id); element.textContent = message; element.classList.toggle('success', Boolean(message) && !error); }
    function setBusy(button, busy, busyText) { if (!button.dataset.label) button.dataset.label = button.textContent; button.disabled = busy; button.textContent = busy ? busyText : button.dataset.label; }

    async function request(path, options = {}) {
        if (!apiBase) throw new Error('عنوان خدمة الطلبات غير مضبوط');
        const response = await fetch(apiBase + path, {
            ...options,
            headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-Device-ID': deviceId, ...(options.headers || {}) },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) { const error = new Error(payload.detail || 'تعذر تنفيذ الطلب'); Object.assign(error, payload, { status: response.status }); throw error; }
        return payload;
    }

    function formatDate(value) { return value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }

    function orderCard(order) {
        const canCancel = cancellableStatuses.has(order.status);
        const hasQr = qrStatuses.has(order.status) && order.delivery_qr_payload;
        const receiveButton = hasQr ? `<button class="receive-order" data-receive="${escapeHtml(order.order_id)}">استلام أوردر</button>`
            : order.status === 'completed' ? '<span class="received-label">تم استلام الأوردر</span>'
                : order.status === 'cancelled' ? '' : '<button class="receive-order waiting" type="button" disabled>استلام أوردر بعد الإسناد</button>';
        const cancelButton = canCancel ? `<button class="cancel-order" data-cancel="${escapeHtml(order.order_id)}">إلغاء الطلب</button>` : '';
        const items = (order.items || []).map(item => `<li><span>${escapeHtml(item.name)} × ${Number(item.quantity)}</span><strong>${money.format(Number(item.line_total || 0))}</strong></li>`).join('');
        const latestTimeline = (order.timeline || []).slice(-3).reverse().map(item => `<li><span>${escapeHtml(statusLabels[item.status] || item.status)}</span><time>${formatDate(item.created_at)}</time></li>`).join('');
        return `<article class="track-order" data-order="${escapeHtml(order.order_id)}"><header><div><h2>${escapeHtml(order.order_number)}</h2><time>${formatDate(order.created_at)}</time></div><span class="track-status ${escapeHtml(order.status)}">${escapeHtml(statusLabels[order.status] || order.status)}</span></header><p class="order-address">${escapeHtml(order.customer_address_text || '')}</p><details><summary>تفاصيل الفاتورة</summary><ul class="track-items">${items}</ul>${latestTimeline ? `<h3>آخر التحديثات</h3><ul class="track-timeline">${latestTimeline}</ul>` : ''}</details><footer><strong>${money.format(Number(order.total || 0))}</strong><div class="order-buttons">${cancelButton}${receiveButton}</div></footer></article>`;
    }

    function renderOrders() { $('track-list').innerHTML = orders.length ? orders.map(orderCard).join('') : '<div class="empty-track">لا توجد طلبات مرتبطة بهذا الرقم.</div>'; }

    async function loadOrders({ showCache = true } = {}) {
        showView('orders-view'); $('customer-phone-label').textContent = phone || '';
        if (showCache && orders.length) { renderOrders(); setMessage('orders-message', navigator.onLine ? 'يتم تحديث البيانات…' : 'أنت دون اتصال. نعرض آخر نسخة محفوظة على هذا الجهاز.', !navigator.onLine); }
        else $('track-list').innerHTML = '<div class="empty-track">جاري تحميل الطلبات…</div>';
        try {
            orders = await request('/api/customer/orders'); localStorage.setItem(ordersKey, JSON.stringify(orders)); renderOrders();
            setMessage('orders-message', 'تم تحديث الطلبات', false); setTimeout(() => setMessage('orders-message'), 1600);
        } catch (error) {
            if (error.status === 401) { token = ''; localStorage.removeItem(tokenKey); showView('phone-view'); setMessage('phone-message', 'انتهت جلسة الحماية. اطلب من الإدارة كود تفعيل واتساب جديداً.'); return; }
            if (orders.length) setMessage('orders-message', 'تعذر الاتصال. نعرض آخر نسخة محفوظة على هذا الجهاز.'); else setMessage('orders-message', error.message);
        }
    }

    $('phone-form').addEventListener('submit', async event => {
        event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); phone = $('track-phone').value.trim(); setMessage('phone-message'); setBusy(button, true, 'جاري التحقق…');
        try { const result = await request('/api/customer/auth/request-code', { method: 'POST', body: { phone, device_id: deviceId } }); challengeId = result.challenge_id; $('masked-phone').textContent = result.masked_phone; showView('otp-view'); $('track-code').focus(); }
        catch (error) { setMessage('phone-message', error.message); } finally { setBusy(button, false); }
    });

    $('otp-form').addEventListener('submit', async event => {
        event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); setMessage('otp-message'); setBusy(button, true, 'جاري التحقق…');
        try { const result = await request('/api/customer/auth/verify-code', { method: 'POST', body: { challenge_id: challengeId, code: $('track-code').value.trim(), device_id: deviceId } }); token = result.access_token; phone = result.customer?.phone || phone; localStorage.setItem(tokenKey, token); localStorage.setItem(phoneKey, phone); await loadOrders({ showCache: false }); }
        catch (error) { setMessage('otp-message', error.message); } finally { setBusy(button, false); }
    });

    $('change-phone').addEventListener('click', () => { challengeId = ''; $('track-code').value = ''; showView('phone-view'); });
    $('refresh-orders').addEventListener('click', async event => { setBusy(event.currentTarget, true, 'جاري التحديث…'); await loadOrders(); setBusy(event.currentTarget, false); });

    document.addEventListener('click', async event => {
        const receiveButton = event.target.closest('[data-receive]');
        if (receiveButton) {
            const order = orders.find(item => String(item.order_id) === String(receiveButton.dataset.receive)); if (!order?.delivery_qr_payload) return;
            $('receipt-modal').hidden = false; $('receipt-order-number').textContent = order.order_number; $('receipt-offline-note').textContent = navigator.onLine ? 'الرمز جاهز للمسح.' : 'لا يوجد إنترنت، لكن الرمز محفوظ وجاهز للمسح.';
            const qrBox = $('receipt-qr'); qrBox.innerHTML = '';
            if (window.QRCode) new window.QRCode(qrBox, { text: order.delivery_qr_payload, width: 240, height: 240, colorDark: '#172033', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
            else qrBox.textContent = 'تعذر رسم الرمز. اتصل بالإنترنت مرة واحدة ثم حاول مجدداً.';
        }
        const cancelButton = event.target.closest('[data-cancel]');
        if (cancelButton) {
            const order = orders.find(item => String(item.order_id) === String(cancelButton.dataset.cancel)); if (!order || !confirm(`هل تريد إلغاء الطلب ${order.order_number}؟`)) return;
            setBusy(cancelButton, true, 'جاري الإلغاء…');
            try { await request('/api/customer/orders/' + encodeURIComponent(order.order_id) + '/cancel', { method: 'POST' }); await loadOrders({ showCache: false }); }
            catch (error) { alert(error.message); setBusy(cancelButton, false); }
        }
    });

    $('close-receipt').addEventListener('click', () => { $('receipt-modal').hidden = true; });
    $('receipt-modal').addEventListener('click', event => { if (event.target === $('receipt-modal')) $('receipt-modal').hidden = true; });
    window.addEventListener('online', () => { $('connection-state').textContent = 'متصل'; if (token) loadOrders(); });
    window.addEventListener('offline', () => { $('connection-state').textContent = 'دون اتصال'; setMessage('orders-message', 'أنت دون اتصال. رموز الاستلام والطلبات المحفوظة ما زالت متاحة.'); });

    $('track-phone').value = phone; $('connection-state').textContent = navigator.onLine ? 'متصل' : 'دون اتصال';
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./track-sw.js').catch(() => {});
    if (token) loadOrders(); else showView('phone-view');
})();
