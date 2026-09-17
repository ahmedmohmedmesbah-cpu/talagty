document.addEventListener('DOMContentLoaded', () => {

    let PRODUCTS_DATA = [
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
    let PRODUCTS_MAP = Object.fromEntries(PRODUCTS_DATA.map(p => [p.id, p]));
    const ORDER_API_BASE_URL = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
    const currencyFmt = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
    const pageFile = location.pathname.split('/').pop() || 'index.html';
    const isCategoryPage = /^category[123]\.html$/.test(pageFile);
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

    const mobileNav = document.createElement('nav');
    mobileNav.className = 'mobile-bottom-nav';
    mobileNav.setAttribute('aria-label', 'التنقل السريع');
    mobileNav.innerHTML = `
        <a href="index.html" ${!isCategoryPage ? 'aria-current="page"' : ''} aria-label="الرئيسية"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg><span>الرئيسية</span></a>
        <a href="index.html#categories" ${isCategoryPage ? 'aria-current="page"' : ''} aria-label="فئات المنتجات"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>الفئات</span></a>
        <a href="track.html" aria-label="متابعة طلباتي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10l3 3v15H4V3h3z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg><span>طلباتي</span></a>
        <button class="mobile-bottom-nav__cart" type="button" aria-label="فتح سلة المشتريات"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h2l2 11h12l2-8H6M9 20h.01M17 20h.01"/></svg><span>السلة</span><span class="mobile-bottom-nav__count" id="mobile-cart-count">0</span></button>`;
    document.body.appendChild(mobileNav);

    const productGrid = document.querySelector('.product-grid');
    if (productGrid && isCategoryPage) {
        const quickNav = document.createElement('nav');
        quickNav.className = 'category-quick-nav';
        quickNav.setAttribute('aria-label', 'التبديل بين الفئات');
        quickNav.innerHTML = [
            ['category1.html', 'ألبان'],
            ['category2.html', 'أجبان'],
            ['category3.html', 'لانشون']
        ].map(([href, label]) => `<a href="${href}" ${pageFile === href ? 'aria-current="page"' : ''}>${label}</a>`).join('');
        productGrid.before(quickNav);
    }

    const heroSlides = [...document.querySelectorAll('.hero-slider__slide')];
    const heroDots = document.querySelector('.hero-slider__dots');
    if (heroSlides.length > 1 && heroDots) {
        let activeSlide = 0;
        heroDots.innerHTML = heroSlides.map((_, index) => `<button class="hero-slider__dot" type="button" aria-label="عرض الشريحة ${index + 1}" data-slide="${index}"></button>`).join('');
        const showSlide = index => {
            activeSlide = (index + heroSlides.length) % heroSlides.length;
            heroSlides.forEach((slide, position) => {
                const active = position === activeSlide;
                slide.classList.toggle('active', active);
                slide.inert = !active;
                slide.setAttribute('aria-hidden', String(!active));
            });
            heroDots.querySelectorAll('button').forEach((dot, position) => {
                dot.classList.toggle('active', position === activeSlide);
                dot.setAttribute('aria-pressed', String(position === activeSlide));
            });
        };
        document.querySelector('.hero-slider__btn--prev')?.addEventListener('click', () => showSlide(activeSlide - 1));
        document.querySelector('.hero-slider__btn--next')?.addEventListener('click', () => showSlide(activeSlide + 1));
        heroDots.addEventListener('click', event => {
            const dot = event.target.closest('[data-slide]');
            if (dot) showSlide(Number(dot.dataset.slide));
        });
        showSlide(0);
    }

    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const allCartToggles = document.querySelectorAll('.nav__cart-btn, .mobile-bottom-nav__cart');
    const cartCloseBtn = document.getElementById('cart-close');
    const cartBody = document.getElementById('cart-body');
    const cartCountEl = document.getElementById('cart-count');
    const mobileCartCountEl = document.getElementById('mobile-cart-count');
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');

    let cart;
    try { cart = JSON.parse(localStorage.getItem('tallagtyCart')) || []; }
    catch { cart = []; }
    if (!Array.isArray(cart)) cart = [];

    const closeMobileMenu = () => {
        if (!navMenu || !navToggle) return;
        navMenu.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
    };

    if (navToggle && navMenu) {
        navToggle.setAttribute('aria-label', 'فتح قائمة التنقل');
        navToggle.setAttribute('aria-controls', 'nav-menu');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', String(isOpen));
        });
        navMenu.addEventListener('click', (event) => {
            if (event.target.closest('a')) closeMobileMenu();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMobileMenu();
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) closeMobileMenu();
        });
    }

    const saveCart = () => localStorage.setItem('tallagtyCart', JSON.stringify(cart));

    const openSidebar = (sidebar) => {
        if (!sidebar) return;
        sidebar.classList.add('active');
        if (cartOverlay) cartOverlay.classList.add('active');
        document.body.classList.add('store-sheet-open');
    };

    const closeAllSidebars = () => {
        document.querySelectorAll('.cart-sidebar.active, .modal-overlay.active').forEach(el => el.classList.remove('active'));
        if (cartOverlay) cartOverlay.classList.remove('active');
        document.body.classList.remove('store-sheet-open');
    };

    const updateCartInfo = () => {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountEl) cartCountEl.textContent = String(totalItems);
        if (mobileCartCountEl) mobileCartCountEl.textContent = String(totalItems);
        const cartSubtotalEl = document.getElementById('cart-subtotal');
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
                    <div class="cart-item" data-product-id="${escapeHtml(item.id)}">
                        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="cart-item__img">
                        <div class="cart-item__details">
                            <h3 class="cart-item__title">${escapeHtml(product.name)}</h3>
                            <p class="cart-item__price">${currencyFmt.format(product.price)}</p>
                            <div class="cart-item__actions">
                                <div class="cart-item__quantity-controls">
                                    <button class="quantity-decrease" type="button" aria-label="تقليل كمية ${escapeHtml(product.name)}">−</button>
                                    <span class="cart-item__quantity">${item.quantity}</span>
                                    <button class="quantity-increase" type="button" aria-label="زيادة كمية ${escapeHtml(product.name)}">+</button>
                                </div>
                                <span class="cart-item__line-total">${currencyFmt.format(lineTotal)}</span>
                            </div>
                        </div>
                        <button class="cart-item__remove" type="button" aria-label="حذف ${escapeHtml(product.name)} من السلة">&times;</button>
                    </div>
                `;
                cartBody.insertAdjacentHTML('beforeend', cartItemHTML);
            });
        }
        updateCartInfo();
    };

    const loadLiveCatalog = async () => {
        if (!ORDER_API_BASE_URL) return;
        try {
            const response = await fetch(`${ORDER_API_BASE_URL}/api/catalog`);
            if (!response.ok) return;
            const catalog = await response.json();
            PRODUCTS_DATA = (catalog.products || []).map(product => ({
                id: product.sku,
                name: product.name_ar,
                description: product.description_ar || '',
                price: Number(product.effective_price ?? product.unit_price),
                originalPrice: Number(product.unit_price),
                imageUrl: product.image_url || 'assets/لانشون.jpg',
                categorySlug: product.category_slug,
                stock: Number(product.available_stock ?? product.stock_quantity ?? 0)
            }));
            PRODUCTS_MAP = Object.fromEntries(PRODUCTS_DATA.map(product => [product.id, product]));
            cart = cart.filter(item => PRODUCTS_MAP[item.id]);
            saveCart();
            const pageCategory = { 'category1.html': 'dairy', 'category2.html': 'cheese', 'category3.html': 'luncheon' }[pageFile];
            const grid = document.querySelector('.product-grid');
            if (grid && pageCategory) {
                const products = PRODUCTS_DATA.filter(product => product.categorySlug === pageCategory);
                grid.innerHTML = products.length ? products.map(product => `
                    <article class="product-card">
                        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="product-card__image" loading="lazy">
                        <div class="product-card__content">
                            <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
                            <p class="product-card__desc">${escapeHtml(product.description)}</p>
                            <div class="product-card__footer">
                                <span class="product-card__price">${product.originalPrice !== product.price ? `<small style="display:block;text-decoration:line-through;color:#6b7280">${currencyFmt.format(product.originalPrice)}</small>` : ''}${currencyFmt.format(product.price)}</span>
                                <button class="btn btn-primary product-card__btn add-to-cart-btn" type="button" data-product-id="${escapeHtml(product.id)}" ${product.stock <= 0 ? 'disabled' : ''}>${product.stock <= 0 ? 'غير متوفر' : 'أضف إلى السلة'}</button>
                            </div>
                        </div>
                    </article>`).join('') : '<p class="cart-sidebar__empty">لا توجد منتجات متاحة في هذه الفئة.</p>';
            }
            renderCart();
        } catch (error) {
            console.warn('تعذر تحميل الكتالوج المباشر، سيتم عرض النسخة المحفوظة.', error);
        }
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

    function showToast(message, isSuccess = true) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;

        // Change color for success/error
        toast.style.backgroundColor = isSuccess ? '#22c55e' : '#ef4444';

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast && document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 500);
        }, 3000);
    }

    const createCheckoutSidebar = () => {
        if (document.getElementById('checkout-sidebar')) return;

        const checkoutHTML = `
            <div class="cart-sidebar" id="checkout-sidebar">
                <div class="cart-sidebar__header">
                    <h2>إتمام الطلب</h2>
                    <button class="cart-sidebar__close" id="checkout-close" type="button" aria-label="إغلاق إتمام الطلب">&times;</button>
                </div>
                <div class="cart-sidebar__body">
                    <form id="order-form">
                        <div class="form-group">
                            <label for="customer-name">اسم العميل</label>
                            <input type="text" id="customer-name" autocomplete="name" required placeholder="الاسم الكامل" />
                        </div>
                        <div class="form-group">
                            <label for="customer-phone">رقم الهاتف</label>
                            <input type="tel" id="customer-phone" inputmode="tel" autocomplete="tel" required placeholder="01xxxxxxxxx" />
                        </div>
                        <div class="form-group">
                            <label for="customer-address-text">عنوان التوصيل</label>
                            <textarea id="customer-address-text" rows="3" autocomplete="street-address" required placeholder="الشارع، رقم المبنى، المنطقة، المدينة"></textarea>
                        </div>
                        <p class="checkout-note">سيُراجع فريق تلاجتى طلبك ويتصل بك للتأكيد قبل تجهيزه.</p>
                        <div id="order-status" style="margin-top:1rem; font-weight: bold; display:none;"></div>
                        <button type="submit" class="btn btn-primary" id="submit-order-btn" style="width:100%; margin-top:1rem;">إرسال الطلب للمراجعة</button>
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

        const orderPayload = {
            customer_name: document.getElementById('customer-name').value.trim(),
            customer_phone: document.getElementById('customer-phone').value.trim(),
            customer_address_text: document.getElementById('customer-address-text').value.trim(),
            items: cart.map(item => ({ product_id: item.id, quantity: item.quantity }))
        };

        try {
            if (!ORDER_API_BASE_URL) throw new Error('Order API URL is not configured');
            const response = await fetch(`${ORDER_API_BASE_URL}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || 'تعذر إرسال الطلب. حاول مرة أخرى.');

            cart = [];
            saveCart();
            renderCart();
            closeAllSidebars();
            document.getElementById('order-form').reset();

            showToast(`تم إرسال طلبك للمراجعة. رقم الطلب: ${result.order_number}`, true);

        } catch (error) {
            console.error('Order submission error:', error);
            statusEl.textContent = error.message || 'حدث خطأ. الرجاء المحاولة مرة أخرى.';
            statusEl.style.color = 'red';
            statusEl.style.display = 'block';
            showToast('فشل إرسال الطلب. يرجى المحاولة مرة أخرى.', false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إرسال الطلب للمراجعة';
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
            <span id="cart-subtotal">${currencyFmt.format(0)}</span>
            </div>
            <button class="btn btn-primary" id="go-to-checkout-btn" style="width:100%;">المتابعة لإتمام الطلب</button>
         `;
    };

    setupCartFooter();
    renderCart();
    createCheckoutSidebar();
    loadLiveCatalog();
    if (new URLSearchParams(location.search).has('cart')) openSidebar(cartSidebar);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAllSidebars(); });
});
