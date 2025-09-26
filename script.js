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
    ];

    // Currency formatter
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    // --- LOAD PRODUCT OVERRIDES FROM localStorage (set via admin page) ---
    const loadProductOverrides = () => {
        try {
            const raw = localStorage.getItem('tallagtyProducts');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            // Ensure valid object structure { [id]: { price?: number, name?: string, imageUrl?: string, description?: string } }
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

    // --- SYNC DISPLAYED PRICES ON PRODUCT CARDS (so admin changes reflect on pages) ---
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
        // Close menu when a link is clicked
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

    const addToCart = (productId) => {
        const product = PRODUCTS_MAP[productId];
        if (!product) return;

        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
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
                // Visual feedback (Arabic)
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
                updateQuantity(productId, 0); // remove item
            }
        }
    });

    // Wire Proceed to Checkout button in cart sidebar (if present)
    // --- CHECKOUT SIDEBAR (Arabic) ---
    function getSupabaseConfig(){
        const url = (localStorage.getItem('tallagtySupabaseUrl')||'').trim() || 'https://evhqnshvlblkphzhcqql.supabase.co';
        const key = (localStorage.getItem('tallagtySupabaseAnonKey')||'').trim() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2aHFuc2h2bGJsa3BoemhjcXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDkxMzMsImV4cCI6MjA3NDQyNTEzM30.3SmewWKg9YeIGCvgwllGlpx6hP-sBro_IvcI65s3nXg';
        const table = (localStorage.getItem('tallagtySupabaseTable')||'orders').trim();
        return { url, key, table };
    }
    function isSupabaseConfigured(){
        const {url, key, table} = getSupabaseConfig();
        return !!(url && key && table);
    }
    async function sendOrderToSupabase(record){
        const {url, key, table} = getSupabaseConfig();
        const resp = await fetch(`${url}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
            },
            body: JSON.stringify(record)
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
    }
    function loadEmailJS(){
        return new Promise((resolve, reject) => {
            if (window.emailjs){
                try { window.emailjs.init('Z1Yvyx9A1Sve68L2c'); resolve(); } catch(e){ resolve(); }
                return;
            }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js';
            s.onload = () => { try { window.emailjs.init('Z1Yvyx9A1Sve68L2c'); resolve(); } catch(e){ resolve(); } };
            s.onerror = () => reject(new Error('Failed to load EmailJS'));
            document.head.appendChild(s);
        });
    }
    async function sendOrderEmail(params){
        await loadEmailJS();
        try {
            const res = await window.emailjs.send('service_iclrjoi','template_yxezw97', params);
            return res;
        } catch(e){ throw e; }
    }

    function ensureCheckoutSidebar(){
        if (document.getElementById('checkout-sidebar')) return;
        const overlay = document.createElement('div');
        overlay.id = 'checkout-overlay';
        overlay.className = 'cart-overlay';
        const sidebar = document.createElement('div');
        sidebar.id = 'checkout-sidebar';
        sidebar.className = 'cart-sidebar';
        sidebar.innerHTML = `
            <div class="cart-sidebar__header">
                <h2>إتمام الشراء</h2>
                <button class="cart-sidebar__close" id="checkout-close" aria-label="إغلاق">&times;</button>
            </div>
            <div class="cart-sidebar__body">
                <div class="form-group">
                    <label for="co-name">أسمك</label>
                    <input class="input" id="co-name" required />
                </div>
                <div class="form-group">
                    <label>عنوانك</label>
                    <div class="inline" style="margin-bottom:8px">
                        <label><input type="radio" name="addr_type" value="link" checked /> رابط خرائط جوجل</label>
                        <label><input type="radio" name="addr_type" value="text" /> وصف نصي</label>
                    </div>
                    <input class="input" id="co-address-link" placeholder="https://maps.google.com/..." />
                    <textarea class="input" id="co-address-text" rows="3" placeholder="وصف العنوان بالتفصيل" style="display:none;margin-top:8px"></textarea>
                </div>
                <div class="cart-sidebar__subtotal">
                    <span>المجموع</span>
                    <span id="co-subtotal">$0.00</span>
                </div>
                <div class="warning" id="co-msg" style="display:none"></div>
            </div>
            <div class="cart-sidebar__footer">
                <button class="btn btn-primary" id="co-submit" type="button">إرسال الطلب</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.appendChild(sidebar);
        // Events
        overlay.addEventListener('click', closeCheckoutSidebar);
        const closeBtn = sidebar.querySelector('#checkout-close');
        if (closeBtn) closeBtn.addEventListener('click', closeCheckoutSidebar);
        // Toggle address inputs
        sidebar.addEventListener('change', (e) => {
            if (e.target && e.target.name === 'addr_type'){
                const v = e.target.value;
                const linkEl = sidebar.querySelector('#co-address-link');
                const textEl = sidebar.querySelector('#co-address-text');
                if (v === 'link'){ linkEl.style.display = ''; textEl.style.display = 'none'; }
                else { linkEl.style.display = 'none'; textEl.style.display = ''; }
            }
        });
    }
    function openCheckoutSidebar(){
        ensureCheckoutSidebar();
        // Close cart if open to avoid overlap
        closeCart();
        const ov = document.getElementById('checkout-overlay');
        const sb = document.getElementById('checkout-sidebar');
        if (!ov || !sb) return;
        // update subtotal
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const formatter = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'USD' });
        const subtotalEl = sb.querySelector('#co-subtotal');
        if (subtotalEl) subtotalEl.textContent = formatter.format(subtotal);
        ov.classList.add('active');
        sb.classList.add('active');
        const msgEl = sb.querySelector('#co-msg');
        if (msgEl) { msgEl.style.display='none'; msgEl.textContent=''; }
        const submitBtn = sb.querySelector('#co-submit');
        if (submitBtn && !submitBtn._wired){
            submitBtn._wired = true;
            submitBtn.addEventListener('click', async () => {
                if (!cart || cart.length === 0){ alert('سلة التسوق فارغة.'); return; }
                const name = sb.querySelector('#co-name').value.trim();
                const addrType = sb.querySelector('input[name="addr_type"]:checked').value;
                const addrLink = sb.querySelector('#co-address-link').value.trim();
                const addrText = sb.querySelector('#co-address-text').value.trim();
                if (!name){ alert('يرجى إدخال الاسم'); return; }
                if (addrType === 'link' && !addrLink){ alert('يرجى إدخال رابط خرائط جوجل'); return; }
                if (addrType === 'text' && !addrText){ alert('يرجى وصف العنوان'); return; }

                submitBtn.disabled = true;
                submitBtn.textContent = '... جارٍ الإرسال';

                const orderId = 'ORD-' + Math.random().toString(36).slice(2,8).toUpperCase();
                const created_at = new Date().toISOString();
                const items = cart.map(({id,name,price,quantity}) => ({id,name,price,quantity}));
                const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);

                const record = {
                    id: orderId,
                    created_at,
                    total,
                    items,
                    customer_name: name,
                    customer_address_link: addrType==='link'?addrLink:null,
                    customer_address_text: addrType==='text'?addrText:null,
                };

                let dbOk = false, mailOk = false;
                try { await sendOrderToSupabase(record); dbOk = true; } catch(e){ dbOk = false; }
                try {
                    await sendOrderEmail({
                        order_id: orderId,
                        name,
                        address: addrType==='link'?addrLink:addrText,
                        order_total: total,
                        order_items: JSON.stringify(items)
                    });
                    mailOk = true;
                } catch(e){ mailOk = false; }

                if (dbOk && mailOk){
                    alert('تم إرسال الطلب بنجاح!');
                    // clear cart and close
                    cart = [];
                    saveCart();
                    renderCart();
                    closeCheckoutSidebar();
                } else {
                    alert('تعذر إرسال الطلب.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'إرسال الطلب';
                }
            });
        }
    }
    function closeCheckoutSidebar(){
        const ov = document.getElementById('checkout-overlay');
        const sb = document.getElementById('checkout-sidebar');
        if (ov) ov.classList.remove('active');
        if (sb) sb.classList.remove('active');
    }

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
            // Example: show a message, update cart count, etc.
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

// Checkout form handler
document.getElementById('checkout-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const statusEl = document.getElementById('order-status');
  statusEl.style.display = 'none';
  statusEl.style.color = 'red';

  // Collect form data
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const addressText = document.getElementById('customer-address-text').value.trim();
  const addressLink = document.getElementById('customer-address-link').value.trim();

  // Collect cart data
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('tallagtyCart')) || []; } catch {}
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Validate
  if (!name || !phone) {
    statusEl.textContent = 'يرجى إدخال الاسم ورقم الهاتف';
    statusEl.style.display = 'block';
    return;
  }
  if (cart.length === 0) {
    statusEl.textContent = 'سلة التسوق فارغة';
    statusEl.style.display = 'block';
    return;
  }

  // Disable button, show loading
  const btn = document.getElementById('submit-order-btn');
  btn.disabled = true;
  btn.textContent = '... جارٍ الإرسال';

  // Prepare order object
  const order = {
    customer_name: name,
    customer_phone: phone,
    customer_address_text: addressText,
    customer_address_link: addressLink,
    items: cart,
    total: total
  };

  // Supabase config
  const SUPABASE_URL = 'https://evhqnshvlblkphzhcqql.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2aHFuc2h2bGJsa3BoemhjcXFsIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NTg4NDkxMzMsImV4cCI6MjA3NDQyNTEzM30.3SmewWKg9YeIGCvgwllGlpx6hP-sBro_IvcI65s3nXg';
  const SUPABASE_TABLE = 'orders';

  let supabaseOk = false;
  let orderId = null;

  // Send to Supabase
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address_text: order.customer_address_text,
        customer_address_link: order.customer_address_link,
        items: JSON.stringify(order.items),
        total: order.total
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      supabaseOk = true;
      orderId = data[0]?.id || null;
    }
  } catch (err) {
    supabaseOk = false;
  }

  // Fallback: store in localStorage if Supabase fails
  if (!supabaseOk) {
    let fallbackOrders = [];
    try { fallbackOrders = JSON.parse(localStorage.getItem('fallbackOrders')) || []; } catch {}
    fallbackOrders.push({ ...order, created_at: new Date().toISOString() });
    localStorage.setItem('fallbackOrders', JSON.stringify(fallbackOrders));
  }

  // Send EmailJS notification
  try {
    await loadJsPDF(() => {});
    await emailjs.send('service_iclrjoi', 'template_yxezw97', {
      customer_name: name,
      customer_phone: phone,
      cart_items: formatCartItems(cart),
      total: total
    }, 'Z1Yvyx9A1Sve68L2c');
  } catch (err) {
    // Ignore email failure for user
  }

  // PDF receipt
  loadJsPDF(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('فاتورة الطلب', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`التاريخ: ${new Date().toLocaleString('ar-EG')}`, 20, 35);
    doc.text(`اسم العميل: ${name}`, 20, 45);
    doc.text(`رقم الهاتف: ${phone}`, 20, 55);
    doc.text(`العنوان: ${addressText || addressLink}`, 20, 65);
    doc.text('المحتويات:', 20, 75);
    let y = 85;
    cart.forEach(item => {
      doc.text(`${item.name} × ${item.quantity} = ${item.price * item.quantity} ريال`, 20, y);
      y += 10;
    });
    doc.text(`المجموع: ${total} ريال`, 20, y + 10);
    doc.save('order_receipt.pdf');
  });

  // Success message, clear cart
  statusEl.style.color = 'green';
  statusEl.textContent = 'تم إرسال الطلب بنجاح! سيتم تحميل الفاتورة.';
  statusEl.style.display = 'block';
  btn.disabled = false;
  btn.textContent = 'تأكيد الطلب';
  localStorage.setItem('tallagtyCart', '[]');
  setTimeout(() => {
    statusEl.style.display = 'none';
    btn.textContent = 'تأكيد الطلب';
  }, 4000);
});
