import express from 'express';
import pool from '../server.js';

const router = express.Router();

// Initialize cart in session
router.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    next();
});

// Add item to cart
router.post('/add', (req, res) => {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
        return res.status(400).json({ success: false, message: 'Invalid product ID or quantity' });
    }

    const itemIndex = req.session.cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        req.session.cart[itemIndex].quantity += quantity;
    } else {
        req.session.cart.push({ productId, quantity });
    }

    res.json({ success: true, cart: req.session.cart });
});

// Remove item from cart
router.post('/remove', (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    req.session.cart = req.session.cart.filter(item => item.productId !== productId);
    res.json({ success: true, cart: req.session.cart });
});

// Sync localStorage cart to session
router.post('/sync', (req, res) => {
    const { cart } = req.body;
    console.log('Received cart from client:', cart); // <-- Add this
    if (Array.isArray(cart)) {
        req.session.cart = cart;
        console.log('Session cart after sync:', req.session.cart); // <-- Add this
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Invalid cart data' });
});

// View cart
router.get('/', (req, res) => {
    const cart = req.session.cart || [];
    console.log('Rendering cart page with session cart:', cart); // <-- Add this
    const totalPrice = cart.reduce((total, item) => {
        // If item.price is undefined, default to 0
        return total + ((item.price || 0) * (item.quantity || 1));
    }, 0);
    res.render('cart.ejs', { cart, totalPrice });
});

export default router;