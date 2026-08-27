(() => {
    'use strict';
    const apiBase = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
    let token = sessionStorage.getItem('tallagtyAdminToken') || '';
    let currentView = 'orders';
    const state = { orders: [], products: [], categories: [], suppliers: [], movements: [] };
    const previewMode = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('preview');
    const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });
    const statusLabels = { pending_assignment: 'بانتظار المراجعة', deferred_review: 'مؤجل للمراجعة', approved: 'تمت الموافقة', assigned: 'تم الإسناد', preparing: 'قيد التجهيز', out_for_delivery: 'خرج للتوصيل', completed: 'مكتمل', cancelled: 'ملغي' };
    const viewTitles = { orders: 'الطلبات الجديدة', products: 'المنتجات والعروض', categories: 'فئات المنتجات', suppliers: 'إدارة الموردين', inventory: 'المخزون المركزي', reports: 'التقارير' };
    const fallbackImage = 'assets/لانشون.jpg';

    const demo = {
        categories: [{ id: 1, name_ar: 'ألبان', slug: 'dairy', description_ar: 'منتجات الألبان الطازجة', image_url: '', sort_order: 1, is_active: true }, { id: 2, name_ar: 'أجبان', slug: 'cheese', description_ar: 'تشكيلة الأجبان', image_url: '', sort_order: 2, is_active: true }, { id: 3, name_ar: 'لانشون', slug: 'luncheon', description_ar: 'لانشون عالي الجودة', image_url: 'assets/لانشون.jpg', sort_order: 3, is_active: true }],
        products: [{ id: 1, sku: 'mc1', name_ar: 'حليب كامل الدسم', description_ar: 'حليب طازج غني بالقشدة', unit_price: 18, effective_price: 15.3, image_url: 'https://picsum.photos/120/120?random=30', category_id: 1, category_name: 'ألبان', sale_type: 'percentage', sale_value: 15, stock_quantity: 42, low_stock_threshold: 8, is_active: true }, { id: 2, sku: 'ch1', name_ar: 'جبن شيدر', description_ar: 'جبن شيدر غني بالنكهة', unit_price: 40, effective_price: 40, image_url: 'https://picsum.photos/120/120?random=33', category_id: 2, category_name: 'أجبان', sale_type: 'none', sale_value: 0, stock_quantity: 7, low_stock_threshold: 10, is_active: true }, { id: 3, sku: 'ln1', name_ar: 'لانشون بيتزا', description_ar: 'لانشون بيتزا عالي الجودة', unit_price: 50, effective_price: 45, image_url: 'assets/لانشون بيتزا.jpg', category_id: 3, category_name: 'لانشون', sale_type: 'fixed', sale_value: 45, stock_quantity: 28, low_stock_threshold: 5, is_active: true }],
        suppliers: [{ supplier_id: 1, full_name: 'أحمد محمود', phone: '01012345678', email: '', national_id: '29801010101234', vehicle_details: 'سيارة ربع نقل - س ص ع ١٢٣', is_available: true, is_activated: true }, { supplier_id: 2, full_name: 'محمد علي', phone: '01123456789', email: 'supplier@example.com', national_id: '29502020201234', vehicle_details: 'دراجة نارية - أ ب ج ٤٥٦', is_available: true, is_activated: false }],
        orders: [{ order_id: 'demo-1', order_number: 'TLG-20260827-A12B3C4D', customer_name: 'محمود السيد', customer_phone: '01002500273', customer_address_text: 'مدينة نصر، شارع الطيران، عمارة ١٢', admin_note: 'الاتصال بعد الساعة الخامسة', status: 'pending_assignment', total: 116, created_at: new Date().toISOString(), items: [{ item_id: 1, product_id: 'mc1', name: 'حليب كامل الدسم', quantity: 2, unit_price: 18, line_total: 36 }, { item_id: 2, product_id: 'ln1', name: 'لانشون بيتزا', quantity: 2, unit_price: 40, line_total: 80 }] }, { order_id: 'demo-2', order_number: 'TLG-20260827-E56F7G8H', customer_name: 'سارة محمد', customer_phone: '01111111111', customer_address_text: 'التجمع الخامس، الحي الأول', status: 'preparing', assigned_supplier_name: 'أحمد محمود', total: 180, created_at: new Date(Date.now() - 3600000).toISOString(), items: [{ item_id: 3, product_id: 'ch1', name: 'جبن شيدر', quantity: 4, unit_price: 40, line_total: 160 }] }, { order_id: 'demo-3', order_number: 'TLG-20260826-K91L2M3N', customer_name: 'عمر حسن', customer_phone: '01222222222', customer_address_text: 'المعادي، شارع ٩', status: 'completed', assigned_supplier_name: 'محمد علي', total: 250, created_at: new Date(Date.now() - 86400000).toISOString(), items: [{ item_id: 4, product_id: 'ln1', name: 'لانشون بيتزا', quantity: 5, unit_price: 50, line_total: 250 }] }]
    };

    function $(id) { return document.getElementById(id); }
    function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
    function normalizeDriveUrl(url = '') { const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/); return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url; }
    function toast(message, isError = false) { const element = $('admin-toast'); element.textContent = message; element.classList.toggle('error', isError); element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3500); }
    function openModal(id) { const modal = $(id); if (modal) modal.hidden = false; }
    function closeModals() { document.querySelectorAll('.modal-shell').forEach(modal => { modal.hidden = true; }); }
    function formatDate(value) { return value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
    function localDateTimeValue(value) { if (!value) return ''; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
    function isoDateTime(value) { return value ? new Date(value).toISOString() : null; }
    function normalizePhone(value = '') { let phone = String(value).trim().replace(/[^0-9+]/g, ''); if (phone.startsWith('00')) phone = `+${phone.slice(2)}`; return phone; }
    function setSubmitting(form, submitting, busyText) { const button = form.querySelector('button[type="submit"]'); if (!button) return; if (submitting) { button.dataset.label = button.textContent; button.textContent = busyText; button.disabled = true; } else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; } }
    function requireValue(form, field, message) { if ($(field).value.trim()) return true; formMessage(form, message, true); $(field).focus(); return false; }
    function statusPill(status) { return `<span class="status-pill status-${escapeHtml(status)}">${statusLabels[status] || escapeHtml(status)}</span>`; }
    async function api(path, options = {}) {
        if (previewMode) return null;
        const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
        let response;
        try { response = await fetch(`${apiBase}${path}`, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined }); }
        catch { throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.'); }
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) { token = ''; sessionStorage.removeItem('tallagtyAdminToken'); showLogin(); }
        if (!response.ok) throw new Error(payload.detail || `تعذر تنفيذ الطلب (${response.status})`);
        return payload;
    }

    function showLogin() { $('login-view').hidden = false; $('admin-app').hidden = true; }
    function showApp() { $('login-view').hidden = true; $('admin-app').hidden = false; }
    async function bootstrap() {
        if (previewMode) { Object.assign(state, structuredClone(demo)); $('preview-banner').hidden = false; showApp(); renderAll(); return; }
        if (!token) { showLogin(); return; }
        showApp(); await loadAll();
    }
    async function loadAll() {
        try {
            const [orders, products, categories, suppliers] = await Promise.all([api('/api/admin/orders'), api('/api/admin/products'), api('/api/admin/categories'), api('/api/admin/suppliers')]);
            state.orders = orders || []; state.products = products || []; state.categories = categories || []; state.suppliers = suppliers || []; renderAll();
        } catch (error) { toast(error.message, true); }
    }
    async function refreshView() {
        if (previewMode) { renderAll(); return; }
        const paths = { orders: '/api/admin/orders', products: '/api/admin/products', categories: '/api/admin/categories', suppliers: '/api/admin/suppliers', inventory: '/api/admin/products', reports: '/api/admin/orders' };
        const key = currentView === 'inventory' ? 'products' : currentView === 'reports' ? 'orders' : currentView;
        try { state[key] = await api(paths[currentView]); renderAll(); toast('تم تحديث البيانات'); } catch (error) { toast(error.message, true); }
    }

    function renderAll() { renderStats(); renderOrders(); renderProducts(); renderSales(); renderCategories(); renderSuppliers(); renderInventory(); renderReports(); fillSelects(); }
    function renderStats() {
        const count = status => state.orders.filter(order => order.status === status).length;
        const completed = state.orders.filter(order => order.status === 'completed');
        const sales = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
        $('stat-new').textContent = count('pending_assignment') + count('deferred_review'); $('stat-preparing').textContent = count('preparing') + count('assigned'); $('stat-delivery').textContent = count('out_for_delivery'); $('stat-sales').textContent = money.format(sales); $('new-orders-badge').textContent = count('pending_assignment');
    }
    function filteredOrders() {
        const term = $('order-search').value.trim().toLowerCase(), status = $('order-filter').value;
        return state.orders.filter(order => (!status || order.status === status) && (!term || [order.order_number, order.customer_name, order.customer_phone].some(value => String(value || '').toLowerCase().includes(term))));
    }
    function orderCard(order) {
        return `<article class="order-row"><div class="order-primary"><strong>${escapeHtml(order.order_number)}</strong><small>${formatDate(order.created_at)}</small></div><div class="order-customer"><strong>${escapeHtml(order.customer_name || '—')}</strong><small>${escapeHtml(order.customer_phone || '')}</small></div><div class="order-price">${money.format(Number(order.total || 0))}</div>${statusPill(order.status)}<button class="order-open" data-order-id="${escapeHtml(order.order_id)}" aria-label="فتح الطلب">←</button></article>`;
    }
    function renderOrders() { const list = filteredOrders(); $('orders-list').innerHTML = list.length ? list.map(orderCard).join('') : '<div class="empty-state">لا توجد طلبات مطابقة.</div>'; }
    function effectiveSale(product) { if (product.sale_type === 'percentage') return `${product.sale_value}% خصم`; if (product.sale_type === 'fixed') return money.format(Number(product.sale_value || 0)); return '—'; }
    function renderProducts() {
        $('products-body').innerHTML = state.products.length ? state.products.map(product => `<tr><td><div class="product-cell"><img src="${escapeHtml(normalizeDriveUrl(product.image_url) || fallbackImage)}" alt=""><div><strong>${escapeHtml(product.name_ar)}</strong><small>${escapeHtml(product.sku)}</small></div></div></td><td>${escapeHtml(product.category_name || 'بدون فئة')}</td><td>${salePrice(product) !== Number(product.unit_price) ? `<span class="old-price">${money.format(product.unit_price)}</span><br><span class="sale-price">${money.format(salePrice(product))}</span>` : money.format(product.unit_price)}</td><td>${effectiveSale(product)}</td><td>${Number(product.stock_quantity || 0) <= Number(product.low_stock_threshold || 0) ? `<strong style="color:var(--admin-danger)">${product.stock_quantity}</strong>` : product.stock_quantity}</td><td>${product.is_active ? '<span class="status-pill status-completed">متاح</span>' : '<span class="status-pill status-cancelled">موقوف</span>'}</td><td><div class="row-actions"><button class="small-btn primary" data-edit-product="${product.id}">تعديل المنتج</button></div></td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">لا توجد منتجات.</td></tr>';
    }
    function salePrice(product) {
        const regular = Number(product.unit_price || 0);
        if (product.sale_type === 'percentage') return Math.max(0, regular * (1 - Number(product.sale_value || 0) / 100));
        if (product.sale_type === 'fixed') return Math.max(0, Number(product.sale_value || 0));
        return regular;
    }
    function saleState(product) {
        const now = Date.now(), start = product.sale_start ? new Date(product.sale_start).getTime() : null, end = product.sale_end ? new Date(product.sale_end).getTime() : null;
        if (start && start > now) return { label: 'مجدول', className: 'scheduled' };
        if (end && end < now) return { label: 'منتهي', className: 'expired' };
        return { label: 'ساري الآن', className: '' };
    }
    function renderSales() {
        const sales = state.products.filter(product => product.sale_type && product.sale_type !== 'none');
        $('sales-count').textContent = `${sales.length} ${sales.length === 1 ? 'عرض' : 'عروض'}`;
        $('sales-preview-grid').innerHTML = sales.length ? sales.map(product => {
            const status = saleState(product);
            const period = product.sale_start || product.sale_end ? `${product.sale_start ? formatDate(product.sale_start) : 'الآن'} — ${product.sale_end ? formatDate(product.sale_end) : 'بدون نهاية'}` : 'العرض متاح بدون مدة محددة';
            return `<article class="sale-preview-card"><img src="${escapeHtml(normalizeDriveUrl(product.image_url) || fallbackImage)}" alt="${escapeHtml(product.name_ar)}"><div class="sale-preview-card__body"><h4>${escapeHtml(product.name_ar)}</h4><div class="sale-preview-card__price"><span class="old-price">${money.format(Number(product.unit_price || 0))}</span><strong class="sale-price">${money.format(salePrice(product))}</strong></div><span class="sale-preview-card__meta">${escapeHtml(effectiveSale(product))} · ${escapeHtml(period)}</span><footer><span class="sale-state ${status.className}">${status.label}</span><button class="small-btn" data-edit-sale="${product.id}">تعديل العرض</button></footer></div></article>`;
        }).join('') : '<div class="empty-state">لا توجد عروض مطبقة حالياً. اضغط «إضافة عرض» لإنشاء أول عرض.</div>';
    }
    function renderCategories() { $('categories-grid').innerHTML = state.categories.length ? state.categories.map(category => `<article class="category-admin-card ${category.image_url ? 'has-image' : ''}" ${category.image_url ? `style="background-image:url('${escapeHtml(normalizeDriveUrl(category.image_url))}')"` : ''}><h3>${escapeHtml(category.name_ar)}</h3><p>${escapeHtml(category.description_ar || 'بدون وصف')}</p><footer><span>${category.is_active ? 'ظاهرة' : 'مخفية'} · ترتيب ${category.sort_order || 0}</span><button class="small-btn" data-edit-category="${category.id}">تعديل</button></footer></article>`).join('') : '<div class="empty-state">لا توجد فئات.</div>'; }
    function renderSuppliers() { $('suppliers-body').innerHTML = state.suppliers.length ? state.suppliers.map(supplier => `<tr><td><strong>${escapeHtml(supplier.full_name)}</strong><br><small>${escapeHtml(supplier.email || 'بدون بريد')}</small></td><td>${escapeHtml(supplier.phone || '—')}</td><td>${escapeHtml(supplier.vehicle_details || '—')}</td><td>${supplier.is_activated ? '<span class="status-pill status-completed">مفعّل</span>' : '<span class="status-pill status-pending_assignment">بانتظار التفعيل</span>'}</td><td>${supplier.is_available ? 'متاح' : 'غير متاح'}</td><td><button class="small-btn primary" data-reset-device="${supplier.supplier_id}">إعادة ربط الهاتف</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">لم تتم إضافة موردين بعد.</td></tr>'; }
    function renderInventory() {
        const total = state.products.reduce((sum, product) => sum + Number(product.stock_quantity || 0), 0), low = state.products.filter(product => Number(product.stock_quantity || 0) <= Number(product.low_stock_threshold || 0)).length;
        $('inventory-total').textContent = total; $('inventory-low').textContent = low;
        $('inventory-body').innerHTML = state.products.length ? state.products.map(product => `<tr><td>${escapeHtml(product.name_ar)}</td><td>${product.stock_quantity || 0}</td><td>${product.low_stock_threshold || 0}</td><td>${formatDate(product.stock_updated_at)}</td><td><button class="small-btn primary" data-stock-product="${product.id}">إضافة حركة</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">لا توجد منتجات.</td></tr>';
    }
    function renderReports() { const completed = state.orders.filter(order => order.status === 'completed'), sales = completed.reduce((sum, order) => sum + Number(order.total || 0), 0); $('report-completed').textContent = completed.length; $('report-sales').textContent = money.format(sales); $('report-average').textContent = money.format(completed.length ? sales / completed.length : 0); $('completed-orders').innerHTML = completed.length ? completed.map(orderCard).join('') : '<div class="empty-state">لا توجد طلبات مكتملة.</div>'; }
    function fillSelects() { const categoryOptions = '<option value="">بدون فئة</option>' + state.categories.map(category => `<option value="${category.id}">${escapeHtml(category.name_ar)}</option>`).join(''); $('product-category').innerHTML = categoryOptions; const productOptions = state.products.map(product => `<option value="${product.id}">${escapeHtml(product.name_ar)} (${product.stock_quantity || 0})</option>`).join(''); $('stock-product').innerHTML = productOptions; $('sale-product').innerHTML = state.products.length ? state.products.map(product => `<option value="${product.id}">${escapeHtml(product.name_ar)} — ${money.format(Number(product.unit_price || 0))}</option>`).join('') : '<option value="">أضف منتجاً أولاً</option>'; }

    function showOrder(orderId) {
        const order = state.orders.find(candidate => String(candidate.order_id) === String(orderId)); if (!order) return;
        const canReview = ['pending_assignment', 'deferred_review'].includes(order.status), canAssign = order.status === 'approved';
        const suppliers = state.suppliers.filter(supplier => supplier.is_available && supplier.is_activated);
        $('order-modal-content').innerHTML = `<div class="order-detail-head"><div><span class="eyebrow">${escapeHtml(order.order_number)}</span><h2>مراجعة الطلب</h2></div>${statusPill(order.status)}</div><div class="order-detail-grid"><section class="detail-box"><h3>بيانات العميل</h3><label>الاسم<input id="review-name" value="${escapeHtml(order.customer_name || '')}" ${canReview ? '' : 'disabled'}></label><label>الهاتف<input id="review-phone" value="${escapeHtml(order.customer_phone || '')}" ${canReview ? '' : 'disabled'}></label><label>العنوان<textarea id="review-address" rows="2" ${canReview ? '' : 'disabled'}>${escapeHtml(order.customer_address_text || '')}</textarea></label></section><section class="detail-box"><h3>التشغيل</h3><p><strong>المورد:</strong> ${escapeHtml(order.assigned_supplier_name || 'لم يتم الإسناد')}</p><label>ملاحظات الإدارة<textarea id="review-note" rows="3" ${canReview ? '' : 'disabled'}>${escapeHtml(order.admin_note || '')}</textarea></label>${canAssign ? `<label>إسناد الطلب<select id="assign-supplier"><option value="">اختر المورد</option>${suppliers.map(supplier => `<option value="${supplier.supplier_id}">${escapeHtml(supplier.full_name)}</option>`).join('')}</select></label><label>طريقة الإسناد<select id="assignment-mode"><option value="whole">الطلب كاملاً لمورد واحد</option><option value="split">تقسيم الطلب بين موردين (إعداد متقدم)</option></select></label>` : ''}</section></div><section class="detail-box"><h3>تفاصيل الفاتورة</h3><table class="invoice-items"><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${(order.items || []).map((item, index) => `<tr><td>${escapeHtml(item.name)}</td><td>${canReview ? `<input class="review-quantity" data-index="${index}" type="number" min="1" value="${item.quantity}">` : item.quantity}</td><td>${canReview ? `<input class="review-price" data-index="${index}" type="number" min="0" step=".01" value="${item.unit_price}">` : money.format(item.unit_price)}</td><td>${money.format(item.line_total)}</td></tr>`).join('')}</tbody></table><p style="text-align:left;font-weight:800">الإجمالي: ${money.format(order.total)}</p></section><div class="workflow-actions">${canReview ? `<button class="btn btn-success" data-review-action="approved" data-id="${order.order_id}">تأكيد الطلب</button><button class="btn btn-warning" data-review-action="deferred_review" data-id="${order.order_id}">مؤجل للمراجعة</button><button class="btn btn-secondary" data-review-action="cancelled" data-id="${order.order_id}">رفض الطلب</button>` : ''}${canAssign ? `<button class="btn btn-primary" data-assign-order="${order.order_id}">إسناد للمورد</button>` : ''}<button class="btn btn-secondary" onclick="window.print()">طباعة الفاتورة</button></div>`;
        openModal('order-modal');
        if (canAssign) {
            const modeSelect = $('assignment-mode');
            const primarySupplier = $('assign-supplier').closest('label');
            const splitBox = document.createElement('div');
            splitBox.id = 'split-assignment-box';
            splitBox.hidden = true;
            primarySupplier.insertAdjacentElement('afterend', splitBox);
            modeSelect.addEventListener('change', () => {
                const split = modeSelect.value === 'split';
                primarySupplier.hidden = split;
                splitBox.hidden = !split;
                if (split) splitBox.innerHTML = '<p class="hint">اختر المورد المسؤول عن كل منتج.</p>' + order.items.map(item => '<label>' + escapeHtml(item.name) + ' × ' + item.quantity + '<select class="split-supplier" data-item-id="' + item.item_id + '" data-quantity="' + item.quantity + '"><option value="">اختر المورد</option>' + suppliers.map(supplier => '<option value="' + supplier.supplier_id + '">' + escapeHtml(supplier.full_name) + '</option>').join('') + '</select></label>').join('');
            });
        }
    }

    async function reviewOrder(orderId, decision) {
        const order = state.orders.find(candidate => candidate.order_id === orderId); if (!order) return;
        const body = { decision, customer_name: $('review-name').value.trim(), customer_phone: $('review-phone').value.trim(), customer_address_text: $('review-address').value.trim(), admin_note: $('review-note').value.trim(), items: order.items.map((item, index) => ({ product_id: item.product_id, quantity: Number(document.querySelector(`.review-quantity[data-index="${index}"]`).value), unit_price: Number(document.querySelector(`.review-price[data-index="${index}"]`).value) })) };
        try { if (previewMode) { Object.assign(order, { status: decision, customer_name: body.customer_name, customer_phone: body.customer_phone, customer_address_text: body.customer_address_text, admin_note: body.admin_note }); } else await api(`/api/admin/orders/${encodeURIComponent(orderId)}/review`, { method: 'PATCH', body }); closeModals(); await refreshView(); toast(decision === 'approved' ? 'تم تأكيد الطلب' : 'تم تحديث حالة الطلب'); } catch (error) { toast(error.message, true); }
    }
    async function assignOrder(orderId) { const supplierId = Number($('assign-supplier').value); if (!supplierId) { toast('اختر المورد أولاً', true); return; } try { if (previewMode) { const order = state.orders.find(candidate => candidate.order_id === orderId), supplier = state.suppliers.find(candidate => candidate.supplier_id === supplierId); order.status = 'assigned'; order.assigned_supplier_name = supplier.full_name; } else await api(`/api/admin/orders/${encodeURIComponent(orderId)}/assignment`, { method: 'PATCH', body: { supplier_id: supplierId, mode: $('assignment-mode').value } }); closeModals(); await refreshView(); toast('تم إسناد الطلب وإشعار المورد'); } catch (error) { toast(error.message, true); } }

    async function assignOrderAdvanced(orderId) {
        const mode = $('assignment-mode').value;
        let assignments = [];
        if (mode === 'split') {
            const grouped = new Map();
            for (const select of document.querySelectorAll('.split-supplier')) {
                const supplierId = Number(select.value);
                if (!supplierId) { toast('اختر مورداً لكل منتج', true); return; }
                if (!grouped.has(supplierId)) grouped.set(supplierId, []);
                grouped.get(supplierId).push({ order_item_id: Number(select.dataset.itemId), quantity: Number(select.dataset.quantity) });
            }
            assignments = Array.from(grouped, ([supplier_id, items]) => ({ supplier_id, items }));
        } else {
            const supplierId = Number($('assign-supplier').value);
            if (!supplierId) { toast('اختر المورد أولاً', true); return; }
            assignments = [{ supplier_id: supplierId, items: [] }];
        }
        try {
            if (previewMode) {
                const order = state.orders.find(candidate => candidate.order_id === orderId);
                const supplier = state.suppliers.find(candidate => candidate.supplier_id === assignments[0].supplier_id);
                order.status = 'assigned'; order.assigned_supplier_name = supplier.full_name;
            } else await api('/api/admin/orders/' + encodeURIComponent(orderId) + '/assignment', { method: 'PATCH', body: { assignments } });
            closeModals(); await refreshView(); toast('تم إسناد الطلب وإشعار المورد');
        } catch (error) { toast(error.message, true); }
    }
    function editProduct(id) { const product = state.products.find(item => Number(item.id) === Number(id)); if (!product) return; $('product-form').reset(); $('product-modal-title').textContent = 'تعديل بيانات المنتج'; $('product-id').value = product.id; $('product-sku').value = product.sku; $('product-name').value = product.name_ar; $('product-description').value = product.description_ar || ''; $('product-category').value = product.category_id || ''; $('product-price').value = product.unit_price; $('product-image').value = product.image_url || ''; $('product-stock').value = product.stock_quantity || 0; $('product-low-stock').value = product.low_stock_threshold || 0; $('product-active').checked = product.is_active; openModal('product-modal'); }
    function editSale(id) { const product = state.products.find(item => Number(item.id) === Number(id)); if (!product) return; $('sale-form').reset(); $('sale-modal-title').textContent = 'تعديل العرض'; $('sale-product').value = product.id; $('sale-product').disabled = true; $('sale-type').value = product.sale_type === 'fixed' ? 'fixed' : 'percentage'; $('sale-value').value = product.sale_value || ''; $('sale-start').value = localDateTimeValue(product.sale_start); $('sale-end').value = localDateTimeValue(product.sale_end); $('remove-sale').hidden = false; openModal('sale-modal'); }
    function editCategory(id) { const category = state.categories.find(item => Number(item.id) === Number(id)); if (!category) return; $('category-id').value = category.id; $('category-name').value = category.name_ar; $('category-slug').value = category.slug; $('category-description').value = category.description_ar || ''; $('category-image').value = category.image_url || ''; $('category-sort').value = category.sort_order || 0; $('category-active').checked = category.is_active; openModal('category-modal'); }
    function formMessage(form, message, error = false) { const element = form.querySelector('.form-message'); element.textContent = message; element.style.color = error ? 'var(--admin-danger)' : 'var(--admin-success)'; }
    async function saveProduct(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!requireValue(form, 'product-name', 'اكتب اسم المنتج أولاً')) return;
        const unitPrice = Number($('product-price').value);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) { formMessage(form, 'اكتب سعراً صحيحاً أكبر من صفر', true); $('product-price').focus(); return; }
        const stock = Number($('product-stock').value || 0), threshold = Number($('product-low-stock').value || 0);
        if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(threshold) || threshold < 0) { formMessage(form, 'المخزون وحد التنبيه يجب أن يكونا رقمين صحيحين', true); return; }
        const image = $('product-image').value.trim();
        if (image && !/^https?:\/\//i.test(image)) { formMessage(form, 'رابط الصورة يجب أن يبدأ بـ http:// أو https://', true); $('product-image').focus(); return; }
        const id = $('product-id').value, existing = state.products.find(item => String(item.id) === id);
        const generatedSku = `PRD-${Date.now().toString(36).toUpperCase()}`;
        const body = { sku: $('product-sku').value.trim() || generatedSku, name_ar: $('product-name').value.trim(), description_ar: $('product-description').value.trim(), category_id: $('product-category').value ? Number($('product-category').value) : null, unit_price: unitPrice, image_url: normalizeDriveUrl(image), sale_type: existing?.sale_type || 'none', sale_value: Number(existing?.sale_value || 0), sale_start: existing?.sale_start || null, sale_end: existing?.sale_end || null, stock_quantity: stock, low_stock_threshold: threshold, is_active: $('product-active').checked };
        setSubmitting(form, true, 'جاري الحفظ...'); formMessage(form, '', false);
        try { if (previewMode) { if (existing) Object.assign(existing, body, { category_name: state.categories.find(category => Number(category.id) === Number(body.category_id))?.name_ar || 'بدون فئة' }); else state.products.push({ ...body, id: Date.now(), category_name: state.categories.find(category => Number(category.id) === Number(body.category_id))?.name_ar, effective_price: body.unit_price }); } else await api(id ? `/api/admin/products/${id}` : '/api/admin/products', { method: id ? 'PATCH' : 'POST', body }); closeModals(); await refreshView(); toast(id ? 'تم تعديل المنتج بنجاح' : 'تمت إضافة المنتج بنجاح'); } catch (error) { formMessage(form, error.message, true); } finally { setSubmitting(form, false); }
    }
    function productUpdateBody(product, sale) { return { sku: product.sku, name_ar: product.name_ar, description_ar: product.description_ar || '', category_id: product.category_id || null, unit_price: Number(product.unit_price || 0), image_url: product.image_url || '', sale_type: sale.sale_type, sale_value: Number(sale.sale_value || 0), sale_start: sale.sale_start || null, sale_end: sale.sale_end || null, low_stock_threshold: Number(product.low_stock_threshold || 0), is_active: product.is_active !== false }; }
    async function saveSale(event) {
        event.preventDefault();
        const product = state.products.find(item => Number(item.id) === Number($('sale-product').value));
        if (!product) { formMessage(event.currentTarget, 'اختر منتجاً صالحاً', true); return; }
        const sale = { sale_type: $('sale-type').value, sale_value: Number($('sale-value').value), sale_start: isoDateTime($('sale-start').value), sale_end: isoDateTime($('sale-end').value) };
        if (sale.sale_type === 'percentage' && sale.sale_value > 100) { formMessage(event.currentTarget, 'نسبة الخصم لا يمكن أن تتجاوز 100%', true); return; }
        if (sale.sale_type === 'fixed' && sale.sale_value >= Number(product.unit_price)) { formMessage(event.currentTarget, 'السعر المخفض يجب أن يكون أقل من السعر الأساسي', true); return; }
        if (sale.sale_start && sale.sale_end && new Date(sale.sale_end) <= new Date(sale.sale_start)) { formMessage(event.currentTarget, 'نهاية العرض يجب أن تكون بعد بدايته', true); return; }
        try { if (previewMode) Object.assign(product, sale, { effective_price: sale.sale_type === 'fixed' ? sale.sale_value : Number(product.unit_price) * (1 - sale.sale_value / 100) }); else await api(`/api/admin/products/${product.id}`, { method: 'PATCH', body: productUpdateBody(product, sale) }); closeModals(); await refreshView(); toast('تم حفظ العرض ومعاينته'); } catch (error) { formMessage(event.currentTarget, error.message, true); }
    }
    async function removeSale() {
        const product = state.products.find(item => Number(item.id) === Number($('sale-product').value)); if (!product) return;
        try { const sale = { sale_type: 'none', sale_value: 0, sale_start: null, sale_end: null }; if (previewMode) Object.assign(product, sale, { effective_price: Number(product.unit_price) }); else await api(`/api/admin/products/${product.id}`, { method: 'PATCH', body: productUpdateBody(product, sale) }); closeModals(); await refreshView(); toast('تم إيقاف العرض'); } catch (error) { toast(error.message, true); }
    }
    async function saveCategory(event) { event.preventDefault(); const id = $('category-id').value, body = { name_ar: $('category-name').value.trim(), slug: $('category-slug').value.trim(), description_ar: $('category-description').value.trim(), image_url: normalizeDriveUrl($('category-image').value.trim()), sort_order: Number($('category-sort').value || 0), is_active: $('category-active').checked }; try { if (previewMode) { const existing = state.categories.find(item => String(item.id) === id); if (existing) Object.assign(existing, body); else state.categories.push({ ...body, id: Date.now() }); } else await api(id ? `/api/admin/categories/${id}` : '/api/admin/categories', { method: id ? 'PATCH' : 'POST', body }); closeModals(); await refreshView(); toast('تم حفظ الفئة'); } catch (error) { formMessage(event.currentTarget, error.message, true); } }
    async function saveSupplier(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!requireValue(form, 'supplier-name', 'اكتب الاسم الكامل للمندوب')) return;
        const phone = normalizePhone($('supplier-phone').value);
        if (!/^\+?[0-9]{7,15}$/.test(phone)) { formMessage(form, 'اكتب رقم هاتف صحيحاً من 7 إلى 15 رقماً', true); $('supplier-phone').focus(); return; }
        const email = $('supplier-email').value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { formMessage(form, 'البريد الإلكتروني غير صحيح، أو اتركه فارغاً', true); $('supplier-email').focus(); return; }
        if ($('supplier-password').value.length < 8) { formMessage(form, 'كلمة المرور يجب ألا تقل عن 8 أحرف', true); $('supplier-password').focus(); return; }
        if (!requireValue(form, 'supplier-national-id', 'اكتب الرقم القومي للمندوب')) return;
        if (!requireValue(form, 'supplier-vehicle', 'اكتب بيانات مركبة المندوب')) return;
        const body = { full_name: $('supplier-name').value.trim(), phone, email: email || null, password: $('supplier-password').value, national_id: $('supplier-national-id').value.trim(), vehicle_details: $('supplier-vehicle').value.trim(), business_name: $('supplier-name').value.trim() };
        setSubmitting(form, true, 'جاري إنشاء الحساب...'); formMessage(form, '', false);
        try { let result; if (previewMode) { result = { activation_code: '482915' }; state.suppliers.push({ supplier_id: Date.now(), ...body, is_available: true, is_activated: false }); } else { result = await api('/api/admin/suppliers', { method: 'POST', body }); state.suppliers = await api('/api/admin/suppliers'); } renderSuppliers(); $('supplier-activation-code').textContent = result.activation_code; $('supplier-activation-result').hidden = false; $('supplier-save-btn').hidden = true; form.querySelector('.form-grid').hidden = true; form.querySelector('.hint').hidden = true; toast('تم إنشاء حساب المورد بنجاح'); } catch (error) { formMessage(form, error.message, true); } finally { setSubmitting(form, false); }
    }
    async function saveStock(event) { event.preventDefault(); const body = { product_id: Number($('stock-product').value), movement_type: $('stock-type').value, quantity: Number($('stock-quantity').value), note: $('stock-note').value.trim() }; try { if (previewMode) { const product = state.products.find(item => item.id === body.product_id), sign = body.movement_type === 'adjustment_remove' ? -1 : 1; product.stock_quantity += sign * body.quantity; product.stock_updated_at = new Date().toISOString(); } else await api('/api/admin/inventory/movements', { method: 'POST', body }); closeModals(); await refreshView(); toast('تم تحديث المخزون'); } catch (error) { formMessage(event.currentTarget, error.message, true); } }
    async function resetDevice(supplierId) { if (!confirm('سيحتاج المورد إلى تفعيل هاتفه من جديد. هل تريد المتابعة؟')) return; try { if (!previewMode) await api(`/api/admin/suppliers/${supplierId}/reset-device`, { method: 'POST', body: {} }); const supplier = state.suppliers.find(item => item.supplier_id === supplierId); if (supplier) supplier.is_activated = false; renderSuppliers(); toast('تم فك ارتباط الهاتف'); } catch (error) { toast(error.message, true); } }

    document.addEventListener('click', event => {
        const nav = event.target.closest('[data-view]'); if (nav) { currentView = nav.dataset.view; document.querySelectorAll('.admin-nav__item').forEach(item => item.classList.toggle('active', item === nav)); document.querySelectorAll('.admin-view').forEach(view => view.classList.toggle('active', view.id === `view-${currentView}`)); $('view-title').textContent = viewTitles[currentView]; $('admin-sidebar').classList.remove('open'); }
        const modalButton = event.target.closest('[data-open-modal]'); if (modalButton) { const form = $(modalButton.dataset.openModal)?.querySelector('form'); if (form) { form.reset(); const message = form.querySelector('.form-message'); if (message) message.textContent = ''; } if (modalButton.dataset.openModal === 'product-modal') { $('product-id').value = ''; $('product-modal-title').textContent = 'إضافة منتج جديد'; $('product-active').checked = true; } if (modalButton.dataset.openModal === 'sale-modal') { $('sale-modal-title').textContent = 'إضافة عرض جديد'; $('sale-product').disabled = false; $('remove-sale').hidden = true; } if (modalButton.dataset.openModal === 'supplier-modal') { $('supplier-activation-result').hidden = true; $('supplier-save-btn').hidden = false; $('supplier-form').querySelector('.form-grid').hidden = false; $('supplier-form').querySelector('.hint').hidden = false; } if (modalButton.dataset.openModal === 'category-modal') $('category-id').value = ''; openModal(modalButton.dataset.openModal); }
        if (event.target.closest('[data-close-modal]') || (event.target.classList.contains('modal-shell'))) closeModals();
        const orderButton = event.target.closest('[data-order-id]'); if (orderButton) showOrder(orderButton.dataset.orderId);
        const review = event.target.closest('[data-review-action]'); if (review) reviewOrder(review.dataset.id, review.dataset.reviewAction);
        const assign = event.target.closest('[data-assign-order]'); if (assign) assignOrderAdvanced(assign.dataset.assignOrder);
        const product = event.target.closest('[data-edit-product]'); if (product) editProduct(product.dataset.editProduct);
        const sale = event.target.closest('[data-edit-sale]'); if (sale) editSale(sale.dataset.editSale);
        const category = event.target.closest('[data-edit-category]'); if (category) editCategory(category.dataset.editCategory);
        const stock = event.target.closest('[data-stock-product]'); if (stock) { $('stock-product').value = stock.dataset.stockProduct; openModal('stock-modal'); }
        const reset = event.target.closest('[data-reset-device]'); if (reset) resetDevice(Number(reset.dataset.resetDevice));
    });
    $('login-form').addEventListener('submit', async event => { event.preventDefault(); const status = $('login-status'); status.textContent = 'جاري تسجيل الدخول...'; try { const result = await api('/api/auth/login', { method: 'POST', body: { email: $('admin-email').value.trim(), password: $('admin-password').value } }); if (result.role !== 'admin') throw new Error('هذا الحساب ليس حساب إدارة'); token = result.access_token; sessionStorage.setItem('tallagtyAdminToken', token); status.textContent = ''; showApp(); await loadAll(); } catch (error) { status.textContent = error.message; } });
    $('product-form').addEventListener('submit', saveProduct); $('sale-form').addEventListener('submit', saveSale); $('remove-sale').addEventListener('click', removeSale); $('category-form').addEventListener('submit', saveCategory); $('supplier-form').addEventListener('submit', saveSupplier); $('stock-form').addEventListener('submit', saveStock);
    $('order-search').addEventListener('input', renderOrders); $('order-filter').addEventListener('change', renderOrders); $('refresh-current').addEventListener('click', refreshView); $('print-report').addEventListener('click', () => window.print()); $('mobile-menu').addEventListener('click', () => $('admin-sidebar').classList.toggle('open')); $('logout-btn').addEventListener('click', () => { token = ''; sessionStorage.removeItem('tallagtyAdminToken'); showLogin(); });
    $('today-label').textContent = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    bootstrap();
})();
