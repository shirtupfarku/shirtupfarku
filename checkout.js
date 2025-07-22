// const products = require('../products.json'); // ไม่แนะนำให้ใช้ไฟล์ JSON ใน Serverless Functions
// const fs = require('fs'); // ไม่แนะนำให้เขียนไฟล์ใน Serverless Functions

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const { cart } = req.body;

        // *** จุดสำคัญ: ส่วนนี้ต้องมีการเชื่อมต่อกับฐานข้อมูลจริง ***
        // ตอนนี้เราจะจำลองว่าข้อมูลสินค้าอยู่ในนี้
        // ในความเป็นจริง คุณจะ query ข้อมูลสินค้าจาก Database
        const productsData = [
            { id: "item-1", name: "เสื้อยืดลายนกอินทรี (สีดำ)", price: 299 },
            { id: "item-2", name: "เสื้อยืดลายนกอินทรี (สีขาว)", price: 299 },
            { id: "item-3", name: "เสื้อคอกลม Basic", price: 299 },
            { id: "item-4", name: "เสื้อคอกลม Basic", price: 299 },
            { id: "item-5", name: "เสื้อคอกลม Basic", price: 299 },
            { id: "item-6", name: "เสื้อคอกลม Basic", price: 299 },
            { id: "item-7", name: "เสื้อคอกลม Basic", price: 299 },
            { id: "item-8", name: "เสื้อคอกลม Basic", price: 299 },
            { id: "item-9", name: "เสื้อคอกลม Basic", price: 299 },
        ];

        let totalAmount = 0;
        let orderItems = [];
        let missingProducts = [];

        for (const item of cart) {
            const productInDb = productsData.find(p => p.id === item.id);
            if (!productInDb) {
                missingProducts.push(item.id);
            } else {
                const subtotal = productInDb.price * item.quantity;
                totalAmount += subtotal;
                orderItems.push({
                    id: productInDb.id,
                    name: productInDb.name,
                    price: productInDb.price,
                    quantity: item.quantity,
                    subtotal: subtotal
                });
            }
        }

        if (missingProducts.length > 0) {
            return res.status(404).json({ success: false, message: `Product with ID ${missingProducts.join(', ')} not found.` });
        }

        const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newOrder = {
            orderId: orderId,
            items: orderItems,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            orderDate: new Date().toISOString(),
            status: 'pending', // สถานะเริ่มต้น
            customerName: null,
            paymentSlip: null
        };

        // *** จุดสำคัญ: ส่วนนี้ต้องเก็บข้อมูลลง Database จริง ***
        // ตอนนี้เราจะส่งกลับไปให้ client จัดการเอง
        // ใน Production: คุณจะบันทึก newOrder ลงฐานข้อมูล

        res.status(200).json({
            success: true,
            message: "Order created successfully",
            orderId: newOrder.orderId,
            totalAmount: newOrder.totalAmount
        });

    } else {
        res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
};