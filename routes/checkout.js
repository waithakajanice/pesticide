import express from 'express';
import pool from '../server.js';
import { fetchProductsFromDB } from '../server.js';

const router = express.Router();

// Route to display the checkout page
router.get('/', async (req, res) => {
    const sessionCart = req.session.cart || [];
    // Normalize cart to array of { id, quantity }
    const cart = Array.isArray(sessionCart)
        ? sessionCart.map(item => ({
            id: typeof item === 'object' ? (item.productId || item.id) : item,
            quantity: typeof item === 'object' && item.quantity ? item.quantity : 1
        }))
        : [];
    // Fetch product details from the database
    
    // ...inside an async function or route handler
    const DBproducts = await fetchProductsFromDB();
    console.log(DBproducts); // This will be an array of product objects

    res.render('checkout.ejs', { cart, totalAmount: 0, DBproducts });
});

// Route to handle order submission
router.post('/submit', async (req, res) => {
    const userId = req.session.userId;
    const { name, address } = req.body;

    // Get cart items
    const [cartItems] = await pool.query(
        'SELECT product_id, quantity FROM cart_items WHERE user_id = ?',
        [userId]
    );

    if (!cartItems.length) {
        return res.status(400).send('Cart is empty.');
    }

    // Calculate total
    const [products] = await pool.query(
        `SELECT id, price FROM products WHERE id IN (${cartItems.map(() => '?').join(',')})`,
        cartItems.map(item => item.product_id)
    );
    let total = 0;
    const priceMap = {};
    products.forEach(p => priceMap[p.id] = Number(p.price));
    cartItems.forEach(item => {
        total += priceMap[item.product_id] * item.quantity;
    });

    // Insert order
    const [orderResult] = await pool.query(
        'INSERT INTO orders (user_id, total, name, address) VALUES (?, ?, ?, ?)',
        [userId, total, name, address]
    );
    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of cartItems) {
        await pool.query(
            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
            [orderId, item.product_id, item.quantity, priceMap[item.product_id]]
        );
    }

    // Clear cart
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    // Redirect or render receipt
    res.redirect(`/receipt/${orderId}`);
});

// Route to display the receipt page
router.get('/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [items] = await pool.query(
        `SELECT oi.quantity, oi.price, p.product 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`, [orderId]
    );
    res.render('receipt.ejs', {
        items,
        total: orderRows[0].total
    });
});

export default router;