import express from 'express';
const router = express.Router();
import pool from '../server.js';

// Show update form
router.get('/update/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        
        if (!rows.length) {
            req.flash('error', 'Product not found');
            return res.redirect('/adminview');
        }
        
        res.render('updateproduct.ejs', { 
            product: rows[0],
            messages: req.flash()
        });
    } catch (err) {
        console.error('Error fetching product:', err);
        req.flash('error', 'Failed to load product');
        res.redirect('/adminview');
    }
});

// Handle update form submission
router.post('/update/:id', async (req, res) => {
    const { product, price, dosage, description, target, quantity } = req.body;
    
    if (quantity < 0) {
        req.flash('error', 'Quantity must be a positive number');
        return res.redirect(`/update/${req.params.id}`);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        await conn.query(
            `UPDATE products 
             SET product = ?, price = ?, dosage = ?, 
                 description = ?, target = ?, quantity = ? 
             WHERE id = ?`,
            [
                product, 
                parseFloat(price), 
                dosage, 
                description || null, 
                target || null, 
                parseInt(quantity), 
                req.params.id
            ]
        );
        
        await conn.commit();
        req.flash('success', 'Product updated successfully');
        res.redirect('/adminview');
    } catch (err) {
        await conn.rollback();
        console.error('Error updating product:', err);
        req.flash('error', 'Failed to update product');
        res.redirect(`/update/${req.params.id}`);
    } finally {
        conn.release();
    }
});

// Show delete confirmation
router.get('/delete/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        
        if (!rows.length) {
            req.flash('error', 'Product not found');
            return res.redirect('/adminview');
        }
        
        res.render('deleteproduct.ejs', { 
            product: rows[0],
            messages: req.flash()
        });
    } catch (err) {
        console.error('Error fetching product for deletion:', err);
        req.flash('error', 'Failed to load product');
        res.redirect('/adminview');
    }
});

// Handle delete
router.post('/delete/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // First verify the product exists
        const [rows] = await conn.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!rows.length) {
            req.flash('error', 'Product not found');
            return res.redirect('/adminview');
        }
        
        await conn.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        await conn.commit();
        
        req.flash('success', 'Product deleted successfully');
        res.redirect('/adminview');
    } catch (err) {
        await conn.rollback();
        console.error('Error deleting product:', err);
        req.flash('error', 'Failed to delete product');
        res.redirect(`/delete/${req.params.id}`);
    } finally {
        conn.release();
    }
});

// Handle add product
router.post('/add', async (req, res) => {
    const { product, price, dosage, description, target, quantity } = req.body;

    // Basic validation
    if (!product || !price || !dosage || !description || !target || !quantity) {
        req.flash && req.flash('error', 'All fields are required');
        return res.redirect('/addproduct');
    }
    if (quantity < 0) {
        req.flash && req.flash('error', 'Quantity must be a positive number');
        return res.redirect('/addproduct');
    }

    try {
        await pool.query(
            `INSERT INTO products (product, price, dosage, description, target, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
            [product, parseFloat(price), dosage, description, target, parseInt(quantity)]
        );
        req.flash && req.flash('success', 'Product added successfully');
        res.redirect('/adminview');
    } catch (err) {
        console.error('Error adding product:', err);
        req.flash && req.flash('error', 'Failed to add product');
        res.redirect('/addproduct');
    }
});

// View all users and admins
router.get('/viewuser', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, fname, lname, email, created_at FROM login ORDER BY created_at DESC');
        const [admins] = await pool.query('SELECT id, name, created_at FROM admin ORDER BY created_at DESC');
        res.render('viewuser.ejs', { users, admins, messages: req.flash() });
    } catch (err) {
        console.error('Error fetching users/admins:', err);
        req.flash('error', 'Failed to load users/admins');
        res.redirect('/adminview');
    }
});

export default router;