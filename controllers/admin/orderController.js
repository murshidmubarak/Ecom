const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose');
const env = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require('uuid');
const Wallet = require("../../models/walletSchema");
const Cart = require("../../models/cartSchema");

const getOrderListPageAdmin = async (req, res) => {
  try {
      const { page = 1, search = '' } = req.query;
      const itemsPerPage = 5;
      const currentPage = parseInt(page) || 1;

      let query = {};
      if (search) {
          query = {
              $or: [
                  { orderId: { $regex: search, $options: 'i' } },
                  { 'userId.email': { $regex: search, $options: 'i' } },
              ],
          };
      }

      const orders = await Order.find(query)
          .populate('userId', 'email')
          .populate('orderedItems.product', 'productName productImage')
          .sort({ createdOn: -1 });

      const totalOrders = orders.length;
      const totalPages = Math.ceil(totalOrders / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentOrders = orders.slice(startIndex, endIndex);

      res.render("order-list", {
          orders: currentOrders,
          totalPages,
          currentPage,
          search,
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
            .populate("orderedItems.product")
            .populate("userId")
            .sort({ createdOn: 1 });

        if (!findOrder) {
            throw new Error("Order not found");
        }

        const orderedItems = Array.isArray(findOrder.orderedItems) ? findOrder.orderedItems : [];
        let totalGrant = 0;
        orderedItems.forEach((val) => {
            totalGrant += (val.price || 0) * (val.quantity || 1);
        });

        const totalPrice = findOrder.totalPrice || 0;
        const finalAmount = totalPrice;

        res.render("order-details-admin", {
            orders: findOrder,
            orderId: orderId,
            finalAmount: finalAmount,
        });
    } catch (error) {
        console.error("Error in getOrderDetailsPageAdmin:", error);
        res.redirect("/pageerror");
    }
};

/* const approveReturnRequest = async (req, res) => {
  try {
    const { orderId, singleProductId, action } = req.body;
    const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (singleProductId) {
      // Single product return request
      const oid = new mongoose.Types.ObjectId(singleProductId);
      const productIndex = order.orderedItems.findIndex(
        (item) => item.product._id.toString() === singleProductId
      );
      if (productIndex === -1) {
        return res.status(404).json({ message: "Product not found in order" });
      }

      if (order.orderedItems[productIndex].productStatus !== "return-requested") {
        return res.status(400).json({ message: "No return request pending for this product" });
      }

      if (action === "approve") {
        const orderedItemPrice = order.orderedItems[productIndex].price;
        const newPrice = order.totalPrice - orderedItemPrice;

        const filter = { _id: orderId };
        const update = {
          $set: {
            "orderedItems.$[elem].productStatus": "returned",
            totalPrice: newPrice,
          },
        };
        const options = { arrayFilters: [{ "elem.product": oid }] };
        await Order.updateOne(filter, update, options);

        // Restore stock
        const product = await Product.findById(singleProductId);
        if (product) {
          const currentQuantity = parseInt(product.quantity, 10);
          const newQuantity = currentQuantity + order.orderedItems[productIndex].quantity;
          product.quantity = newQuantity.toString();
          await product.save();
        }

        // Refund to wallet
        if (["razorpay", "wallet", "cod"].includes(order.payment)) {
          const user = await User.findById(order.userId);
          if (user && user.wallet !== undefined) {
            user.wallet += orderedItemPrice;
            await user.save();
          }
        }

        // Check if all items are returned
        const allReturned = order.orderedItems.every(item => item.productStatus === "returned");
        if (allReturned) {
          await Order.updateOne({ _id: orderId }, { status: "returned" });
        }

        res.status(200).json({ message: "Return request approved for product" });
      } else if (action === "reject") {
        const filter = { _id: orderId };
        const update = { $set: { "orderedItems.$[elem].productStatus": "return-rejected" } };
        const options = { arrayFilters: [{ "elem.product": oid }] };
        await Order.updateOne(filter, update, options);
        res.status(200).json({ message: "Return request rejected for product" });
      }
    } else {
      // Entire order return request
      if (order.status !== "return-requested") {
        return res.status(400).json({ message: "No return request pending for this order" });
      }

      if (action === "approve") {
        await Order.updateOne({ _id: orderId }, { status: "returned" });
        for (const item of order.orderedItems) {
          item.productStatus = "returned";
          const product = await Product.findById(item.product);
          if (product) {
            const currentQuantity = parseInt(product.quantity, 10);
            const newQuantity = currentQuantity + item.quantity;
            product.quantity = newQuantity.toString();
            await product.save();
          }
        }
        await order.save();

        // Refund to wallet
        if (["razorpay", "wallet", "cod"].includes(order.payment)) {
          const user = await User.findById(order.userId);
          if (user && user.wallet !== undefined) {
            user.wallet += order.totalPrice;
            await user.save();
          }
        }

        res.status(200).json({ message: "Return request approved for order" });
      } else if (action === "reject") {
        await Order.updateOne({ _id: orderId }, { status: "delivered" });
        for (const item of order.orderedItems) {
          if (item.productStatus === "return-requested") {
            item.productStatus = "return-rejected";
          }
        }
        await order.save();
        res.status(200).json({ message: "Return request rejected for order" });
      }
    }
  } catch (error) {
    console.error("Error in approveReturnRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}; */

const approveReturnRequest = async (req, res) => {
  try {
    const { orderId, singleProductId, action } = req.body;
    console.log("approveReturnRequest - Request Body:", { orderId, singleProductId, action });

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.log("Invalid orderId:", orderId);
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }
    console.log("Order details:", {
      orderId: order._id,
      payment: order.payment,
      totalPrice: order.totalPrice,
      finalAmount: order.finalAmount,
      discount: order.discount,
      couponApplied: order.couponApplied,
      userId: order.userId,
    });

    if (singleProductId) {
      // Single product return request
      if (!mongoose.Types.ObjectId.isValid(singleProductId)) {
        console.log("Invalid singleProductId:", singleProductId);
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const oid = new mongoose.Types.ObjectId(singleProductId);
      const productIndex = order.orderedItems.findIndex(
        (item) => item.product._id.toString() === singleProductId
      );
      if (productIndex === -1) {
        console.log("Product not found in order:", singleProductId);
        return res.status(404).json({ message: "Product not found in order" });
      }

      if (order.orderedItems[productIndex].productStatus !== "return-requested") {
        console.log("Product status not 'return-requested':", order.orderedItems[productIndex].productStatus);
        return res.status(400).json({ message: "No return request pending for this product" });
      }

      if (action === "approve") {
        const orderedItemPrice = order.orderedItems[productIndex].price;
        const originalTotalPrice = order.totalPrice + order.discount;
        const newTotalPrice = order.totalPrice - orderedItemPrice;
        let newDiscount = order.discount;
        let newFinalAmount = order.finalAmount;
        let refundAmount = orderedItemPrice;

        // Adjust discount and final amount if coupon applied
        if (order.couponApplied.includes("true") && order.discount > 0) {
          const priceProportion = newTotalPrice / originalTotalPrice;
          newDiscount = Number((order.discount * priceProportion).toFixed(2));
          newFinalAmount = Number((newTotalPrice - newDiscount).toFixed(2));
          refundAmount = Number(
            (orderedItemPrice - (order.discount * (orderedItemPrice / originalTotalPrice))).toFixed(2)
          );
          console.log("Discount calculation:", {
            priceProportion,
            newDiscount,
            newFinalAmount,
            refundAmount,
          });
        } else {
          newFinalAmount = newTotalPrice;
          console.log("No coupon applied, refund full item price:", refundAmount);
        }

        console.log("Single product return approved:", {
          refundAmount,
          newTotalPrice,
          newDiscount,
          newFinalAmount,
        });

        // Update order
        const filter = { _id: orderId };
        const update = {
          $set: {
            "orderedItems.$[elem].productStatus": "returned",
            totalPrice: newTotalPrice,
            finalAmount: newFinalAmount,
            discount: newDiscount,
          },
        };
        const options = { arrayFilters: [{ "elem.product": oid }] };
        const orderUpdateResult = await Order.updateOne(filter, update, options);
        console.log("Order update result:", orderUpdateResult);

        if (orderUpdateResult.modifiedCount === 0) {
          console.log("Order update failed - no changes made");
          return res.status(500).json({ message: "Failed to update order status" });
        }

        // Restore stock
        const product = await Product.findById(singleProductId);
        if (product) {
          product.quantity = parseInt(product.quantity) + order.orderedItems[productIndex].quantity;
          await product.save();
          console.log("Stock restored for product:", singleProductId, "New quantity:", product.quantity);
        } else {
          console.log("Product not found for stock update:", singleProductId);
        }

        // Check if all items are returned or cancelled
        const updatedOrder = await Order.findOne({ _id: orderId });
        const allReturnedOrCancelled = updatedOrder.orderedItems.every(
          (item) => item.productStatus === "returned" || item.productStatus === "cancelled"
        );
        if (allReturnedOrCancelled) {
          await Order.updateOne(
            { _id: orderId },
            {
              status: "returned",
              totalPrice: 0,
              finalAmount: 0,
              discount: 0,
              couponApplied: ["false"],
            }
          );
          console.log("All items returned or cancelled, order status set to 'returned'");
        }

        // Refund to wallet for all payment methods
        const user = await User.findById(order.userId);
        if (!user) {
          console.log("User not found for ID:", order.userId);
          return res.status(404).json({ message: "User not found" });
        }
        console.log("User found:", { id: user._id, currentWallet: user.wallet });

        const oldWalletBalance = user.wallet || 0;
        user.wallet = oldWalletBalance + refundAmount;
        const userSaveResult = await user.save();
        console.log("User wallet update:", {
          oldBalance: oldWalletBalance,
          refundAmount,
          newBalance: user.wallet,
          saveResult: { modifiedCount: userSaveResult.modifiedCount, wallet: userSaveResult.wallet },
        });

        if (userSaveResult.wallet !== user.wallet) {
          console.log("User wallet save failed - balance mismatch");
          return res.status(500).json({ message: "Failed to update user wallet" });
        }

        let userWallet = await Wallet.findOne({ userId: order.userId });
        if (!userWallet) {
          console.log("No wallet found for user. Creating new wallet.");
          userWallet = new Wallet({ userId: order.userId, transactions: [] });
        }

        const transaction = {
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          amount: refundAmount,
          type: "credit",
          description: "refund",
          orderId: orderId,
          balanceAfter: user.wallet,
          status: "completed",
          transactionDate: Date.now(),
        };
        userWallet.transactions.push(transaction);
        userWallet.updatedAt = Date.now();
        const walletSaveResult = await userWallet.save();
        console.log("Wallet transaction added:", transaction, "Save result:", walletSaveResult);

        res.status(200).json({ message: "Return request approved for product", order: updatedOrder });
      } else if (action === "reject") {
        const filter = { _id: orderId };
        const update = { $set: { "orderedItems.$[elem].productStatus": "return-rejected" } };
        const options = { arrayFilters: [{ "elem.product": oid }] };
        await Order.updateOne(filter, update, options);
        console.log("Return request rejected for product:", singleProductId);
        res.status(200).json({ message: "Return request rejected for product" });
      }
    } else {
      // Entire order return request
      if (order.status !== "return-requested") {
        console.log("Order status not 'return-requested':", order.status);
        return res.status(400).json({ message: "No return request pending for this order" });
      }

      if (action === "approve") {
        const refundAmount = order.finalAmount; // Refund the final amount (after discount)
        console.log("Full order return approved. Refund amount:", refundAmount);

        // Update order status and reset prices
        const orderUpdateResult = await Order.updateOne(
          { _id: orderId },
          {
            status: "returned",
            totalPrice: 0,
            finalAmount: 0,
            discount: 0,
            couponApplied: ["false"],
            "orderedItems.$[].productStatus": "returned",
          }
        );
        console.log("Order status update result:", orderUpdateResult);

        // Restore stock for all items
        for (const item of order.orderedItems) {
          const product = await Product.findById(item.product);
          if (product) {
            product.quantity = parseInt(product.quantity) + item.quantity;
            await product.save();
            console.log("Stock restored for product:", item.product, "New quantity:", product.quantity);
          }
        }

        // Refund to wallet for all payment methods
        const user = await User.findById(order.userId);
        if (!user) {
          console.log("User not found for ID:", order.userId);
          return res.status(404).json({ message: "User not found" });
        }
        console.log("User found:", { id: user._id, currentWallet: user.wallet });

        const oldWalletBalance = user.wallet || 0;
        user.wallet = oldWalletBalance + refundAmount;
        const userSaveResult = await user.save();
        console.log("User wallet update:", {
          oldBalance: oldWalletBalance,
          refundAmount,
          newBalance: user.wallet,
          saveResult: { modifiedCount: userSaveResult.modifiedCount, wallet: userSaveResult.wallet },
        });

        if (userSaveResult.wallet !== user.wallet) {
          console.log("User wallet save failed - balance mismatch");
          return res.status(500).json({ message: "Failed to update user wallet" });
        }

        let userWallet = await Wallet.findOne({ userId: order.userId });
        if (!userWallet) {
          console.log("No wallet found for user. Creating new wallet.");
          userWallet = new Wallet({ userId: order.userId, transactions: [] });
        }

        const transaction = {
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          amount: refundAmount,
          type: "credit",
          description: "refund",
          orderId: orderId,
          balanceAfter: user.wallet,
          status: "completed",
          transactionDate: Date.now(),
        };
        userWallet.transactions.push(transaction);
        userWallet.updatedAt = Date.now();
        const walletSaveResult = await userWallet.save();
        console.log("Wallet transaction added:", transaction, "Save result:", walletSaveResult);

        const updatedOrder = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
        res.status(200).json({ message: "Return request approved for order", order: updatedOrder });
      } else if (action === "reject") {
        const updateResult = await Order.updateOne(
          { _id: orderId },
          { status: "delivered", "orderedItems.$[].productStatus": "return-rejected" }
        );
        console.log("Return request rejected for order:", orderId, "Update result:", updateResult);
        res.status(200).json({ message: "Return request rejected for order" });
      }
    }
  } catch (error) {
    console.error("Error in approveReturnRequest:", error.stack);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

  module.exports = {
    getOrderListPageAdmin,
    changeOrderStatus,
    getOrderDetailsPageAdmin,
    approveReturnRequest,
  }
  