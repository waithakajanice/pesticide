document.addEventListener('DOMContentLoaded', function() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    function updateCartDisplay() {
        const cartContainer = document.getElementById('cart-items');
        cartContainer.innerHTML = '';

        if (cart.length === 0) {
            cartContainer.innerHTML = '<p>Your cart is empty.</p>';
            document.getElementById('checkout-button').style.display = 'none';
            document.getElementById('total-price').textContent = '0.00';
            return;
        }

        let total = 0;

        cart.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div>${item.productName}</div>
                <div>Price: $${Number(item.price).toFixed(2)}</div>
                <div>
                    <input type="number" value="${item.quantity}" min="1" id="quantity-${index}">
                    <button onclick="updateQuantity(${index})">Update</button>
                    <button onclick="removeFromCart(${index})">Remove</button>
                </div>
            `;
            cartContainer.appendChild(itemDiv);
            total += Number(item.price) * Number(item.quantity);
        });

        document.getElementById('checkout-button').style.display = 'block';
        document.getElementById('total-price').textContent = total.toFixed(2);
    }

    window.addToCart = function(product) {
        const existingItemIndex = cart.findIndex(item => item.id === product.id);
        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
    };

    window.removeFromCart = function(index) {
        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
    };

    window.updateQuantity = function(index) {
        const quantityInput = document.getElementById(`quantity-${index}`);
        const newQuantity = parseInt(quantityInput.value);
        if (newQuantity > 0) {
            cart[index].quantity = newQuantity;
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartDisplay();
        }
    };

    document.getElementById('checkout-button').addEventListener('click', function() {
        window.location.href = '/checkout';
    });

    updateCartDisplay();
});

