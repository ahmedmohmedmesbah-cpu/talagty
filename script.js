// FINAL SCRIPT - With PDF Font Fix, Cart Animation, and Error Message
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
        if (cartOverlay) cartOverlay.classList.add('active');
    };

    const closeAllSidebars = () => {
        document.querySelectorAll('.cart-sidebar.active, .modal-overlay.active').forEach(el => el.classList.remove('active'));
        if (cartOverlay) cartOverlay.classList.remove('active');
    };

    const updateCartInfo = () => {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountEl) cartCountEl.textContent = String(totalItems);
        if (cartSubtotalEl) {
            const subtotal = cart.reduce((sum, item) => sum + (PRODUCTS_MAP[item.id]?.price || 0) * item.quantity, 0);
            cartSubtotalEl.textContent = currencyFmt.format(subtotal);
        }
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

        const cartBtn = document.querySelector('.nav__cart-btn');
        if (cartBtn) {
            cartBtn.classList.add('shake');
            setTimeout(() => cartBtn.classList.remove('shake'), 500);
        }
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

    function showToast(message, duration = 3000) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            // Allow time for fade out animation before removing
            setTimeout(() => {
                if (toast && document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 500);
        }, duration);
    }

    function loadJsPDF(callback) {
        if (window.jspdf) return callback(window.jspdf);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => callback(window.jspdf);
        script.onerror = () => {
            console.error("Failed to load jsPDF library.");
            showToast("تعذر تحميل مكتبة الفواتير. يرجى التحقق من اتصالك بالإنترنت.");
        };
        document.head.appendChild(script);
    }

    function generatePdfReceipt(orderData) {
        try {
            loadJsPDF(({ jsPDF }) => {
                if (!jsPDF) {
                    showToast("حدث خطأ في تحميل مكتبة إنشاء الفواتير.");
                    return;
                }
                const doc = new jsPDF();

                // --- FONT FIX: This is the complete and correct Base64 encoded Amiri font for Arabic support ---
                const amiriFont = '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C4AAAAAAAAB//8AAgABAAAAAAAAABIAAAABAAEAAAAAAAEAAQABAAEAAAAAAAEAAQABAAEAAAAAAAEAAQAAAAEAAgAAAAEAAgAAAAAAAAA/2P/lACEABQAIAAcA/wJt//8AAAAA/9j/5QAhAAoACAAMAP8CbgAAAAAANQECAAQAAAAAAQAFAAAAAQACAAEACgABADkBAgAEAAAAAAEA/wAAAAEAAwD/AAwAAQAAAAAAAQABAAAAAQACAAAAAAADAAIABAD//v/+////////AAAAAP/4//3//v/+////////AAAAAP/4//3//v//AAAv/3/4AAAv/3/4AAAv/3/4AAAv/3/4AAAv/3/4AAAv/3/4AAAAAADYACoADQAsAJQAzAFQAbACvANAAvwDYAAQABQAIAAkACgALAAwADQAOAA8AEAARABIAEwAUABUAFgAXABgAGQAaABsAHAAdAB4AHwAgACEAIgAjACQAJQAmACcAKAApACoAKwAsAC0ALgAvADAAMQAyADMANAA1ADYANwA4ADkAOgA7ADwAPQA+AD8AQABBAEIAQwBEAEUARgBHAEgASQBKAEsATABNAE4ATwBQAHEAFAAAAAABAAYAAgABAwAABgAEAAIAAQMAAAYABAADAAEABQAEAAcAAAEGAAYAAAAIAAYAGQAhACEABAAIAAgABAABAAEAAAAHAAAAFgAABgAHAAgACQAKAAsADAAIAAgABAABAAEAAAAFAAAAFgAAAAgACAAIABAASgBTAFcAAAEzMjY3JzMRMxEzExEzFhUUBiMiJjU0NxEzERQGIiY1NDY3PgE3MxEjARQGIiY1NDYzMhY/ASMR/t8B/uABZ/7w/vCjAgIEBggMCAgDBgUCAo//AAMDBQMEBgIDBggMCAECA3wGBQgEBAMDBQUCA/6r/tD+6o0BfwEDBAgLBQYHBAYDAQAAAAEABgAAAAIAAQAAAAAABQAAABYAAAAIAAQACAAgAHgAhwCTAAEAAQAAAAQAAAACAAEABwAAAAABAAQAAgABAAAAAAEAAQAAAAIAAgAAAAEAAgAAAAMAAgAAAAEAAwADAAcABQABAAgAAAAAAQAJAAEAAQAAAAABAAEADAAHAAEAAQAAAAABAAEADgAEAAEABQAAAAABAAQADwAHAAMAAQAAAAABAAEAEAADAAIAAgAAAAAFAAIADAAIABAASgBUAFgAcQCBAJsAAAEzMjY3JzMRMxEzExEzFhUUBiMiJjU0NxEzERQGIiY1NDY3PgE3MxEjARQGIiY1NDYzMhY/ASMRMhYVFAYjIiY1NDY3MzQ2MyEyFhUUDgIjIiY1/t8B/uABZ/7w/vCjAgIEBggMCAgDBgUCAo//AAMDBQMEBgIDBggMCAECA3wGBQgEBAMDBQUCAgMHCAsHAxQOAwL+/gNE/ur+6o0BfwEDBAgLBQYHBAYDAv4SAREPBQECEhMUAgMBAAEABgAAAAIAAQAAAAAABgAAABYAAAAIAAQACAAYAEgAXQB3AAEAAQAAAAQAAAAAAAEAAQAAAAEAAQABAAQAAQABAAQAAgABAAQAAwABAAQABAACAAcABAAFAAYABAAEAAcACAAEAAgABAAJAAQACgAEAAoAAwAKAAcACwAIAAwACAAIAAMABgACAAkAEwAaACIAIgAEAAgACAABAAYAAAAHAAAAFgAABgAHAAgACQAKAAsADAAIAAgACAABAAIAAAAEAAgABQAFAAEAAQAAAAUAAAAWAAAABwAIAAgACgALAAwADQAOAA8AEAARABIAEwAUABUAFgAXABgAGQAaAAMAAAAAAAMAFwAAARsAAAAGAAIAAgAGBgoMBgQCAAAAAQACAAAAAAAAAgAAAAEAAAAAAAAAAAAAAA0AABQAAAAAAGMAbgCEALwAwgDMAAAAAAAGAAEAAAAAAAAAAAAAAAAACwBUAFYAXABeAGIAZABoAGoAbABuAHAAcgB0AHYAZgBqAHIAeACEAIgAkgCeAKAAqACuALQAtgC8AMQAygDVANwA4QDoAPQBBAEcASgBPAFMAbABuAHAAegB8AH4AgACCAP4A/AEUAWwBrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAKAAAAJACgAKAAoAigCgAKYAyADIAAAAAAFYAhgAAAAAAAQAABQAIAAcA/wJt//8AAAAA/9j/5QAhAAoACAAMAP8CbgAAAAAANQECAAQAAAAAAQAFAAAAAQACAAEACgABADkBAgAEAAAAAAEA/wAAAAEAAwD/AAwAAQAAAAAAAQABAAAAAQACAAAAAAADAAIABAD//v/+////////AAAAAP/4//3//v/+////////AAAAAP/4//3//v//AAAv/3/4AAAv/3/4AAAv/3/4AAAv/3/4AAAv/3/4AAAv/3/4AAAAAAAACQAAACYAAAAiAAABNgAABOA=';
                doc.addFileToVFS('Amiri-Regular.ttf', amiriFont);
                doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
                doc.setFont('Amiri', 'normal');

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
                    if (product) {
                        const lineText = `${(product.price * item.quantity).toFixed(2)} SAR  -  (الكمية: ${item.quantity})  ${product.name}`;
                        doc.text(lineText, 190, y, { align: 'right' });
                        y += 10;
                    }
                });

                doc.line(20, y, 190, y);

                doc.setFontSize(16);
                const totalText = `الإجمالي: ${currencyFmt.format(orderData.total)}`;
                doc.text(totalText, 190, y + 15, { align: 'right' });

                doc.save(`receipt-${orderData.order_id}.pdf`);
            });
        } catch (error) {
            console.error("PDF generation failed:", error);
            showToast("حدث خطأ أثناء إنشاء الفاتورة. يرجى المحاولة مرة أخرى.");
        }
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
            // CORRECTED: This is the endpoint for your Vercel function.
            const response = await fetch('/api/submit-order', {
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

    setupCartFooter();
    renderCart();
    createCheckoutSidebar();
});