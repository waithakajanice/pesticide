function proceedToCheckout() {
    window.location.href = '/checkout';
}

function updateQuantity(id, quantity) {
    if (quantity < 1) {
        alert('Quantity must be at least 1.');
        return;
    }

    fetch('/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.message || 'Error updating quantity');
        }
    });
}

function removeFromCart(id) {
    fetch('/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.message || 'Error removing item');
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', function () {
            const id = this.getAttribute('data-product-id');
            const quantity = parseInt(this.value, 10);
            updateQuantity(id, quantity);
        });
    });

    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', function () {
            const id = this.getAttribute('data-product-id');
            removeFromCart(id);
        });
    });
});
