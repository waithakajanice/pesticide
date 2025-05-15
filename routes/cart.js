import express from 'express';
import pool from '../server.js';
import { fetchProductsFromDB } from '../server.js';

const router = express.Router();

// Initialize cart in session
router.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    next();
});

// Add item to cart
router.post('/add', async (req, res) => {
    const { id, quantity } = req.body;
    const userId = req.session.userId;

    if (!id || !quantity || !userId) {
        return res.status(400).json({ success: false, message: 'Invalid product ID, quantity, or user not logged in' });
    }

    const [rows] = await pool.query(
        'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, id]
    );

    if (rows.length > 0) {
        await pool.query(
            'UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
            [quantity, userId, id]
        );
    } else {
        await pool.query(
            'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
            [userId, id, quantity]
        );
    }

    res.json({ success: true });
});

// Update item quantity
router.post('/update', async (req, res) => {
    const { id, quantity } = req.body;
    const userId = req.session.userId;

    if (!id || !quantity || !userId || Number(quantity) < 1) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    await pool.query(
        'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
        [quantity, userId, id]
    );

    res.json({ success: true });
});

// Remove item from cart
router.post('/remove', async (req, res) => {
    const { id } = req.body;
    const userId = req.session.userId;

    if (!id || !userId) {
        return res.status(400).json({ success: false, message: 'Invalid product ID or user not logged in' });
    }

    await pool.query(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, id]
    );

    res.json({ success: true });
});

// Sync localStorage cart to session
router.post('/sync', (req, res) => {
    let { cart } = req.body;
    if (Array.isArray(cart)) {
        cart = cart.map(item => {
            if (typeof item === 'object' && item.id && item.quantity) {
                return { id: item.id, quantity: item.quantity };
            } else if (typeof item === 'number' || typeof item === 'string') {
                return { id: item, quantity: 1 };
            }
        });
        req.session.cart = cart;
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Invalid cart data' });
});

// View cart
router.get('/', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/');

    const [cartRows] = await pool.query(
        'SELECT product_id AS id, quantity FROM cart_items WHERE user_id = ?',
        [userId]
    );

    const DBproducts = (await fetchProductsFromDB()).map(product => ({
        ...product,
        price: Number(product.price)
    }));

    // Convert products to a lookup map for fast access in EJS
    const productMap = {};
    DBproducts.forEach(p => {
        productMap[p.id] = p;
    });

    res.render('cart.ejs', { cart: cartRows, productMap });
});

export default router;
