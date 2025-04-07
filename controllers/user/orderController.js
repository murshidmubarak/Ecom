const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const mongoose = require("mongoose");
const easyinvoice = require("easyinvoice");
const moment = require("moment");
const fs = require("fs");
const path = require("path");

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user || req.query.userId;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const [user, cart, addressData] = await Promise.all([
            User.findById(userId),
            Cart.findOne({ userId }).populate("items.productId"),
            Address.findOne({ userId })
        ]);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect("/shop");
        }

        const cartData = cart.items.map(item => ({
            cart: {
                productId: item.productId._id,
                quantity: item.quantity
            },
            productDetails: item.productId
        }));

        const grandTotal = cart.items.reduce((total, item) =>
            total + (item.quantity * item.productId.salePrice), 0);

        res.render("checkout", {
            product: cartData,
            user,
            isCart: true,
            userAddress: addressData,
            grandTotal: grandTotal || 0,
        });
    } catch (error) {
        console.error('Error in getCheckoutPage:', error);
        res.redirect("/pageNotFound");
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.query;
        const userId = req.session.user;

        if (!mongoose.Types.ObjectId.isValid(id) || !userId) {
            return res.status(400).json({ error: "Invalid parameters" });
        }

        await Cart.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId: id } } }
        );

        res.redirect("/checkout");
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        res.redirect("/pageNotFound");
    }
};

const orderPlaced = async (req, res) => {
    try {
        const { totalPrice, addressId } = req.body;
        const userId = req.session.user;

        if (!userId || !addressId || !totalPrice) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const [user, cart, addressDoc] = await Promise.all([
            User.findById(userId),
            Cart.findOne({ userId }).populate("items.productId"),
            Address.findOne({ userId, "address._id": addressId })
        ]);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!cart || !cart.items.length) {
            return res.status(400).json({ error: "Cart is empty" });
        }

        if (!addressDoc) {
            return res.status(404).json({ error: "Address not found" });
        }

        const address = addressDoc.address.find(
            addr => addr._id.toString() === addressId
        );

        const orderedItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: Number(item.quantity), // Ensure quantity is a number
            price: item.productId.salePrice,
            productStatus: "confirmed"
        }));

        const newOrder = new Order({
            orderedItems,
            totalPrice,
            finalAmount: totalPrice,
            address,
            payment: "cod",
            userId,
            status: "confirmed",
            createdOn: Date.now(),
        });

        const savedOrder = await newOrder.save();
        await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

        // Update product stock (quantity is a string in Product schema)
        for (const item of orderedItems) {
            const product = await Product.findById(item.product);
            if (product) {
                const currentQuantity = parseInt(product.quantity, 10); // Convert string to number
                const newQuantity = currentQuantity - item.quantity; // Subtract (both are numbers)
                product.quantity = newQuantity.toString(); // Convert back to string for storage
                await product.save();
            }
        }

        res.json({
            payment: true,
            method: "cod",
            order: savedOrder,
            orderId: savedOrder._id,
        });
    } catch (error) {
        console.error("Error processing order:", error);
        res.status(500).json({ error: "Server error" });
    }
};

/* const getOrderDetailsPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.query.id;
        const findOrder = await Order.findOne({ _id: orderId });
        const findUser = await User.findOne({ _id: userId });

        let totalGrant = 0;
        findOrder.orderedItems.forEach((val) => {
            totalGrant += val.price * val.quantity;
        });

        const totalPrice = findOrder.totalPrice;
        const finalAmount = totalPrice;

        res.render("orderDetails", {
            orders: findOrder,
            user: findUser,
            totalGrant: totalGrant,
            totalPrice: totalPrice,
            finalAmount: finalAmount,
        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}; */

const getOrderDetailsPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.query.id;

        // Populate orderedItems.product to access product details
        const findOrder = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
        if (!findOrder) {
            return res.redirect("/pageNotFound");
        }

        const findUser = await User.findOne({ _id: userId });
        if (!findUser) {
            return res.redirect("/pageNotFound");
        }

        let totalGrant = 0;
        findOrder.orderedItems.forEach((val) => {
            totalGrant += val.price * val.quantity;
        });

        const totalPrice = findOrder.totalPrice;
        const finalAmount = totalPrice;

        // Pass data to the template
        res.render("orderDetails", {
            orders: findOrder,
            user: findUser,
            totalGrant: totalGrant,
            totalPrice: totalPrice,
            finalAmount: finalAmount,
        });
    } catch (error) {
        console.error("Error in getOrderDetailsPage:", error);
        res.redirect("/pageNotFound");
    }
};



const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.body;
        const findOrder = await Order.findOne({ _id: orderId });
        console.log("findOrder", findOrder);
        
        if (!findOrder) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (findOrder.status === "cancelled") {
            return res.status(400).json({ message: "Order is already cancelled" });
        }

        await Order.updateOne({ _id: orderId }, { status: "cancelled" });

        for (const item of findOrder.orderedItems) {
            const product = await Product.findById(item.product);
            if (product) {
                const currentQuantity = parseInt(product.quantity, 10);
                const newQuantity = currentQuantity + item.quantity;
                product.quantity = newQuantity.toString();
                await product.save();
            }
        }

        res.status(200).json({ message: "Order cancelled successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/* const cancelSingleProduct = async (req, res) => {
    const { orderId, singleProductId } = req.body;
    const oid = new mongoose.Types.ObjectId(singleProductId);

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(singleProductId)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    const order = await Order.findOne({ _id: orderId });
    const productIndex = order.orderedItems.findIndex((item) => item.product.toString() === singleProductId);
    const orderedItemPrice = order.orderedItems[productIndex].price;
    const newPrice = order.totalPrice - orderedItemPrice;

    try {
        const filter = { _id: orderId };
        const update = {
            $set: {
                "orderedItems.$[elem].productStatus": "cancelled",
                totalPrice: newPrice,
            },
        };
        const options = {
            arrayFilters: [{ "elem.product": oid }]
        };
        const result = await Order.updateOne(filter, update, options);
        res.status(200).json({ message: "Product status updated successfully", result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
} */


    const cancelSingleProduct = async (req, res) => {
        const { orderId, singleProductId } = req.body;
        const oid = new mongoose.Types.ObjectId(singleProductId);
    
        if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(singleProductId)) {
            return res.status(400).json({ message: "Invalid ID format" });
        }
    
        try {
            const order = await Order.findOne({ _id: orderId });
            if (!order) {
                return res.status(404).json({ message: "Order not found" });
            }
    
            const productIndex = order.orderedItems.findIndex((item) => item.product.toString() === singleProductId);
            if (productIndex === -1) {
                return res.status(404).json({ message: "Product not found in order" });
            }
    
            const orderedItemPrice = order.orderedItems[productIndex].price;
            const newPrice = order.totalPrice - orderedItemPrice;
    
            // Update the product status to "cancelled"
            const filter = { _id: orderId };
            const update = {
                $set: {
                    "orderedItems.$[elem].productStatus": "cancelled",
                    totalPrice: newPrice,
                },
            };
            const options = {
                arrayFilters: [{ "elem.product": oid }],
            };
            await Order.updateOne(filter, update, options);
    
            // Check if all items are cancelled
            const updatedOrder = await Order.findOne({ _id: orderId });
            const allCancelled = updatedOrder.orderedItems.every(item => item.productStatus === "cancelled");
    
            if (allCancelled) {
                await Order.updateOne({ _id: orderId }, { status: "cancelled" });
                // Restore product stock for this item since it’s now cancelled
                const product = await Product.findById(singleProductId);
                if (product) {
                    const currentQuantity = parseInt(product.quantity, 10);
                    const newQuantity = currentQuantity + order.orderedItems[productIndex].quantity;
                    product.quantity = newQuantity.toString();
                    await product.save();
                }
                res.status(200).json({ message: "All products cancelled, order status updated to cancelled" });
            } else {
                res.status(200).json({ message: "Product status updated successfully" });
            }
        } catch (error) {
            console.error("Error in cancelSingleProduct:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    };


const returnSingleProduct = async (req, res) => {
    const { orderId, singleProductId } = req.body;
    const oid = new mongoose.Types.ObjectId(singleProductId);

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(singleProductId)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    const order = await Order.findOne({ _id: orderId });
    const productIndex = order.orderedItems.findIndex((item) => item.product.toString() === singleProductId);
    const orderedItemPrice = order.orderedItems[productIndex].price;
    const newPrice = order.totalPrice - orderedItemPrice;

    try {
        const filter = { _id: orderId };
        const update = {
            $set: {
                "orderedItems.$[elem].productStatus": "returned",
                totalPrice: newPrice,
            },
        };
        const options = {
            arrayFilters: [{ "elem.product": oid }]
        };
        const result = await Order.updateOne(filter, update, options);
        res.status(200).json({ message: "Product status updated successfully", result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}



const returnorder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.body;
        const findOrder = await Order.findOne({ _id: orderId });
        if (!findOrder) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (findOrder.status === "returned") {
            return res.status(400).json({ message: "Order is already returned" });
        }
        await Order.updateOne({ _id: orderId }, { status: "return request" });
        res.status(200).json({ message: "Return request initiated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const changeSingleProductStatus = async (req, res) => {
    const { orderId, singleProductId, status } = req.body;
    const oid = new mongoose.Types.ObjectId(singleProductId);

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(singleProductId)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    const order = await Order.findOne({ _id: orderId });
    const productIndex = order.orderedItems.findIndex((item) => item.product.toString() === singleProductId);
    const orderedItemPrice = order.orderedItems[productIndex].price;
    const newPrice = order.totalPrice - orderedItemPrice;

    try {
        const filter = { _id: orderId };
        const update = {
            $set: {
                "orderedItems.$[elem].productStatus": status,
                totalPrice: newPrice,
            },
        };
        const options = {
            arrayFilters: [{ "elem.product": oid }]
        };
        const result = await Order.updateOne(filter, update, options);
        res.status(200).json({ message: "Product status updated successfully", result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/*  const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate('userId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const data = {
            "documentTitle": "INVOICE",
            "currency": "INR",
            "taxNotation": "gst",
            "marginTop": 25,
            "marginRight": 25,
            "marginLeft": 25,
            "marginBottom": 25,
            apiKey: process.env.EASYINVOICE_API,
            mode: "development",
            images: {
                logo: "https://firebasestorage.googleapis.com/v0/b/ecommerce-397a7.appspot.com/o/logo.jpg?alt=media&token=07b6be19-1ce8-4797-a3a0-f0eaeaafedad",
            },
            "sender": {
                "company": "Trend Setter",
                "address": "Thrikkakkara",
                "zip": "682021",
                "city": "Kochi",
                "country": "India"
            },
            "client": {
                "company": order.address.name,
                "address": `${order.address.landMark}, ${order.address.city}`,
                "zip": order.address.pincode,
                "city": order.address.state,
                "country": "India"
            },
            "information": {
                "number": order.orderId,
                "date": moment(order.createdOn).format("YYYY-MM-DD HH:mm:ss")
            },
            "products": order.orderedItems.map(item => ({
                "quantity": item.quantity,
                "description": item.product.productName || "Product",
                "tax": 0,
                "price": item.price,
            })),
            "bottomNotice": "Thank you for your business",
        };

        const result = await easyinvoice.createInvoice(data);
        const invoicePath = path.join(__dirname, "../../public/invoice/", `invoice_${orderId}.pdf`);
        fs.writeFileSync(invoicePath, result.pdf, 'base64');
        res.download(invoicePath, `invoice_${orderId}.pdf`, (err) => {
            if (err) {
                console.error("Error downloading the file", err);
            }
            fs.unlinkSync(invoicePath);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the invoice');
    }
};  */

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate('orderedItems.product');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const data = {
            "documentTitle": "INVOICE",
            "currency": "INR",
            "taxNotation": "gst",
            "marginTop": 25,
            "marginRight": 25,
            "marginLeft": 25,
            "marginBottom": 25,
            apiKey: process.env.EASYINVOICE_API,
            mode:"production",
            // Removed logo image
            "sender": {
                "company": "Male Fashion", // Updated company name
                "address": "Thrikkakkara",
                "zip": "682021",
                "city": "Kochi",
                "country": "India"
            },
            "client": {
                "company": order.address.name,
                "address": `${order.address.landMark}, ${order.address.city}`,
                "zip": order.address.pincode,
                "city": order.address.state,
                "country": "India"
            },
            "information": {
                "number": order.orderId,
                "date": moment(order.createdOn).format("YYYY-MM-DD HH:mm:ss")
            },
            "products": order.orderedItems.map(item => ({
                "quantity": item.quantity,
                "description": item.product.name || "Product",
                "tax": 0,
                "price": item.price,
            })),
            "bottomNotice": "Thank you for your business",
        };

        const result = await easyinvoice.createInvoice(data);
        const invoicePath = path.join(__dirname, "../../public/invoice/", `invoice_${orderId}.pdf`);
        fs.writeFileSync(invoicePath, result.pdf, 'base64');
        res.download(invoicePath, `invoice_${orderId}.pdf`, (err) => {
            if (err) {
                console.error("Error downloading the file", err);
            }
            fs.unlinkSync(invoicePath);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the invoice');
    }
};
module.exports = {
    getCheckoutPage,
    deleteProduct,
    orderPlaced,
    getOrderDetailsPage,
    cancelOrder,
    changeSingleProductStatus,
    returnorder,
    downloadInvoice,
    returnSingleProduct,
    cancelSingleProduct,
};