// FINAL SCRIPT WITH ALL FEATURES (INCLUDING PDF RECEIPT)
document.addEventListener('DOMContentLoaded', () => {

    const PRODUCTS_DATA = [
        { id: 'mc1', name: 'حليب كامل الدسم', price: 18.00, imageUrl: 'https://picsum.photos/400/400?random=30' },
        { id: 'mc2', name: 'قشدة طازجة', price: 22.00, imageUrl: 'https://picsum.photos/400/400?random=31' },
        { id: 'ch1', name: 'جبن شيدر', price: 40.00, imageUrl: 'https://picsum.photos/400/400?random=33' },
        { id: 'ch2', name: 'جبن موتزاريلا', price: 35.00, imageUrl: 'https://picsum.photos/400/400?random=34' },
        { id: 'ln1', name: 'لانشون بيتزا', price: 50.00, imageUrl: 'assets/لانشون بيتزا.jpg' },
        { id: 'ln2', name: 'لانشون لحم مدخن', price: 45.00, imageUrl: 'assets/لانشون لحم مدخن.jpg' },
        { id: 'ln3', name: 'لانشون كوردن بلو', price: 48.00, imageUrl: 'assets/لانشون كوردن بلو.jpg' },
        { id: 'ln4', name: 'لانشون فراخ مدخن', price: 52.00, imageUrl: 'assets/لانشون فراخ مدخن.jpg' },
        { id: 'ln5', name: 'لانشون سجق', price: 47.00, imageUrl: 'assets/لانشون سجق.jpg' },
        { id: 'ln6', name: 'لانشون بالفلفل الاسود', price: 46.00, imageUrl: 'assets/لانشون بالفلفل الاسود.jpg' },
        { id: 'ln7', name: 'لانشون ساده', price: 44.00, imageUrl: 'assets/لانشون ساده.jpg' },
        { id: 'ln8', name: 'لانشون ديك رومى', price: 49.00, imageUrl: 'assets/لانشون ديك رومى.jpg' }
    ];
    const PRODUCTS_MAP = Object.fromEntries(PRODUCTS_DATA.map(p => [p.id, p]));
    const currencyFmt = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' });

    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const allCartToggles = document.querySelectorAll('.nav__cart-btn, #cart-toggle');
    const cartCloseBtn = document.getElementById('cart-close');
    const cartBody = document.getElementById('cart-body');
    const cartCountEl = document.getElementById('cart-count');
    const cartSubtotalEl = document.getElementById('cart-subtotal');

    let cart = JSON.parse(localStorage.getItem('tallagtyCart')) || [];

    const saveCart = () => localStorage.setItem('tallagtyCart', JSON.stringify(cart));

    const openSidebar = (sidebar) => {
        if (!sidebar) return;
        sidebar.classList.add('active');
        cartOverlay.classList.add('active');
    };

    const closeAllSidebars = () => {
        document.querySelectorAll('.cart-sidebar.active, .modal-overlay.active').forEach(el => el.classList.remove('active'));
    };

    const updateCartInfo = () => {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cart.reduce((sum, item) => sum + (PRODUCTS_MAP[item.id]?.price || 0) * item.quantity, 0);
        if (cartCountEl) cartCountEl.textContent = String(totalItems);
        if (cartSubtotalEl) cartSubtotalEl.textContent = currencyFmt.format(subtotal);
    };

    const renderCart = () => {
        if (!cartBody) return;
        cartBody.innerHTML = '';

        if (cart.length === 0) {
            cartBody.innerHTML = `<p class="cart-sidebar__empty">سلة مشترياتك فارغة.</p>`;
            const footer = cartSidebar.querySelector('.cart-sidebar__footer');
            if (footer) footer.style.display = 'none';
        } else {
            const footer = cartSidebar.querySelector('.cart-sidebar__footer');
            if (footer) footer.style.display = 'block';

            cart.forEach(item => {
                const product = PRODUCTS_MAP[item.id];
                if (!product) return;
                const lineTotal = product.price * item.quantity;
                const cartItemHTML = `
                    <div class="cart-item" data-product-id="${item.id}">
                        <img src="${product.imageUrl}" alt="${product.name}" class="cart-item__img">
                        <div class="cart-item__details">
                            <h3 class="cart-item__title">${product.name}</h3>
                            <p class="cart-item__price">${currencyFmt.format(product.price)}</p>
                            <div class="cart-item__actions">
                                <div class="cart-item__quantity-controls">
                                    <button class="quantity-decrease" aria-label="Decrease quantity">-</button>
                                    <span class="cart-item__quantity">${item.quantity}</span>
                                    <button class="quantity-increase" aria-label="Increase quantity">+</button>
                                </div>
                                <span class="cart-item__line-total">${currencyFmt.format(lineTotal)}</span>
                            </div>
                        </div>
                        <button class="cart-item__remove" aria-label="Remove item">&times;</button>
                    </div>
                `;
                cartBody.insertAdjacentHTML('beforeend', cartItemHTML);
            });
        }
        updateCartInfo();
    };

    const addToCart = (productId) => {
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ id: productId, quantity: 1 });
        }
        saveCart();
        renderCart();
        openSidebar(cartSidebar);
    };

    const updateQuantity = (productId, newQuantity) => {
        const itemInCart = cart.find(item => item.id === productId);
        if (itemInCart) {
            if (newQuantity > 0) {
                itemInCart.quantity = newQuantity;
            } else {
                cart = cart.filter(item => item.id !== productId);
            }
            saveCart();
            renderCart();
        }
    };

    // --- PDF GENERATION & MODAL LOGIC (NEW FEATURE) ---
    function loadJsPDF(callback) {
        if (window.jspdf) return callback(window.jspdf);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => callback(window.jspdf);
        document.head.appendChild(script);
    }

    function generatePdfReceipt(orderData) {
        loadJsPDF(({ jsPDF }) => {
            const doc = new jsPDF();
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf'; // A font that supports more characters

            doc.setR2L(true);
            doc.setFontSize(22);
            doc.text("فاتورة طلب - تلاجتى", 105, 20, { align: 'center' });

            doc.setFontSize(12);
            doc.text(`رقم الطلب: ${orderData.order_id}`, 190, 40, { align: 'right' });
            doc.text(`اسم العميل: ${orderData.customer_name}`, 190, 50, { align: 'right' });
            doc.text(`رقم الهاتف: ${orderData.customer_phone}`, 190, 60, { align: 'right' });
            doc.text(`تاريخ الطلب: ${new Date().toLocaleString('ar-EG')}`, 190, 70, { align: 'right' });

            doc.line(20, 80, 190, 80);

            let y = 90;
            orderData.items.forEach(item => {
                const product = PRODUCTS_MAP[item.id];
                const lineText = `${(product.price * item.quantity).toFixed(2)} SAR  -  (الكمية: ${item.quantity})  ${product.name}`;
                doc.text(lineText, 190, y, { align: 'right' });
                y += 10;
            });

            doc.line(20, y, 190, y);

            doc.setFontSize(16);
            const totalText = `الإجمالي: ${currencyFmt.format(orderData.total)}`;
            doc.text(totalText, 190, y + 15, { align: 'right' });

            doc.save(`receipt-${orderData.order_id}.pdf`);
        });
    }

    function showDownloadModal(orderData) {
        if (!document.getElementById('receipt-modal')) {
            const modalHTML = `
                <div class="modal-overlay" id="receipt-modal-overlay">
                    <div class="modal">
                        <h2>تم تأكيد طلبك بنجاح!</h2>
                        <p>هل ترغب في تحميل نسخة من الفاتورة بصيغة PDF؟</p>
                        <div class="modal-actions">
                            <button id="download-pdf-btn" class="btn btn-primary">نعم، تحميل الفاتورة</button>
                            <button id="close-modal-btn" class="btn btn-secondary">لا، شكراً</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        const modalOverlay = document.getElementById('receipt-modal-overlay');
        const downloadBtn = document.getElementById('download-pdf-btn');
        const closeBtn = document.getElementById('close-modal-btn');

        modalOverlay.classList.add('active');

        downloadBtn.onclick = () => {
            generatePdfReceipt(orderData);
            modalOverlay.classList.remove('active');
        };

        closeBtn.onclick = () => {
            modalOverlay.classList.remove('active');
        };
    }

    // --- CHECKOUT LOGIC ---
    const createCheckoutSidebar = () => {
        if (document.getElementById('checkout-sidebar')) return;

        const checkoutHTML = `
            <div class="cart-sidebar" id="checkout-sidebar">
                <div class="cart-sidebar__header">
                    <h2>إتمام الطلب</h2>
                    <button class="cart-sidebar__close" id="checkout-close">&times;</button>
                </div>
                <div class="cart-sidebar__body">
                    <form id="order-form">
                        <div class="form-group">
                            <label for="customer-name">اسم العميل</label>
                            <input type="text" id="customer-name" required placeholder="أدخل اسمك" />
                        </div>
                        <div class="form-group">
                            <label for="customer-phone">رقم الهاتف</label>
                            <input type="tel" id="customer-phone" required placeholder="أدخل رقم الهاتف" />
                        </div>
                        <div class="form-group">
                            <label for="customer-address-text">عنوان التوصيل</label>
                            <textarea id="customer-address-text" rows="2" placeholder="اكتب عنوانك هنا"></textarea>
                        </div>
                        <div id="order-status" style="margin-top:1rem; font-weight: bold; display:none;"></div>
                        <button type="submit" class="btn btn-primary" id="submit-order-btn" style="width:100%; margin-top:1rem;">تأكيد الطلب</button>
                    </form>
                </div>
                 <div class="cart-sidebar__footer">
                    <button type="button" class="btn" id="back-to-cart-btn" style="width:100%; background-color: var(--text-muted); color:white;">الرجوع للسلة</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', checkoutHTML);

        document.getElementById('checkout-close').addEventListener('click', closeAllSidebars);
        document.getElementById('back-to-cart-btn').addEventListener('click', () => {
            closeAllSidebars();
            openSidebar(cartSidebar);
        });
        document.getElementById('order-form').addEventListener('submit', handleOrderSubmit);
    };

    const handleOrderSubmit = async (event) => {
        event.preventDefault();

        const submitBtn = document.getElementById('submit-order-btn');
        const statusEl = document.getElementById('order-status');

        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري إرسال الطلب...';
        statusEl.style.display = 'none';

        const itemsWithData = cart.map(item => ({ ...item, name: PRODUCTS_MAP[item.id]?.name || 'Unknown' }));
        const orderTotal = cart.reduce((sum, item) => sum + (PRODUCTS_MAP[item.id]?.price || 0) * item.quantity, 0);

        const orderPayload = {
            customer_name: document.getElementById('customer-name').value,
            customer_phone: document.getElementById('customer-phone').value,
            customer_address_text: document.getElementById('customer-address-text').value,
            items: itemsWithData,
            total: orderTotal,
            order_details: itemsWithData
        };

        try {
            const response = await fetch('/.netlify/functions/submit-order', {
                method: 'POST',
                body: JSON.stringify(orderPayload)
            });

            if (!response.ok) { throw new Error('Failed to submit order'); }

            const result = await response.json();
            orderPayload.order_id = result.order_id;

            cart = [];
            saveCart();
            renderCart();
            closeAllSidebars();
            document.getElementById('order-form').reset();

            showDownloadModal(orderPayload);

        } catch (error) {
            console.error('Order submission error:', error);
            statusEl.textContent = 'حدث خطأ. الرجاء المحاولة مرة أخرى.';
            statusEl.style.color = 'red';
            statusEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تأكيد الطلب';
        }
    };

    // --- EVENT LISTENERS ---
    document.addEventListener('click', (e) => {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            addToCart(addToCartBtn.dataset.productId);
        }

        const cartItemEl = e.target.closest('.cart-item');
        if (cartItemEl) {
            const productId = cartItemEl.dataset.productId;
            if (e.target.closest('.quantity-increase')) {
                updateQuantity(productId, cart.find(i => i.id === productId).quantity + 1);
            }
            if (e.target.closest('.quantity-decrease')) {
                updateQuantity(productId, cart.find(i => i.id === productId).quantity - 1);
            }
            if (e.target.closest('.cart-item__remove')) {
                updateQuantity(productId, 0);
            }
        }

        if (e.target.id === 'go-to-checkout-btn') {
            closeAllSidebars();
            openSidebar(document.getElementById('checkout-sidebar'));
        }
    });

    allCartToggles.forEach(btn => btn.addEventListener('click', () => openSidebar(cartSidebar)));
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeAllSidebars);
    if (cartOverlay) cartOverlay.addEventListener('click', closeAllSidebars);

    const setupCartFooter = () => {
        const footer = cartSidebar.querySelector('.cart-sidebar__footer');
        if (!footer) return;

        const oldForm = footer.querySelector('#checkout-form');
        if (oldForm) oldForm.remove();

        footer.innerHTML = `
            <div class="cart-sidebar__subtotal">
                <span>الإجمالي</span>
                <span id="cart-subtotal">$0.00</span>
            </div>
            <button class="btn btn-primary" id="go-to-checkout-btn" style="width:100%;">المتابعة لإتمام الطلب</button>
         `;
    };

    // --- INITIALIZATION ---
    setupCartFooter();
    renderCart();
    createCheckoutSidebar();
});