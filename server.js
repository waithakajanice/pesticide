import mysql from 'mysql2/promise';
import express from "express";
import cors from "cors";
import path from "path";
import { log } from "console";
import multer from "multer";
import fileUpload from 'express-fileupload';
import fs from 'fs';
import admin from 'firebase-admin';
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import checkoutRouter from './routes/checkout.js';
import adminRouter from './routes/admin.js';
import session from 'express-session';
import flash from 'connect-flash';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Verify required environment variables are set
const requiredEnvVars = [
  'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID', 'FIREBASE_MEASUREMENT_ID',
  'SESSION_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Firebase configuration and initialization
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const appStorage = getStorage();

// Express app setup
const app = express();

// Middleware configuration
app.use(express.static('public'));
app.use(cors());
app.use(express.json());

const __dirname = new URL('.', import.meta.url).pathname;
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'uploads')));
app.use(express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));

app.use(flash());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.SESSION_SECURE_COOKIE === 'true',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware for login requirement (global, except auth pages)
function requireLogin(req, res, next) {
  // Allow access to login, signup, createaccount, and static files
  const openPaths = [
    '/', '/login', '/createaccount', '/logout', '/adminlogin', '/adminloginpost'
  ];
  // Allow static assets (css, js, images, etc.)
  if (
    openPaths.includes(req.path) ||
    req.path.startsWith('/css') ||
    req.path.startsWith('/js') ||
    req.path.startsWith('/images') ||
    req.path.startsWith('/public') ||
    req.path.startsWith('/uploads')
  ) {
    return next();
  }
  // Allow if either user or admin is logged in
  if (!req.session.userId && !req.session.adminId) {
    return res.redirect('/');
  }
  next();
}

// Place this middleware BEFORE all your route handlers
app.use(requireLogin);

// MySQL database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
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

// Database connection helper
const connection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) reject(err);
      log("MySQL pool connected");
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
          log("MySQL pool released");
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
async function fetchProducts() {
  const sql = 'SELECT * FROM products';
  const [results] = await pool.query(sql);
  return results;
}

async function fetchReviews() {
  const sql = 'SELECT * FROM reviews';
  const [results] = await pool.query(sql);
  return results;
}

async function fetchSold() {
  const sql = 'SELECT * FROM sold';
  const [results] = await pool.query(sql);
  return results;
}

const fetchProductsFromDB = async () => {
  const sql = "SELECT * FROM products";
  try {
    const [results] = await pool.query(sql);
    const products = results.map(product => ({
      id: product.id,
      product: product.product,
      price: product.price,
      dosage: product.dosage,
      description: product.description,
      target: product.target,
      quantity: product.quantity
    }));
    return products;
  } catch (err) {
    console.error('Error fetching products from MySQL: ', err);
    throw err;
  }
};

export { fetchProductsFromDB };

// Authentication functions
const signIn = async (email, password) => {
  try {
    const sql = "SELECT * FROM login WHERE `email` = ? AND `password` = ?";
    const [rows] = await pool.query(sql, [email, password]);
    return rows.length > 0 ? "Success" : "";
  } catch (err) {
    console.error("Login error:", err);
    throw err;
  }
}

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

app.get('/adminlogin', (req, res) => {
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

app.get('/products', async (req, res) => {
  try {
    const products = await fetchProducts();
    res.render('products', { products });
  } catch (error) {
    res.status(500).send('Error fetching products');
  }
});

app.get('/adminview', async (req, res) => {
  try {
    const products = await fetchProducts();
    res.render('adminview', { products });
  } catch (error) {
    res.status(500).send('Error fetching products');
  }
});

app.get('/reviews', async (req, res) => {
  try {
    const reviews = await fetchReviews();
    res.render('reviews', { reviews });
  } catch (error) {
    res.status(500).send('Error fetching reviews');
  }
});

app.get('/addproduct', (req, res) => {
  res.render("addproduct.ejs");
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

// Shopping cart and checkout routes
app.use('/cart', cartRoutes);
app.use('/checkout', checkoutRouter);
app.use('/checkout', checkoutRoutes);
app.use('/', checkoutRouter);
app.use('/admin', adminRouter);

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
    
    res.redirect("/");
  });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM login WHERE email = ? AND password = ?";
  const [rows] = await pool.query(sql, [email, password]);
  if (rows.length > 0) {
    req.session.userId = rows[0].id;
    res.redirect("/home");
  } else {
    res.status(401).send("Invalid credentials");
  }
});

app.post("/adminloginpost", async (req, res) => {
  const enteredName = req.body.name;
  const enteredPassword = req.body.password;

  const sql = "SELECT * FROM admin WHERE name = ? AND password = ?";
  const values = [enteredName, enteredPassword];

  try {
    const [results] = await pool.query(sql, values);
    if (results.length > 0) {
      req.session.adminId = results[0].id;

      // Redirect to adminview route
      res.redirect('/adminview');
    } else {
      res.render('admin', { error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Error querying MySQL: ', err);
    res.status(500).send('Error querying MySQL');
  }
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
function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    const now = new Date().toLocaleString();
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`[${now}] ✅ Server running on http://localhost:${port}`);
  });
}

startServer();