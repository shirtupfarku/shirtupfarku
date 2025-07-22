const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // สำหรับการอ่าน/เขียนไฟล์ (ใช้ชั่วคราว ก่อนไปใช้ Database จริง)

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // อนุญาตให้ทุกโดเมนเข้าถึงได้ (สำหรับ localhost เท่านั้น)
app.use(bodyParser.json()); // สำหรับ parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // สำหรับ parsing application/x-www-form-urlencoded

// ตั้งค่า Multer สำหรับการอัปโหลดไฟล์ (เก็บในหน่วยความจำชั่วคราว)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
// ----------------------------------------------------

// API สำหรับการ checkout (POST /api/checkout)
app.post('/api/checkout', (req, res) => {
    try {
        const { cart } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ success: false, message: "Cart data is missing or empty." });
        }

        // อ่านข้อมูลสินค้าจาก products.json
        let products = [];
        try {
            const productsPath = path.join(__dirname, 'products.json');
            products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
        } catch (readErr) {
            console.error('Error reading products.json:', readErr);
            return res.status(500).json({ success: false, message: 'Could not load product data. Server error.' });
        }

        let orders = [];
        try {
            const ordersPath = path.join(__dirname, 'orders.json');
            if (fs.existsSync(ordersPath)) {
                orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
            }
        } catch (readErr) {
            console.error('Error reading orders.json:', readErr);
            // ถ้าอ่านไม่ได้ อาจจะเริ่มใหม่เป็น Array ว่าง
            orders = [];
        }

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
            paymentSlip: null
        };

        orders.push(newOrder);

        // บันทึกคำสั่งซื้อลง orders.json
        try {
            fs.writeFileSync(path.join(__dirname, 'orders.json'), JSON.stringify(orders, null, 2), 'utf8');
        } catch (writeErr) {
            console.error('Error writing orders.json:', writeErr);
            return res.status(500).json({ success: false, message: 'Could not save order. Server error.' });
        }

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
app.get('/api/order/:orderId', (req, res) => {
    try {
        const orderId = req.params.orderId;

        let orders = [];
        try {
            const ordersPath = path.join(__dirname, 'orders.json');
            orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
        } catch (readErr) {
            console.error('Error reading orders.json for /api/order:', readErr);
            return res.status(500).json({ success: false, message: 'Could not load order data. Server error.' });
        }

        const order = orders.find(o => o.orderId === orderId);

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
app.post('/api/payment-slip', upload.single('paymentSlip'), (req, res) => {
    try {
        const { orderId, customerName } = req.body;
        const paymentSlipFile = req.file;

        if (!orderId || !customerName || !paymentSlipFile) {
            return res.status(400).json({ success: false, message: "Missing order ID, customer name, or payment slip." });
        }

        let orders = [];
        try {
            const ordersPath = path.join(__dirname, 'orders.json');
            orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
        } catch (readErr) {
            console.error('Error reading orders.json for /api/payment-slip:', readErr);
            return res.status(500).json({ success: false, message: 'Could not load order data for payment slip. Server error.' });
        }

        const orderIndex = orders.findIndex(o => o.orderId === orderId);

        if (orderIndex === -1) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // ในโค้ดจริง: คุณจะอัปโหลด paymentSlipFile ไปยัง Cloud Storage (เช่น Cloudinary, AWS S3)
        // และรับ URL กลับมา
        const slipUrl = `http://localhost:${PORT}/uploads/${orderId}_${Date.now()}_${paymentSlipFile.originalname}`; // URL จำลอง

        orders[orderIndex].customerName = customerName;
        orders[orderIndex].paymentSlip = slipUrl; // เก็บ URL ของ slip
        orders[orderIndex].status = 'paid'; // เปลี่ยนสถานะเป็น paid
        orders[orderIndex].paymentDate = new Date().toISOString();

        // บันทึกคำสั่งซื้อที่อัปเดตลง orders.json
        try {
            fs.writeFileSync(path.join(__dirname, 'orders.json'), JSON.stringify(orders, null, 2), 'utf8');
        } catch (writeErr) {
            console.error('Error writing orders.json after payment slip:', writeErr);
            return res.status(500).json({ success: false, message: 'Could not save payment slip update. Server error.' });
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