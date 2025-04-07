const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose');
const env = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require('uuid');

const getOrderListPageAdmin = async (req, res) => {
    try {
        const { page = 1, search = '' } = req.query; // Add search query support
        const itemsPerPage = 5; // Flexible items per page (changed from 3 to 5 for better UX)
        const currentPage = parseInt(page) || 1;

        // Build search query
        let query = {};
        if (search) {
            query = {
                $or: [
                    { orderId: { $regex: search, $options: 'i' } }, // Case-insensitive search by orderId
                    { 'userId.email': { $regex: search, $options: 'i' } }, // Search by user email (needs population)
                ],
            };
        }

        // Fetch orders with populated userId and orderedItems.product
        const orders = await Order.find(query)
            .populate('userId', 'email') // Populate user email
            .populate('orderedItems.product', 'productName productImage') // Populate product details
            .sort({ createdOn: -1 }); // Newest first

        const totalOrders = orders.length;
        const totalPages = Math.ceil(totalOrders / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentOrders = orders.slice(startIndex, endIndex);

        res.render("order-list", {
            orders: currentOrders,
            totalPages,
            currentPage,
            search, // Pass search term back to frontend
        });
    } catch (error) {
        console.error('Error in getOrderListPageAdmin:', error);
        res.redirect("/pageerror");
    }
};
  
  
  const changeOrderStatus = async (req, res) => {
    try {
      const orderId = req.query.orderId;
      const userId = req.query.userId;
      const status = req.query.status;
      
      await Order.updateOne({ _id: orderId }, { status }).then((data) => console.log(data));
  
      const findOrder = await Order.findOne({ _id: orderId });
  
      if (findOrder.status.trim() === "Returned" && 
          ["razorpay", "wallet", "cod"].includes(findOrder.payment)) {
        const findUser = await User.findOne({ _id: userId });
        if (findUser && findUser.wallet !== undefined) {
          findUser.wallet += findOrder.totalPrice;
          await findUser.save();
        } else {
          console.log("User not found or wallet is undefined");
        }
        
        await Order.updateOne({ _id: orderId }, { status: "Returned" });
        for (const productData of findOrder.product) {
          const productId = productData._id;
          const quantity = productData.quantity;
          const product = await Product.findById(productId);
          if (product) {
            product.quantity += quantity;
            await product.save();
          } else {
            console.log("Product not found");
          }
        }
      }
      
      
      return res.redirect("/admin/order-list");
    } catch (error) {
      console.error(error);
      return res.redirect("/pageerror");
    }
  };
  
  
  
 /*  const getOrderDetailsPageAdmin = async (req, res) => {
    try {
      const orderId = req.query.id;
      const findOrder = await Order.findOne({ _id: orderId }).sort({
        createdOn: 1,
      });
  
      if (!findOrder) {
        throw new Error('Order not found');
      }
  
      // Calculate total grant if needed
      let totalGrant = 0;
      findOrder.product.forEach((val) => {
        totalGrant += val.price * val.quantity;
      });
  
      const totalPrice = findOrder.totalPrice;
      const discount = totalGrant - totalPrice;
      const finalAmount = totalPrice; // Assuming finalAmount is the same as totalPrice
  
      // Add quantity to each product in findOrder
      findOrder.product.forEach((product) => {
        product.quantity = product.quantity || 1; // Set default quantity if not available
      });
  
      res.render("order-details-admin", {
        orders: findOrder,
        orderId: orderId,
        finalAmount: finalAmount,
      });
    } catch (error) {
      console.error(error);
      res.redirect("/pageerror");
    }
  }; */
  
  const getOrderDetailsPageAdmin = async (req, res) => {
    try {
      const orderId = req.query.id;
      const findOrder = await Order.findOne({ _id: orderId })
        .populate("orderedItems.product") // Populate Product references
        .populate("userId") // Populate User reference
        .sort({ createdOn: 1 });
  
      if (!findOrder) {
        throw new Error("Order not found");
      }
  
      // Default to empty array if orderedItems is undefined or not an array
      const orderedItems = Array.isArray(findOrder.orderedItems) ? findOrder.orderedItems : [];
      console.log("Ordered Items:", orderedItems); // Log to verify
      console.log("User:", findOrder.userId); // Log to verify user data
  
      // Calculate total grant based on orderedItems
      let totalGrant = 0;
      orderedItems.forEach((val) => {
        totalGrant += (val.price || 0) * (val.quantity || 1);
      });
  
      const totalPrice = findOrder.totalPrice || 0;
      const discount = totalGrant - totalPrice;
      const finalAmount = totalPrice;
  
      // Add quantity to each orderedItem (if not already present)
      orderedItems.forEach((item) => {
        item.quantity = item.quantity || 1;
      });
  
      res.render("order-details-admin", {
        orders: findOrder,
        orderId: orderId,
        finalAmount: finalAmount,
      });
    } catch (error) {
      console.error(error);
      res.redirect("/pageerror");
    }
  };

  module.exports = {
    getOrderListPageAdmin,
    changeOrderStatus,
    getOrderDetailsPageAdmin,
  }
  