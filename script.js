document.addEventListener('DOMContentLoaded', function () {
    // Cart state
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // Update cart count
    function updateCartCount() {
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartCount = document.getElementById('cart-count');
        if (cartCount) cartCount.textContent = count;
    }

    // Add product to cart
    function addToCart(productId, productName, productPrice, productImage) {
        const existing = cart.find(item => item.id === productId);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({
                id: productId,
                name: productName,
                price: productPrice,
                image: productImage,
                quantity: 1
            });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }

    // Render cart sidebar
    function renderCart() {
        const cartBody = document.getElementById('cart-body');
        const cartSubtotal = document.getElementById('cart-subtotal');
        if (!cartBody || !cartSubtotal) return;

        cartBody.innerHTML = '';
        let subtotal = 0;
        cart.forEach(item => {
            subtotal += item.price * item.quantity;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;margin-left:8px;">
                <span>${item.name}</span>
                <span> x${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
            `;
            cartBody.appendChild(div);
        });
        cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    }

    // Attach event listeners to all add-to-cart buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            // Find product card
            const card = btn.closest('.product-card');
            const productId = btn.getAttribute('data-product-id');
            const productName = card.querySelector('.product-card__title').textContent.trim();
            const productPrice = parseFloat(card.querySelector('.product-card__price').textContent.replace('$', ''));
            const productImage = card.querySelector('img').getAttribute('src');
            addToCart(productId, productName, productPrice, productImage);
        });
    });

    // Cart sidebar toggle
    const cartToggle = document.getElementById('cart-toggle');
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartClose = document.getElementById('cart-close');
    if (cartToggle && cartSidebar && cartOverlay) {
        cartToggle.addEventListener('click', function () {
            cartSidebar.classList.add('active');
            cartOverlay.classList.add('active');
        });
        cartClose.addEventListener('click', function () {
            cartSidebar.classList.remove('active');
            cartOverlay.classList.remove('active');
        });
        cartOverlay.addEventListener('click', function () {
            cartSidebar.classList.remove('active');
            cartOverlay.classList.remove('active');
        });
    }

    // Initial render
    updateCartCount();
    renderCart();
});