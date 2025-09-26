document.addEventListener('DOMContentLoaded', () => {

    // --- PRODUCT DATA (DEFAULTS) ---
    const DEFAULT_PRODUCTS = [
        { id: 'mc1', name: 'Whole Milk (Bulk)', price: 2.50, imageUrl: 'https://picsum.photos/400/400?random=30', description: 'Fresh, pasteurized whole milk. Price per gallon.' },
        { id: 'mc2', name: 'Heavy Cream (40%)', price: 15.00, imageUrl: 'https://picsum.photos/400/400?random=31', description: 'Rich, high-fat cream perfect for bakeries.' },
        { id: 'mc3', name: 'Skim Milk (Bulk)', price: 2.25, imageUrl: 'https://picsum.photos/400/400?random=32', description: 'Fat-free skim milk. Price per gallon.' },
        { id: 'ch1', name: 'Aged Cheddar Block', price: 8.50, imageUrl: 'https://picsum.photos/400/400?random=33', description: 'Sharp, nutty aged cheddar. Price per lb.' },
        { id: 'ch2', name: 'Fresh Mozzarella Log', price: 6.75, imageUrl: 'https://picsum.photos/400/400?random=34', description: 'Soft, milky mozzarella. Perfect for pizzerias.' },
        { id: 'ch3', name: 'Bulk Swiss Cheese', price: 7.20, imageUrl: 'https://picsum.photos/400/400?random=35', description: 'Classic holey swiss cheese, great for slicing.' },
        { id: 'yb1', name: 'Greek Yogurt Pail', price: 25.00, imageUrl: 'https://picsum.photos/400/400?random=36', description: 'Thick and creamy plain Greek yogurt.' },
        { id: 'yb2', name: 'Salted Butter Cases', price: 96.00, imageUrl: 'https://picsum.photos/400/400?random=37', description: 'European-style salted butter. Sold by the case.' },
        // === Category3: لانشون products ===
        { id: 'ln1', name: 'لانشون بيتزا', price: 50.00, imageUrl: 'assets/لانشون بيتزا.jpg', description: 'لانشون بيتزا عالي الجودة غني بالمكونات الطبيعية.' },
        { id: 'ln2', name: 'لانشون لحم مدخن', price: 45.00, imageUrl: 'assets/لانشون لحم مدخن.jpg', description: 'لانشون لحم مدخن غني بالنكهة المدخنة.' },
        { id: 'ln3', name: 'لانشون كوردن بلو', price: 48.00, imageUrl: 'assets/لانشون كوردن بلو.jpg', description: 'لانشون كوردن بلو بنكهة مميزة.' },
        { id: 'ln4', name: 'لانشون فراخ مدخن', price: 52.00, imageUrl: 'assets/لانشون فراخ مدخن.jpg', description: 'لانشون فراخ مدخن بطعم رائع.' },
        { id: 'ln5', name: 'لانشون سجق', price: 47.00, imageUrl: 'assets/لانشون سجق.jpg', description: 'لانشون سجق بقطع السجق الشهية.' },
        { id: 'ln6', name: 'لانشون بالفلفل الاسود', price: 46.00, imageUrl: 'assets/لانشون بالفلفل الاسود.jpg', description: 'لانشون بالفلفل الأسود الحار.' },
        { id: 'ln7', name: 'لانشون ساده', price: 44.00, imageUrl: 'assets/لانشون ساده.jpg', description: 'لانشون سادة بدون إضافات.' },
        { id: 'ln8', name: 'لانشون ديك رومى', price: 49.00, imageUrl: 'assets/لانشون ديك رومى.jpg', description: 'لانشون ديك رومى بطعم مميز.' }
    ];

    // Currency formatter
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    // --- LOAD PRODUCT OVERRIDES FROM localStorage (set via admin page) ---
    const loadProductOverrides = () => {
        try {
            const raw = localStorage.getItem('tallagtyProducts');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            console.warn('Failed to parse tallagtyProducts from localStorage:', e);
            return {};
        }
    };

    const buildProducts = () => {
        const overrides = loadProductOverrides();
        const merged = DEFAULT_PRODUCTS.map(p => ({ ...p, ...(overrides[p.id] || {}) }));
        return merged;
    };

    let PRODUCTS_DATA = buildProducts();
    let PRODUCTS_MAP = Object.fromEntries(PRODUCTS_DATA.map(p => [p.id, p]));

    // === CART & PRODUCT HELPERS ===
    function findProduct(productIdOrSlug) {
        let product = PRODUCTS_MAP[productIdOrSlug];
        if (product) return product;
        return PRODUCTS_DATA.find(p =>
            p.slug === productIdOrSlug ||
            p.name === productIdOrSlug ||
            p.id === productIdOrSlug
        );
    }

    // ✅ Fix: use imageUrl for cart item image
    function createCartItem(productIdOrSlug, quantity = 1) {
        const product = findProduct(productIdOrSlug);
        if (!product) return null;
        return {
            id: product.id,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl, // fixed
            quantity: quantity
        };
    }

    function formatCartItemsForEmail(cart) {
        return cart.map(item =>
            `${item.name} x${item.quantity} (${item.price} ريال)`
        ).join('\n');
    }

    function calculateCartTotal(cart) {
        return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    // --- SYNC DISPLAYED PRICES ON PRODUCT CARDS ---
    const syncDisplayedProductPrices = () => {
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            const productId = btn.dataset.productId;
            const product = PRODUCTS_MAP[productId];
            if (!product) return;
            const priceEl = btn.closest('.product-card__footer')?.querySelector('.product-card__price');
            if (priceEl) {
                priceEl.textContent = currencyFmt.format(product.price);
            }
        });
    };

    // --- MOBILE NAVIGATION ---
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }

    // --- HERO SLIDER ---
    const slider = document.querySelector('.hero-slider');
    if (slider) {
        const slides = slider.querySelectorAll('.hero-slider__slide');
        const nextBtn = slider.querySelector('.hero-slider__btn--next');
        const prevBtn = slider.querySelector('.hero-slider__btn--prev');
        const dotsContainer = slider.querySelector('.hero-slider__dots');
        let currentSlide = 0;
        let slideInterval;

        const createDots = () => {
            slides.forEach((_, i) => {
                const dot = document.createElement('button');
                dot.classList.add('hero-slider__dot');
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => {
                    goToSlide(i);
                    resetInterval();
                });
                dotsContainer.appendChild(dot);
            });
        };

        const goToSlide = (slideIndex) => {
            slides.forEach((slide, i) => {
                slide.classList.remove('active');
                dotsContainer.children[i].classList.remove('active');
            });
            slides[slideIndex].classList.add('active');
            dotsContainer.children[slideIndex].classList.add('active');
            currentSlide = slideIndex;
        };

        const nextSlide = () => {
            const newIndex = (currentSlide + 1) % slides.length;
            goToSlide(newIndex);
        };
        
        const prevSlide = () => {
            const newIndex = (currentSlide - 1 + slides.length) % slides.length;
            goToSlide(newIndex);
        };

        const resetInterval = () => {
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, 5000);
        };

        if (slides.length > 0) {
            createDots();
            if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetInterval(); });
            if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetInterval(); });
            slideInterval = setInterval(nextSlide, 5000);
        }
    }

    // --- SHOPPING CART ---
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartToggle = document.getElementById('cart-toggle');
    const cartClose = document.getElementById('cart-close');
    const cartBody = document.getElementById('cart-body');
    const cartCountEl = document.getElementById('cart-count');
    const cartSubtotalEl = document.getElementById('cart-subtotal');

    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('tallagtyCart')) || [];
    } catch (_) {
        cart = [];
    }

    const saveCart = () => {
        localStorage.setItem('tallagtyCart', JSON.stringify(cart));
    };

    const openCart = () => {
        if (!cartSidebar || !cartOverlay) return;
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
    };

    const closeCart = () => {
        if (!cartSidebar || !cartOverlay) return;
        cartSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
    };

    const renderCart = () => {
        if (!cartBody) return;
        cartBody.innerHTML = '';
        if (cart.length === 0) {
            cartBody.innerHTML = '<p class="cart-sidebar__empty">Your cart is empty.</p>';
        } else {
            cart.forEach(item => {
                const lineTotal = item.price * item.quantity;
                const cartItemHTML = `
                    <div class="cart-item" data-product-id="${item.id}">
                        <img src="${item.imageUrl}" alt="${item.name}" class="cart-item__img">
                        <div class="cart-item__details">
                            <h3 class="cart-item__title">${item.name}</h3>
                            <p class="cart-item__price">${currencyFmt.format(item.price)} • <span class="cart-item__line">${currencyFmt.format(lineTotal)}</span></p>
                            <div class="cart-item__actions">
                                <div class="cart-item__quantity-controls">
                                    <button class="quantity-decrease" type="button" aria-label="Decrease quantity">-</button>
                                    <span class="cart-item__quantity">${item.quantity}</span>
                                    <button class="quantity-increase" type="button" aria-label="Increase quantity">+</button>
                                </div>
                            </div>
                        </div>
                        <button class="cart-item__remove" type="button" aria-label="Remove item">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.144-2.036-2.144H8.036C6.91 2.25 6 3.214 6 4.334v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                        </button>
                    </div>
                `;
                cartBody.insertAdjacentHTML('beforeend', cartItemHTML);
            });
        }
        updateCartInfo();
    };

    const updateCartInfo = () => {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (cartCountEl) cartCountEl.textContent = String(totalItems);
        if (cartSubtotalEl) cartSubtotalEl.textContent = currencyFmt.format(subtotal);
    };

    // === [Replace addToCart function with fallback lookup] ===
    const addToCart = (productIdOrSlug) => {
        const product = findProduct(productIdOrSlug);
        if (!product) return;

        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            // Use createCartItem to ensure imageUrl is set
            cart.push({ ...createCartItem(product.id), quantity: 1 });
        }
        saveCart();
        renderCart();
        openCart();
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

    // Initialize Arabic labels for add-to-cart buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.textContent = 'أضف ألي السله';
    });

    // Event Listeners for Cart
    if (cartToggle) cartToggle.addEventListener('click', openCart);
    if (cartClose) cartClose.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    document.addEventListener('click', (e) => {
        // Add to Cart button (only real add buttons)
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            const productId = addToCartBtn.dataset.productId;
            if (productId) {
                addToCart(productId);
                addToCartBtn.textContent = 'تمت الاضافه';
                addToCartBtn.disabled = true;
                setTimeout(() => {
                    addToCartBtn.textContent = 'أضف ألي السله';
                    addToCartBtn.disabled = false;
                }, 1500);
            }
        }

        // Cart quantity controls
        const cartItemEl = e.target.closest('.cart-item');
        if (cartItemEl) {
            const productId = cartItemEl.dataset.productId;
            const itemInCart = cart.find(item => item.id === productId);

            if (e.target.closest('.quantity-increase')) {
                updateQuantity(productId, itemInCart.quantity + 1);
            }
            if (e.target.closest('.quantity-decrease')) {
                updateQuantity(productId, itemInCart.quantity - 1);
            }
            if (e.target.closest('.cart-item__remove')) {
                updateQuantity(productId, 0);
            }
        }
    });

    // --- CHECKOUT SYSTEM ---
    // Ensure checkout sidebar is created early
    ensureCheckoutSidebar();

    // Hook order form submit (for #orderForm)
    document.addEventListener('submit', async function(e) {
        const form = e.target;
        if (form.id === 'orderForm') {
            e.preventDefault();

            if (!cart || cart.length === 0) {
                alert('سلة التسوق فارغة.');
                return;
            }

            const name = form.querySelector('input[name="customer_name"]').value.trim();
            const phone = form.querySelector('input[name="customer_phone"]').value.trim();

            if (!name || !phone) {
                alert('الرجاء إدخال الاسم ورقم الهاتف.');
                return;
            }

            const orderRecord = {
                customer_name: name,
                customer_phone: phone,
                items: cart,
                total: calculateCartTotal(cart)
            };

            try {
                if (isSupabaseConfigured()) {
                    await sendOrderToSupabase(orderRecord);
                }
                await sendOrderEmail({
                    customer_name: name,
                    customer_phone: phone,
                    order_details: formatCartItems(cart),
                    total: calculateCartTotal(cart) + " ريال"
                });

                loadJsPDF(() => {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    doc.text(`فاتورة الطلب\n\n${formatCartItems(cart)}\n\nالإجمالي: ${calculateCartTotal(cart)} ريال`, 10, 10);
                    doc.save("فاتورة.pdf");
                });

                alert('تم إرسال الطلب بنجاح!');
                cart = [];
                saveCart();
                renderCart();
                closeCart();

            } catch (err) {
                console.error(err);
                alert('حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.');
            }
        }
    });

    // --- ensureCheckoutSidebar (already implemented above) ---

    // Hook the existing cart checkout button
    const checkoutBtn = document.querySelector('.cart-sidebar__footer .btn.btn-primary');
    if (checkoutBtn) {
        checkoutBtn.textContent = 'إتمام الشراء';
        checkoutBtn.setAttribute('type', 'button');
        checkoutBtn.addEventListener('click', () => {
            if (!cart || cart.length === 0) {
                alert('سلة التسوق فارغة.');
                return;
            }
            openCheckoutSidebar();
        });
    }

    // Initial Render and price sync
    renderCart();
    syncDisplayedProductPrices();
    document.querySelectorAll('.nav__cart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelector('.cart-overlay').classList.add('active');
            document.querySelector('.cart-sidebar').classList.add('active');
        });
    });
    
    document.querySelectorAll('.product-card__btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Your logic to add product to cart
        });
    });
});

// === [Paste at the very end of script.js] ===

// jsPDF loader (only loads if needed)
function loadJsPDF(callback) {
    if (window.jspdf) return callback();
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = callback;
    document.body.appendChild(script);
}

// Helper: Format items for EmailJS and PDF
function formatCartItems(cart) {
    return cart.map(item => `${item.name} × ${item.quantity} = ${item.price * item.quantity} ريال`).join('\n');
}

// --- REMOVE OLD CHECKOUT HANDLER ---
// document.getElementById('checkout-form')?.addEventListener('submit', async function(e) {
//   // ... old logic ...
// });
