import express from 'express';
import pool from '../server.js';
import { fetchProductsFromDB } from '../server.js';

const router = express.Router();

// Route to display the checkout page
router.get('/', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/'); // Or your login page
    }

    // Get cart items from DB
    const [cartItems] = await pool.query(
        'SELECT product_id AS id, quantity FROM cart_items WHERE user_id = ?',
        [userId]
    );

    // Fetch product details
    const DBproducts = await fetchProductsFromDB();

    // Prepare cart array for EJS
    const cart = cartItems.map(item => ({
        id: item.id,
        quantity: item.quantity
    }));

    res.render('checkout.ejs', { cart, DBproducts });
});

// Route to handle order submission
router.post('/submit', async (req, res) => {
    const userId = req.session.userId;
    const { name, address, email } = req.body;

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
        `SELECT id, price, quantity FROM products WHERE id IN (${cartItems.map(() => '?').join(',')})`,
        cartItems.map(item => item.product_id)
    );
    const priceMap = {};
    const stockMap = {};
    products.forEach(p => {
        priceMap[p.id] = Number(p.price);
        stockMap[p.id] = Number(p.quantity); // Use quantity for stock
    });

    let total = 0;
    for (const item of cartItems) {
        total += priceMap[item.product_id] * item.quantity;
    }

    // Check stock availability
    for (const item of cartItems) {
        if (stockMap[item.product_id] < item.quantity) {
            return res.status(400).send('Insufficient stock for one or more items.');
        }
    }

    // Insert order (now with email and correct total)
    const [orderResult] = await pool.query(
        'INSERT INTO orders (user_id, total, name, address, email) VALUES (?, ?, ?, ?, ?)',
        [userId, total, name, address, email]
    );
    const orderId = orderResult.insertId;

    // Insert order items and update stock
    for (const item of cartItems) {
        await pool.query(
            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
            [orderId, item.product_id, item.quantity, priceMap[item.product_id]]
        );
        await pool.query(
            'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
            [item.quantity, item.product_id, item.quantity]
        );
    }

    // Clear cart
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    // Redirect to invoice
    res.redirect(`/invoice/${orderId}`);
});

// Route to display the invoice page
router.get('/invoice/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orderRows[0];
    if (!order) {
        return res.status(404).send('Order not found');
    }
    order.total = Number(order.total); // Ensure total is a number
    const [items] = await pool.query(
        `SELECT oi.quantity, oi.price, oi.product_id, p.product 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`, [orderId]
    );
    items.forEach(item => item.price = Number(item.price));

    let email = order.email;
    if (!email) {
        const [userRows] = await pool.query('SELECT email FROM login WHERE id = ?', [order.user_id]);
        email = userRows[0]?.email || '';
    }
    res.render('invoice.ejs', {
        order: { ...order, email },
        items
    });
});

// Route to display all invoices for a user
router.get('/invoices', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.redirect('/login');

    const [orders] = await pool.query(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
    res.render('invoices.ejs', { orders });
});

// Mark order as received
router.post('/orders/:orderId/received', async (req, res) => {
    const { orderId } = req.params;
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['received', orderId]);
    res.redirect('/invoices');
});

// Cancel order
router.post('/orders/:orderId/cancel', async (req, res) => {
    const { orderId } = req.params;
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);
    res.redirect('/invoices');
});

// Route to display the receipt page
// NOTE: Keep this LAST to avoid route conflict
router.get('/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!orderRows.length) {
        return res.status(404).send('Order not found');
    }
    const [items] = await pool.query(
        `SELECT oi.quantity, oi.price, p.product 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`, [orderId]
    );
    // Convert price to number
    items.forEach(item => item.price = Number(item.price));
    res.render('receipt.ejs', {
        items,
        total: orderRows[0].total
    });
});

export default router;
