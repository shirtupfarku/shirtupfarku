require('dotenv').config(); // เพื่ออ่าน .env ไฟล์
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // เพิ่ม ObjectId
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // อาจจะยังจำเป็นสำหรับบางฟังก์ชันที่ไม่เกี่ยวกับ DB โดยตรง
const bcrypt = require('bcryptjs'); // เพิ่มบรรทัดนี้
const jwt = require('jsonwebtoken'); // เพิ่มบรรทัดนี้

const app = express();
const PORT = 3000;

// ตรวจสอบ JWT_SECRET
if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not defined in .env! Please add it with a strong, complex key.");
    process.exit(1); // ออกจากโปรแกรมหากไม่มี Secret Key
}
const JWT_SECRET = process.env.JWT_SECRET;

// เชื่อมต่อ MongoDB
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let productsCollection;
let ordersCollection;
let usersCollection; // เพิ่มบรรทัดนี้

async function connectDb() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("MongoDB connected successfully!");

        // ***เปลี่ยน "mywebsite_db" เป็นชื่อ Database ของคุณใน Atlas***
        const db = client.db("mywebsite_db");
        productsCollection = db.collection("products");
        ordersCollection = db.collection("orders");
        usersCollection = db.collection("users"); // ตำแหน่งที่ถูกต้อง

        // ตรวจสอบว่ามีสินค้าใน database ไหม ถ้าไม่มี ให้ใส่ข้อมูลเริ่มต้น
        const productCount = await productsCollection.countDocuments();
        if (productCount === 0) {
            const initialProducts = [
                { id: 'item-1', name: 'เสื้อยืดลายนกอินทรี (สีดำ)', price: 299 },
                { id: 'item-2', name: 'เสื้อยืดลายนกอินทรี (สีขาว)', price: 299 },
                { id: 'item-3', name: 'เสื้อคอกลม Basic', price: 299 },
                { id: 'item-4', name: "เสื้อคอกลม Basic (เทา)", price: 299 },
                { id: 'item-5', name: "เสื้อคอกลม Basic (แดง)", price: 299 },
                { id: 'item-6', name: "เสื้อคอกลม Basic (ฟ้า)", price: 299 },
                { id: 'item-7', name: "เสื้อคอกลม Basic (เขียว)", price: 299 },
                { id: 'item-8', name: "เสื้อคอกลม Basic (ส้ม)", price: 299 },
                { id: 'item-9', name: "เสื้อคอกลม Basic (เทาอ่อน)", price: 299 }
            ];
            await productsCollection.insertMany(initialProducts);
            console.log("Initial products inserted into database.");
        }

    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1);
    }
}

connectDb().catch(console.dir);


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ตั้งค่า Multer สำหรับการอัปโหลดไฟล์ (เก็บในหน่วยความจำชั่วคราว)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware สำหรับตรวจสอบ JWT Token (สำหรับ API ที่ต้องการการยืนยันตัวตน)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        return res.status(401).json({ message: "Authentication token required." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT verification failed:", err);
            return res.status(403).json({ message: "Invalid or expired token." });
        }
        req.user = user; // เก็บข้อมูลผู้ใช้ที่ถอดรหัสจาก Token ไว้ใน req
        next();
    });
};

// API Routes
// ----------------------------------------------------

// API สำหรับสมัครสมาชิก (Register)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({ message: "Please enter all required fields." });
        }

        // ตรวจสอบว่า Username หรือ Email ซ้ำหรือไม่
        const existingUser = await usersCollection.findOne({ $or: [{ username: username }, { email: email }] });
        if (existingUser) {
            return res.status(409).json({ message: "Username or Email already exists." });
        }

        // Hash รหัสผ่าน
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // สร้าง User ใหม่
        const newUser = {
            username: username,
            email: email,
            password: hashedPassword,
            role: 'user', // กำหนดบทบาทเริ่มต้นเป็น 'user'
            createdAt: new Date().toISOString()
        };

        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "User registered successfully." });

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// API สำหรับล็อกอิน (Login)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Please enter username and password." });
        }

        // ค้นหา User
        const user = await usersCollection.findOne({ username: username });
        if (!user) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        // เปรียบเทียบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        // สร้าง JWT Token
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' } // Token หมดอายุใน 1 ชั่วโมง
        );

        res.status(200).json({
            message: "Logged in successfully.",
            token: token,
            username: user.username,
            role: user.role
        });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});

// API สำหรับตัวอย่างที่ต้องล็อกอินเท่านั้น (Protected Route)
app.get('/api/protected', authenticateToken, (req, res) => {
    res.status(200).json({
        message: `Welcome, ${req.user.username}! You are logged in as a ${req.user.role}.`,
        user: req.user
    });
});


// API สำหรับการ checkout (POST /api/checkout)
app.post('/api/checkout', async (req, res) => { // เพิ่ม async
    try {
        const { cart } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ success: false, message: "Cart data is missing or empty." });
        }

        const products = await productsCollection.find({}).toArray();

        let totalAmount = 0;
        let orderItems = [];
        let missingProducts = [];

        for (const item of cart) {
            const product = products.find(p => p.id === item.id);
            if (!product) {
                missingProducts.push(item.id);
            } else {
                const quantity = parseInt(item.quantity);
                if (isNaN(quantity) || quantity <= 0) {
                    return res.status(400).json({ success: false, message: `Invalid quantity for product ${item.id}.` });
                }
                const subtotal = product.price * quantity;
                totalAmount += subtotal;
                orderItems.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: quantity,
                    subtotal: parseFloat(subtotal.toFixed(2))
                });
            }
        }

        if (missingProducts.length > 0) {
            return res.status(404).json({ success: false, message: `Product with ID(s) ${missingProducts.join(', ')} not found.` });
        }

        const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newOrder = {
            orderId: orderId,
            items: orderItems,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            orderDate: new Date().toISOString(),
            status: 'pending',
            customerName: null,
            paymentSlip: null,
            // เพิ่มข้อมูลผู้ใช้ที่สั่งซื้อ (ถ้าล็อกอินอยู่)
            userId: req.user ? req.user.id : null,
            username: req.user ? req.user.username : null
        };

        await ordersCollection.insertOne(newOrder);


        res.status(200).json({
            success: true,
            message: "Order created successfully",
            orderId: newOrder.orderId,
            totalAmount: newOrder.totalAmount
        });

    } catch (error) {
        console.error('Unhandled error in /api/checkout:', error);
        res.status(500).json({ success: false, message: 'Internal server error during checkout.' });
    }
});

// API สำหรับดึงข้อมูลคำสั่งซื้อ (GET /api/order/:orderId)
app.get('/api/order/:orderId', async (req, res) => { // เพิ่ม async
    try {
        const orderId = req.params.orderId;
        const order = await ordersCollection.findOne({ orderId: orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        res.status(200).json({ success: true, order: order });

    } catch (error) {
        console.error('Unhandled error in /api/order:', error);
        res.status(500).json({ success: false, message: 'Internal server error fetching order.' });
    }
});

// API สำหรับรับสลิป (POST /api/payment-slip)
app.post('/api/payment-slip', upload.single('paymentSlip'), async (req, res) => { // เพิ่ม async
    try {
        const { orderId, customerName } = req.body;
        const paymentSlipFile = req.file;

        if (!orderId || !customerName || !paymentSlipFile) {
            return res.status(400).json({ success: false, message: "Missing order ID, customer name, or payment slip." });
        }

        // ในโค้ดจริง: คุณจะอัปโหลด paymentSlipFile ไปยัง Cloud Storage (เช่น Cloudinary, AWS S3)
        // และรับ URL กลับมา
        const slipUrl = `http://localhost:${PORT}/uploads/${orderId}_${Date.now()}_${paymentSlipFile.originalname}`; // URL จำลอง

        const updateResult = await ordersCollection.updateOne(
            { orderId: orderId }, // เงื่อนไขในการค้นหา
            {
                $set: { // ข้อมูลที่จะอัปเดต
                    customerName: customerName,
                    paymentSlip: slipUrl,
                    status: 'paid',
                    paymentDate: new Date().toISOString()
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }


        res.status(200).json({ success: true, message: "Payment slip submitted successfully." });

    } catch (error) {
        console.error('Unhandled error in /api/payment-slip:', error);
        res.status(500).json({ success: false, message: 'Internal server error submitting payment slip.' });
    }
});

// ----------------------------------------------------

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});