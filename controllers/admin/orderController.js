const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose');
const Wallet = require("../../models/walletSchema");


const getOrderListPageAdmin = async (req, res) => {
  try {
      const { page = 1, search = '' } = req.query;
      const itemsPerPage = 5;
      const currentPage = parseInt(page) || 1;

      let query = {};
      let orders = [];

      if (search) {
          const orderIdQuery = { orderId: { $regex: search, $options: 'i' } };
          const users = await User.find({ email: { $regex: search, $options: 'i' } }, '_id');
          const userIds = users.map(user => user._id);
          const emailQuery = { userId: { $in: userIds } };

          query = {
              $or: [orderIdQuery, emailQuery]
          };
      }

      orders = await Order.find(query)
          .populate('userId', 'email')
          .populate('orderedItems.product', 'productName productImage')
          .sort({ createdOn: -1 });

  

      const totalOrders = orders.length;
      const totalPages = Math.ceil(totalOrders / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentOrders = orders.slice(startIndex, endIndex);

      const csrfToken = req.csrfToken() ? req.csrfToken() : null

      res.render("order-list", {
          csrfToken,
          orders: currentOrders,
          totalPages,
          currentPage,
          search,
      });
  } catch (error) {
      
      res.redirect("/pageerror");
  }
};

const changeOrderStatus = async (req, res) => {
  try {
      const { orderId, userId, status } = req.query;
      
      const updateResult = await Order.updateOne({ _id: orderId }, { status });
   

      const findOrder = await Order.findOne({ _id: orderId });

      if (findOrder.status.trim() === "returned" && 
          ["razorpay", "wallet", "cod"].includes(findOrder.payment)) {
          const findUser = await User.findOne({ _id: userId });
          if (findUser && findUser.wallet !== undefined) {
              findUser.wallet += findOrder.finalAmount;
              await findUser.save();
            
              
              let userWallet = await Wallet.findOne({ userId });
              if (!userWallet) {
                  userWallet = new Wallet({ userId, transactions: [] });
              }
              const transaction = {
                  transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  amount: findOrder.finalAmount,
                  type: "credit",
                  description: "refund",
                  orderId: orderId,
                  balanceAfter: findUser.wallet,
                  status: "completed",
                  transactionDate: Date.now(),
              };
              userWallet.transactions.push(transaction);
              await userWallet.save();
              
          } else {
              console.log("User not found or wallet is undefined");
          }

          for (const item of findOrder.orderedItems) {
              const productId = item.product;
              const quantity = item.quantity;
              const product = await Product.findById(productId);
              if (product) {
                  product.quantity += quantity;
                  await product.save();
                 
              } else {
                  console.log("Product not found:", productId);
              }
          }
      }
      
      return res.redirect("/admin/order-list");
  } catch (error) {
      
      return res.redirect("/pageerror");
  }
};


const getOrderDetailsPageAdmin = async (req, res) => {
  try {
      const orderId = req.query.id;
      const findOrder = await Order.findOne({ _id: orderId })
          .populate({
              path: "orderedItems.product",
              select: "productName productImage"
          })
          .populate("userId", "email")
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
      const finalAmount = findOrder.finalAmount || totalPrice;

      res.render("order-details-admin", {
          orders: findOrder,
          orderId: orderId,
          finalAmount: finalAmount,
          totalGrant: totalGrant,
          totalPrice: totalPrice
      });
  } catch (error) {
      
      res.redirect("/pageerror");
  }
};




const approveReturnRequest = async (req, res) => {
  try {
    const { orderId, singleProductId, action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (singleProductId) {
      if (!mongoose.Types.ObjectId.isValid(singleProductId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const oid = new mongoose.Types.ObjectId(singleProductId);
      const productIndex = order.orderedItems.findIndex(
        (item) => item.product._id.toString() === singleProductId
      );

      if (productIndex === -1) {
        return res.status(404).json({ message: "Product not found in order" });
      }

      const productItem = order.orderedItems[productIndex];

      if (productItem.productStatus !== "return-requested") {
        return res.status(400).json({ message: "No return request pending for this product" });
      }

      const orderedItem = order.orderedItems[productIndex];
      const quantity = orderedItem.quantity;
      const totalOrderAmount = order.totalPrice + order.discount;
      const productPrice = orderedItem.price;
      const discountPercentage = (productPrice / totalOrderAmount) * 100;
      const discountAmountForSingleProduct = (discountPercentage / 100) * order.discount;
      const refundAmount = productPrice * quantity - discountAmountForSingleProduct * quantity;

      if (action === "approve") {
        const filter = { _id: orderId };
        const update = {
          $set: {
            "orderedItems.$[elem].productStatus": "returned",
          },
        };
        const options = { arrayFilters: [{ "elem.product": oid }] };
        const orderUpdateResult = await Order.updateOne(filter, update, options);

        if (orderUpdateResult.modifiedCount === 0) {
          return res.status(500).json({ message: "Failed to update order status" });
        }

        const product = await Product.findById(singleProductId);
        if (product) {
          product.quantity = parseInt(product.quantity) + quantity;
          await product.save();
        }

        const updatedOrder = await Order.findOne({ _id: orderId });
        const allReturnedOrCancelled = updatedOrder.orderedItems.every(
          (item) => item.productStatus === "returned" || item.productStatus === "cancelled"
        );

        if (allReturnedOrCancelled) {
          await Order.updateOne(
            { _id: orderId },
            {
              status: "returned" // ✅ ONLY STATUS UPDATED
            }
          );
        }

        const user = await User.findById(order.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.wallet = (user.wallet || 0) + refundAmount;
        await user.save();

        let userWallet = await Wallet.findOne({ userId: order.userId });
        if (!userWallet) {
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
        await userWallet.save();

        return res.status(200).json({ message: "Return request approved for product", order: updatedOrder });
      } else if (action === "reject") {
        const filter = { _id: orderId };
        const update = { $set: { "orderedItems.$[elem].productStatus": "return-rejected" } };
        const options = { arrayFilters: [{ "elem.product": oid }] };
        await Order.updateOne(filter, update, options);

        return res.status(200).json({ message: "Return request rejected for product" });
      }
    } else {
      // Full order return
      if (order.status !== "return-requested") {
        return res.status(400).json({ message: "No return request pending for this order" });
      }

      if (action === "approve") {
        const refundAmount = order.finalAmount;

        await Order.updateOne(
          { _id: orderId },
          {
            status: "returned", // ✅ ONLY STATUS UPDATED
            "orderedItems.$[].productStatus": "returned",
          }
        );

        for (const item of order.orderedItems) {
          const product = await Product.findById(item.product);
          if (product) {
            product.quantity = parseInt(product.quantity) + item.quantity;
            await product.save();
          }
        }

        const user = await User.findById(order.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.wallet = (user.wallet || 0) + refundAmount;
        await user.save();

        let userWallet = await Wallet.findOne({ userId: order.userId });
        if (!userWallet) {
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
        await userWallet.save();

        const updatedOrder = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
        return res.status(200).json({ message: "Return request approved for order", order: updatedOrder });
      } else if (action === "reject") {
        await Order.updateOne(
          { _id: orderId },
          { status: "delivered", "orderedItems.$[].productStatus": "return-rejected" }
        );

        return res.status(200).json({ message: "Return request rejected for order" });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


module.exports = {
  getOrderListPageAdmin,
  changeOrderStatus,
  getOrderDetailsPageAdmin,
 approveReturnRequest,
};