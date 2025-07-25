// const orderIndex = orders.findIndex(o => o.orderId === orderId);
// ... อัปเดตข้อมูลใน orders[orderIndex] ...
// fs.writeFileSync(path.join(__dirname, 'orders.json'), JSON.stringify(orders, null, 2), 'utf8');

const updateResult = await ordersCollection.updateOne(
    { orderId: orderId },
    {
        $set: {
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