// Import required modules
import mysql from 'mysql2';
import express, { json } from "express";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import { log } from "console";
import multer from "multer";
import fileUpload from 'express-fileupload';
import fs from 'fs';
import admin from 'firebase-admin';
import { initializeApp } from "firebase/app";
import { getStorage, ref } from "firebase/storage";

// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyCCqn6ectArvQ_zUvN1fSm1_QSAuooapLo",
    authDomain: "pesticide-supply.firebaseapp.com",
    projectId: "pesticide-supply",
    storageBucket: "pesticide-supply.appspot.com",
    messagingSenderId: "1076388899331",
    appId: "1:1076388899331:web:6760fb0fa8c7feb0a0bc36",
    measurementId: "G-MJSF72TR6M"
};

const firebaseApp = initializeApp(firebaseConfig);
const appStorage = getStorage();

// Express app setup and middleware configuration
const app = express();
app.use(express.static('public'));
app.use(cors());
app.use(express.json());

const __dirname = new URL('.', import.meta.url).pathname;
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'uploads')));
app.use(express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// MySQL database connection pool setup
const pool = mysql.createPool({
    host: 'localhost',
    user: 'api',
    password: '1234',
    database: 'pesticide',
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Database connection helper functions
const connection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            console.log("MySQL pool connected ");
            const query = (sql, binding) => {
                return new Promise((resolve, reject) => {
                    connection.query(sql, binding, (err, result) => {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
            };
            const release = () => {
                return new Promise((resolve, reject) => {
                    if (err) reject(err);
                    console.log("MySQL pool released");
                    resolve(connection.release());
                });
            };
            resolve({ query, release });
        });
    });
};

const query = (sql, binding) => {
    return new Promise((resolve, reject) => {
        pool.query(sql, binding, (err, result, fields) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

// Data fetching functions
function fetchProducts(callback) {
    const sql = 'SELECT * FROM products';
    pool.query(sql, (error, results) => {
        if (error) return callback(error, null);
        callback(null, results);
    });
}

function fetchReviews(callback) {
    const query = 'SELECT * FROM reviews';
    connection()
        .then(conn => {
            conn.query(query, (error, results) => {
                if (error) {
                    callback(error, null);
                    return;
                }
                callback(null, results);
                conn.release();
            });
        })
        .catch(error => {
            callback(error, null);
        });
}

function fetchSold(callback) {
    const sql = 'SELECT * FROM sold';
    pool.query(sql, (error, results) => {
        if (error) return callback(error, null);
        callback(null, results);
    });
}

const fetchProductsFromDB = () => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM products";
        pool.query(sql, (err, results) => {
            if (err) {
                console.error('Error fetching products from MySQL: ', err);
                reject(err);
            } else {
                const products = results.map(product => {
                    return {
                        id: product.id,
                        product: product.product,
                        price: product.price,
                        dosage: product.dosage,
                        description: product.description,
                        target: product.target,
                        quantity: product.quantity
                    };
                });
                resolve(products);
            }
        });
    });
};

// Authentication functions
const signIn = async (email, password) => new Promise(async (resolve, reject) => {
    const conn = await connection();
    try {
        console.log("Siging in...");
        const sql = ("SELECT * FROM login WHERE `email` = ? AND `password` = ?");
        let user = await conn.query(sql, [email, password]);

        return user[0] ? resolve("Success") : resolve("");
    } catch {
        return reject("");
    } finally {
        await conn.release();
    }
});

// Route handlers for views
app.get('/', (req, res) => {
    res.render("index.ejs");
});

app.get('/createaccount', (req, res) => {
    const error = req.query.error ? req.query.error : null;
    res.render('createaccount', { error: error });
});

app.get('/home', (req, res) => {
    res.render("home.ejs");
});

app.get('/admin', (req, res) => {
    res.render("admin.ejs");
});

app.get('/contacts', (req, res) => {
    res.render("contacts.ejs");
});

app.get('/pricing', async (req, res) => {
    try {
        const products = await fetchProductsFromDB();
        res.render("pricing.ejs", { products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Error loading pricing page');
    }
});

app.get('/pay', (req, res) => {
    res.render("pay.ejs");
});

app.get('/products', (req, res) => {
    fetchProducts((error, products) => {
        if (error) {
            res.status(500).send('Error fetching products');
            return;
        }
        res.render('products', { products });
    });
});

app.get('/adminview', (req, res) => {
    fetchProducts((error, products) => {
        if (error) {
            res.status(500).send('Error fetching products');
            return;
        }
        res.render('adminview', { products });
    });
});

app.get('/reviews', (req, res) => {
    fetchReviews((error, reviews) => {
        if (error) {
            res.status(500).send('Error fetching reviews');
            return;
        }
        res.render('reviews', { reviews });
    });
});

app.get('/addproduct', (req, res) => {
    fetchReviews((error, reviews) => {
        if (error) {
            res.status(500).send('Error fetching reviews');
            return;
        }
        res.render("addproduct.ejs", { reviews });
    });
});

app.get("/sold", (req, res) => {
    fetchSold((error, sold) => {
        if (error) {
            res.status(500).send('Error fetching sold');
            return;
        }
        res.render("sold.ejs", { sold });
    });
});

app.get('/viewreviews', (req, res) => {
    fetchReviews((error, reviews) => {
        if (error) {
            res.status(500).send('Error fetching reviews');
            return;
        }
        res.render("viewreviews.ejs", { reviews });
    });
});

// Route handlers for form submissions
app.post("/addProduct", (req, res) => {
    const { product, price, dosage, target, description, quantity } = req.body;

    if (!product || !price || !dosage || !target || !description || !quantity) {
        return res.status(400).send("All fields are required.");
    }

    const sql = `
        INSERT INTO products (product, price, dosage, target, description, quantity) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    pool.query(sql, [product, price, dosage, target, description, quantity], (err, result) => {
        if (err) {
            console.error("Error inserting data into MySQL:", err.sqlMessage || err);
            return res.status(500).send("Error inserting data into MySQL.");
        }
        console.log("Product added successfully:");
        res.redirect("/products");
    });
});

app.post('/signup', (req, res) => {
    const sql = "INSERT INTO login (fname, lname, email, password, pwd) VALUES(?, ?, ?, ?, ?)";
    const values = [
        req.body.fname,
        req.body.lname,
        req.body.email,
        req.body.password,
        req.body.pwd
    ];

    pool.query(sql, values, (err, data) => {
        if (err) {
            console.error('Error inserting data into MySQL:', err);
            res.status(500).send('Error inserting data into MySQL');
            return;
        }
        
        console.log("Account created successfully!");
        res.redirect("/");
    });
});

app.post('/login', (req, res) => {
    signIn(req.body.email, req.body.password)
        .then((result) => {
            if (result)
                res.status(200).redirect("/home");
            else
                res.status(200).send(`Check password for ${req.body.email}`);
        })
        .catch((e) => {
            res.status(500).send("Could not sign in");
        });
});

app.post("/admin", (req, res) => {
    const enteredName = req.body.name;
    const enteredPassword = req.body.password;

    const sql = "SELECT * FROM admin WHERE name = ? AND password = ?";
    const values = [enteredName, enteredPassword];

    pool.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error querying MySQL: ', err);
            res.status(500).send('Error querying MySQL');
            return;
        }

        if (results.length > 0) {
            res.redirect("/adminview");
        } else {
            res.render('admin', { error: 'Invalid username or password' });
        }
    });
});

app.post("/remove", (req, res) => {
    const id = req.body.id;
    pool.query("DELETE FROM products WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            res.status(500).send('Error deleting product');
            return;
        }
        res.redirect("/adminview");
    });
});

app.post('/buy', (req, res) => {
    const { id, quantity } = req.body;

    if (!id || !quantity) {
        return res.json({ success: false, message: 'Invalid request data' });
    }

    pool.query('SELECT quantity FROM products WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.log(err)
            return res.json({ success: false, message: 'Database error' });
        }
        if (result.length === 0) {
            return res.json({ success: false, message: 'Product not found' });
        }

        let availableQuantity = result[0].quantity;

        if (quantity > availableQuantity) {
            return res.json({ success: false, message: 'Not enough stock available!' });
        }

        let newQuantity = availableQuantity - quantity;

        pool.query('UPDATE products SET quantity = ? WHERE id = ?', [newQuantity, id], (err, updateResult) => {
            if (err) {
                return res.json({ success: false, message: 'Database update error' });
            }
            res.json({ success: true, newQuantity });
        });
    });
});

app.post("/reviews", (req, res) => {
    const sql = "INSERT INTO reviews (`name`, `message` ) VALUES(?,?)";
    const values = [
        req.body.name,
        req.body.message
    ];

    pool.query(sql, values, (err, data) => {
        if (err) {
            console.error('Error inserting data into MySQL: ', err);
            res.status(500).send('Error inserting data into MySQL');
            return;
        } else {
            res.redirect("/reviews");
        }
    });
});

// Server startup function
function startServer(port = 3000) {
    app.listen(port, () => {
        const now = new Date().toLocaleString();
        console.log(`[${now}] ✅ Server started and running on http://localhost:${port}`);
    });
}

startServer();