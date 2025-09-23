document.addEventListener('DOMContentLoaded', () => {

    // --- PRODUCT DATA ---
    const PRODUCTS_DATA = [
        { id: 'mc1', name: 'Whole Milk (Bulk)', price: 2.50, imageUrl: 'https://picsum.photos/400/400?random=30', description: 'Fresh, pasteurized whole milk. Price per gallon.' },
        { id: 'mc2', name: 'Heavy Cream (40%)', price: 15.00, imageUrl: 'https://picsum.photos/400/400?random=31', description: 'Rich, high-fat cream perfect for bakeries.' },
        { id: 'mc3', name: 'Skim Milk (Bulk)', price: 2.25, imageUrl: 'https://picsum.photos/400/400?random=32', description: 'Fat-free skim milk. Price per gallon.' },
        { id: 'ch1', name: 'Aged Cheddar Block', price: 8.50, imageUrl: 'https://picsum.photos/400/400?random=33', description: 'Sharp, nutty aged cheddar. Price per lb.' },
        { id: 'ch2', name: 'Fresh Mozzarella Log', price: 6.75, imageUrl: 'https://picsum.photos/400/400?random=34', description: 'Soft, milky mozzarella. Perfect for pizzerias.' },
        { id: 'ch3', name: 'Bulk Swiss Cheese', price: 7.20, imageUrl: 'https://picsum.photos/400/400?random=35', description: 'Classic holey swiss cheese, great for slicing.' },
        { id: 'yb1', name: 'Greek Yogurt Pail', price: 25.00, imageUrl: 'https://picsum.photos/400/400?random=36', description: 'Thick and creamy plain Greek yogurt.' },
        { id: 'yb2', name: 'Salted Butter Cases', price: 96.00, imageUrl: 'https://picsum.photos/400/400?random=37', description: 'European-style salted butter. Sold by the case.' },
    ];

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
            })
        })
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
            nextBtn.addEventListener('click', () => { nextSlide(); resetInterval(); });
            prevBtn.addEventListener('click', () => { prevSlide(); resetInterval(); });
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

    let cart = JSON.parse(localStorage.getItem('tallagtyCart')) || [];

    const saveCart = () => {
        localStorage.setItem('tallagtyCart', JSON.stringify(cart));
    };

    const openCart = () => {
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
    };

    const closeCart = () => {
        cartSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
    };

    const renderCart = () => {
        cartBody.innerHTML = '';
        if (cart.length === 0) {
            cartBody.innerHTML = '<p class="cart-sidebar__empty">Your cart is empty.</p>';
        } else {
            cart.forEach(item => {
                const cartItemHTML = `
                    <div class="cart-item" data-product-id="${item.id}">
                        <img src="${item.imageUrl}" alt="${item.name}" class="cart-item__img">
                        <div class="cart-item__details">
                            <h3 class="cart-item__title">${item.name}</h3>
                            <p class="cart-item__price">$${item.price.toFixed(2)}</p>
                            <div class="cart-item__actions">
                                <div class="cart-item__quantity-controls">
                                    <button class="quantity-decrease">-</button>
                                    <span class="cart-item__quantity">${item.quantity}</span>
                                    <button class="quantity-increase">+</button>
                                </div>
                            </div>
                        </div>
                        <button class="cart-item__remove">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.144-2.036-2.144H8.036C6.91 2.25 6 3.214 6 4.334v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
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
        
        cartCountEl.textContent = totalItems;
        cartSubtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    };

    const addToCart = (productId) => {
        const product = PRODUCTS_DATA.find(p => p.id === productId);
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

    // Event Listeners
    if (cartToggle) cartToggle.addEventListener('click', openCart);
    if (cartClose) cartClose.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    document.addEventListener('click', (e) => {
        // Add to Cart button
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            const productId = addToCartBtn.dataset.productId;
            addToCart(productId);

            // Visual feedback
            addToCartBtn.textContent = 'Added!';
            addToCartBtn.disabled = true;
            setTimeout(() => {
                addToCartBtn.textContent = 'Add to Cart';
                addToCartBtn.disabled = false;
            }, 2000);
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

    // Initial Render
    renderCart();

});
