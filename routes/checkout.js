import express from 'express';
import pool from '../server.js';

const router = express.Router();

// Route to display the checkout page
router.get('/', (req, res) => {
    const cart = req.session.cart || [];
    const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    res.render('checkout.ejs', { cart, totalAmount });
});

// Route to handle order submission
router.post('/submit', async (req, res) => {
    const { name, address, paymentInfo } = req.body;
    const cart = req.session.cart || [];

    if (!name || !address || !paymentInfo) {
        return res.status(400).send('All fields are required.');
    }

    // Update product stock in the database
    try {
        for (const item of cart) {
            // Subtract purchased quantity from stock
            await pool.query(
                'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
                [item.quantity, item.id, item.quantity]
            );
        }
    } catch (err) {
        console.error('Error updating stock:', err);
        return res.status(500).send('Error updating stock.');
    }

    const orderDetails = {
        name,
        address,
        items: cart,
        totalAmount: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
        date: new Date()
    };

    // Save order to the database (pseudo code)
    // pool.query('INSERT INTO orders SET ?', orderDetails, (err, result) => { ... });

    // Make a copy of the cart before clearing
    const purchasedItems = [...cart];

    // Clear the cart after successful order submission
    req.session.cart = [];

    // Calculate total
    const total = purchasedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Render the receipt page
    res.render('receipt.ejs', { items: purchasedItems, total });
});

export default router;