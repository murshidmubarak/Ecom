// const User = require("../../models/userSchema");
// const Product = require("../../models/productSchema");
// const Address = require("../../models/addressSchema");
// const Order = require("../../models/orderSchema");
// const mongodb = require("mongodb");
// const mongoose = require('mongoose');
// const env = require("dotenv").config();
// const crypto = require("crypto");
// const { v4: uuidv4 } = require('uuid');
// const Wallet = require("../../models/walletSchema");
// const Cart = require("../../models/cartSchema");

// const getOrderListPageAdmin = async (req, res) => {
//   try {
//       const { page = 1, search = '' } = req.query;
//       const itemsPerPage = 5;
//       const currentPage = parseInt(page) || 1;

//       let query = {};
//       let orders = [];

//       if (search) {
//           // Search by orderId
//           const orderIdQuery = { orderId: { $regex: search, $options: 'i' } };

//           // Search by user email
//           const users = await User.find({ email: { $regex: search, $options: 'i' } }, '_id');
//           const userIds = users.map(user => user._id);
//           const emailQuery = { userId: { $in: userIds } };

//           query = {
//               $or: [orderIdQuery, emailQuery]
//           };
//       }

//       orders = await Order.find(query)
//           .populate('userId', 'email')
//           .populate('orderedItems.product', 'productName productImage')
//           .sort({ createdOn: -1 });

//       console.log('Search query:', query);
//       console.log('Found orders:', orders.length, 'orders');

//       const totalOrders = orders.length;
//       const totalPages = Math.ceil(totalOrders / itemsPerPage);
//       const startIndex = (currentPage - 1) * itemsPerPage;
//       const endIndex = startIndex + itemsPerPage;
//       const currentOrders = orders.slice(startIndex, endIndex);

//       res.render("order-list", {
//           orders: currentOrders,
//           totalPages,
//           currentPage,
//           search,
//       });
//   } catch (error) {
//       console.error('Error in getOrderListPageAdmin:', error.stack);
//       res.redirect("/pageerror");
//   }
// };

// const changeOrderStatus = async (req, res) => {
//   try {
//       const { orderId, userId, status } = req.query;
      
//       const updateResult = await Order.updateOne({ _id: orderId }, { status });
//       console.log('Order status update result:', updateResult);

//       const findOrder = await Order.findOne({ _id: orderId });

//       if (findOrder.status.trim() === "returned" && 
//           ["razorpay", "wallet", "cod"].includes(findOrder.payment)) {
//           const findUser = await User.findOne({ _id: userId });
//           if (findUser && findUser.wallet !== undefined) {
//               findUser.wallet += findOrder.finalAmount; // Use finalAmount for refund
//               await findUser.save();
//               console.log('Refunded to user wallet:', findUser.wallet);
              
//               let userWallet = await Wallet.findOne({ userId });
//               if (!userWallet) {
//                   userWallet = new Wallet({ userId, transactions: [] });
//               }
//               const transaction = {
//                   transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//                   amount: findOrder.finalAmount,
//                   type: "credit",
//                   description: "refund",
//                   orderId: orderId,
//                   balanceAfter: findUser.wallet,
//                   status: "completed",
//                   transactionDate: Date.now(),
//               };
//               userWallet.transactions.push(transaction);
//               await userWallet.save();
//               console.log('Wallet transaction added:', transaction);
//           } else {
//               console.log("User not found or wallet is undefined");
//           }

//           for (const item of findOrder.orderedItems) {
//               const productId = item.product;
//               const quantity = item.quantity;
//               const product = await Product.findById(productId);
//               if (product) {
//                   product.quantity += quantity;
//                   await product.save();
//                   console.log('Stock restored for product:', productId);
//               } else {
//                   console.log("Product not found:", productId);
//               }
//           }
//       }
      
//       return res.redirect("/admin/order-list");
//   } catch (error) {
//       console.error('Error in changeOrderStatus:', error.stack);
//       return res.redirect("/pageerror");
//   }
// };

// const getOrderDetailsPageAdmin = async (req, res) => {
//   try {
//       const orderId = req.query.id;
//       const findOrder = await Order.findOne({ _id: orderId })
//           .populate("orderedItems.product")
//           .populate("userId")
//           .sort({ createdOn: 1 });

//       if (!findOrder) {
//           throw new Error("Order not found");
//       }

//       const orderedItems = Array.isArray(findOrder.orderedItems) ? findOrder.orderedItems : [];
//       let totalGrant = 0;
//       orderedItems.forEach((val) => {
//           totalGrant += (val.price || 0) * (val.quantity || 1);
//       });

//       const totalPrice = findOrder.totalPrice || 0;
//       const finalAmount = findOrder.finalAmount || totalPrice;

//       res.render("order-details-admin", {
//           orders: findOrder,
//           orderId: orderId,
//           finalAmount: finalAmount,
//       });
//   } catch (error) {
//       console.error("Error in getOrderDetailsPageAdmin:", error.stack);
//       res.redirect("/pageerror");
//   }
// };

// const approveReturnRequest = async (req, res) => {
//   try {
//       const { orderId, singleProductId, action } = req.body;
//       console.log("approveReturnRequest - Request Body:", { orderId, singleProductId, action });

//       if (!mongoose.Types.ObjectId.isValid(orderId)) {
//           console.log("Invalid orderId:", orderId);
//           return res.status(400).json({ message: "Invalid order ID" });
//       }

//       const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
//       if (!order) {
//           console.log("Order not found for ID:", orderId);
//           return res.status(404).json({ message: "Order not found" });
//       }
//       console.log("Order details:", {
//           orderId: order._id,
//           payment: order.payment,
//           totalPrice: order.totalPrice,
//           finalAmount: order.finalAmount,
//           discount: order.discount,
//           couponApplied: order.couponApplied,
//           userId: order.userId,
//       });

//       if (singleProductId) {
//           // Single product return request
//           if (!mongoose.Types.ObjectId.isValid(singleProductId)) {
//               console.log("Invalid singleProductId:", singleProductId);
//               return res.status(400).json({ message: "Invalid product ID" });
//           }

//           const oid = new mongoose.Types.ObjectId(singleProductId);
//           const productIndex = order.orderedItems.findIndex(
//               (item) => item.product._id.toString() === singleProductId
//           );
//           if (productIndex === -1) {
//               console.log("Product not found in order:", singleProductId);
//               return res.status(404).json({ message: "Product not found in order" });
//           }

//           if (order.orderedItems[productIndex].productStatus !== "return-requested") {
//               console.log("Product status not 'return-requested':", order.orderedItems[productIndex].productStatus);
//               return res.status(400).json({ message: "No return request pending for this product" });
//           }

//           if (action === "approve") {
//               const orderedItemPrice = order.orderedItems[productIndex].price;
//               const originalTotalPrice = order.totalPrice + order.discount;
//               const newTotalPrice = order.totalPrice - orderedItemPrice;
//               let newDiscount = order.discount;
//               let newFinalAmount = order.finalAmount;
//               let refundAmount = orderedItemPrice;

//               // Adjust discount and final amount if coupon applied
//               if (order.couponApplied.includes("true") && order.discount > 0) {
//                   const priceProportion = newTotalPrice / originalTotalPrice;
//                   newDiscount = Number((order.discount * priceProportion).toFixed(2));
//                   newFinalAmount = Number((newTotalPrice - newDiscount).toFixed(2));
//                   refundAmount = Number(
//                       (orderedItemPrice - (order.discount * (orderedItemPrice / originalTotalPrice))).toFixed(2)
//                   );
//                   console.log("Discount calculation:", {
//                       priceProportion,
//                       newDiscount,
//                       newFinalAmount,
//                       refundAmount,
//                   });
//               } else {
//                   newFinalAmount = newTotalPrice;
//                   console.log("No coupon applied, refund full item price:", refundAmount);
//               }

//               console.log("Single product return approved:", {
//                   refundAmount,
//                   newTotalPrice,
//                   newDiscount,
//                   newFinalAmount,
//               });

//               // Update order
//               const filter = { _id: orderId };
//               const update = {
//                   $set: {
//                       "orderedItems.$[elem].productStatus": "returned",
//                       totalPrice: newTotalPrice,
//                       finalAmount: newFinalAmount,
//                       discount: newDiscount,
//                   },
//               };
//               const options = { arrayFilters: [{ "elem.product": oid }] };
//               const orderUpdateResult = await Order.updateOne(filter, update, options);
//               console.log("Order update result:", orderUpdateResult);

//               if (orderUpdateResult.modifiedCount === 0) {
//                   console.log("Order update failed - no changes made");
//                   return res.status(500).json({ message: "Failed to update order status" });
//               }

//               // Restore stock
//               const product = await Product.findById(singleProductId);
//               if (product) {
//                   product.quantity = parseInt(product.quantity) + order.orderedItems[productIndex].quantity;
//                   await product.save();
//                   console.log("Stock restored for product:", singleProductId, "New quantity:", product.quantity);
//               } else {
//                   console.log("Product not found for stock update:", singleProductId);
//               }

//               // Check if all items are returned or cancelled
//               const updatedOrder = await Order.findOne({ _id: orderId });
//               const allReturnedOrCancelled = updatedOrder.orderedItems.every(
//                   (item) => item.productStatus === "returned" || item.productStatus === "cancelled"
//               );
//               if (allReturnedOrCancelled) {
//                   await Order.updateOne(
//                       { _id: orderId },
//                       {
//                           status: "returned",
//                           totalPrice: 0,
//                           finalAmount: 0,
//                           discount: 0,
//                           couponApplied: ["false"],
//                       }
//                   );
//                   console.log("All items returned or cancelled, order status set to 'returned'");
//               }

//               // Refund to wallet for all payment methods
//               const user = await User.findById(order.userId);
//               if (!user) {
//                   console.log("User not found for ID:", order.userId);
//                   return res.status(404).json({ message: "User not found" });
//               }
//               console.log("User found:", { id: user._id, currentWallet: user.wallet });

//               const oldWalletBalance = user.wallet || 0;
//               user.wallet = oldWalletBalance + refundAmount;
//               const userSaveResult = await user.save();
//               console.log("User wallet update:", {
//                   oldBalance: oldWalletBalance,
//                   refundAmount,
//                   newBalance: user.wallet,
//                   saveResult: { modifiedCount: userSaveResult.modifiedCount, wallet: userSaveResult.wallet },
//               });

//               if (userSaveResult.wallet !== user.wallet) {
//                   console.log("User wallet save failed - balance mismatch");
//                   return res.status(500).json({ message: "Failed to update user wallet" });
//               }

//               let userWallet = await Wallet.findOne({ userId: order.userId });
//               if (!userWallet) {
//                   console.log("No wallet found for user. Creating new wallet.");
//                   userWallet = new Wallet({ userId: order.userId, transactions: [] });
//               }

//               const transaction = {
//                   transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//                   amount: refundAmount,
//                   type: "credit",
//                   description: "refund",
//                   orderId: orderId,
//                   balanceAfter: user.wallet,
//                   status: "completed",
//                   transactionDate: Date.now(),
//               };
//               userWallet.transactions.push(transaction);
//               userWallet.updatedAt = Date.now();
//               const walletSaveResult = await userWallet.save();
//               console.log("Wallet transaction added:", transaction, "Save result:", walletSaveResult);

//               res.status(200).json({ message: "Return request approved for product", order: updatedOrder });
//           } else if (action === "reject") {
//               const filter = { _id: orderId };
//               const update = { $set: { "orderedItems.$[elem].productStatus": "return-rejected" } };
//               const options = { arrayFilters: [{ "elem.product": oid }] };
//               await Order.updateOne(filter, update, options);
//               console.log("Return request rejected for product:", singleProductId);
//               res.status(200).json({ message: "Return request rejected for product" });
//           }
//       } else {
//           // Entire order return request
//           if (order.status !== "return-requested") {
//               console.log("Order status not 'return-requested':", order.status);
//               return res.status(400).json({ message: "No return request pending for this order" });
//           }

//           if (action === "approve") {
//               const refundAmount = order.finalAmount; // Refund the final amount (after discount)
//               console.log("Full order return approved. Refund amount:", refundAmount);

//               // Update order status and reset prices
//               const orderUpdateResult = await Order.updateOne(
//                   { _id: orderId },
//                   {
//                       status: "returned",
//                       totalPrice: 0,
//                       finalAmount: 0,
//                       discount: 0,
//                       couponApplied: ["false"],
//                       "orderedItems.$[].productStatus": "returned",
//                   }
//               );
//               console.log("Order status update result:", orderUpdateResult);

//               // Restore stock for all items
//               for (const item of order.orderedItems) {
//                   const product = await Product.findById(item.product);
//                   if (product) {
//                       product.quantity = parseInt(product.quantity) + item.quantity;
//                       await product.save();
//                       console.log("Stock restored for product:", item.product, "New quantity:", product.quantity);
//                   }
//               }

//               // Refund to wallet for all payment methods
//               const user = await User.findById(order.userId);
//               if (!user) {
//                   console.log("User not found for ID:", order.userId);
//                   return res.status(404).json({ message: "User not found" });
//               }
//               console.log("User found:", { id: user._id, currentWallet: user.wallet });

//               const oldWalletBalance = user.wallet || 0;
//               user.wallet = oldWalletBalance + refundAmount;
//               const userSaveResult = await user.save();
//               console.log("User wallet update:", {
//                   oldBalance: oldWalletBalance,
//                   refundAmount,
//                   newBalance: user.wallet,
//                   saveResult: { modifiedCount: userSaveResult.modifiedCount, wallet: userSaveResult.wallet },
//               });

//               if (userSaveResult.wallet !== user.wallet) {
//                   console.log("User wallet save failed - balance mismatch");
//                   return res.status(500).json({ message: "Failed to update user wallet" });
//               }

//               let userWallet = await Wallet.findOne({ userId: order.userId });
//               if (!userWallet) {
//                   console.log("No wallet found for user. Creating new wallet.");
//                   userWallet = new Wallet({ userId: order.userId, transactions: [] });
//               }

//               const transaction = {
//                   transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//                   amount: refundAmount,
//                   type: "credit",
//                   description: "refund",
//                   orderId: orderId,
//                   balanceAfter: user.wallet,
//                   status: "completed",
//                   transactionDate: Date.now(),
//               };
//               userWallet.transactions.push(transaction);
//               userWallet.updatedAt = Date.now();
//               const walletSaveResult = await userWallet.save();
//               console.log("Wallet transaction added:", transaction, "Save result:", walletSaveResult);

//               const updatedOrder = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
//               res.status(200).json({ message: "Return request approved for order", order: updatedOrder });
//           } else if (action === "reject") {
//               const updateResult = await Order.updateOne(
//                   { _id: orderId },
//                   { status: "delivered", "orderedItems.$[].productStatus": "return-rejected" }
//               );
//               console.log("Return request rejected for order:", orderId, "Update result:", updateResult);
//               res.status(200).json({ message: "Return request rejected for order" });
//           }
//       }
//   } catch (error) {
//       console.error("Error in approveReturnRequest:", error.stack);
//       res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// module.exports = {
//   getOrderListPageAdmin,
//   changeOrderStatus,
//   getOrderDetailsPageAdmin,
//   approveReturnRequest,
// };

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

      console.log('Search query:', query);
      console.log('Found orders:', orders.length, 'orders');

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
      console.error('Error in getOrderListPageAdmin:', error.stack);
      res.redirect("/pageerror");
  }
};

const changeOrderStatus = async (req, res) => {
  try {
      const { orderId, userId, status } = req.query;
      
      const updateResult = await Order.updateOne({ _id: orderId }, { status });
      console.log('Order status update result:', updateResult);

      const findOrder = await Order.findOne({ _id: orderId });

      if (findOrder.status.trim() === "returned" && 
          ["razorpay", "wallet", "cod"].includes(findOrder.payment)) {
          const findUser = await User.findOne({ _id: userId });
          if (findUser && findUser.wallet !== undefined) {
              findUser.wallet += findOrder.finalAmount;
              await findUser.save();
              console.log('Refunded to user wallet:', findUser.wallet);
              
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
              console.log('Wallet transaction added:', transaction);
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
                  console.log('Stock restored for product:', productId);
              } else {
                  console.log("Product not found:", productId);
              }
          }
      }
      
      return res.redirect("/admin/order-list");
  } catch (error) {
      console.error('Error in changeOrderStatus:', error.stack);
      return res.redirect("/pageerror");
  }
};

// const getOrderDetailsPageAdmin = async (req, res) => {
//   try {
//       const orderId = req.query.id;
//       const findOrder = await Order.findOne({ _id: orderId })
//           .populate("orderedItems.product")
//           .populate("userId")
//           .sort({ createdOn: 1 });

//       if (!findOrder) {
//           throw new Error("Order not found");
//       }

//       const orderedItems = Array.isArray(findOrder.orderedItems) ? findOrder.orderedItems : [];
//       let totalGrant = 0;
//       orderedItems.forEach((val) => {
//           totalGrant += (val.price || 0) * (val.quantity || 1);
//       });

//       const totalPrice = findOrder.totalPrice || 0;
//       const finalAmount = findOrder.finalAmount || totalPrice;

//       res.render("order-details-admin", {
//           orders: findOrder,
//           orderId: orderId,
//           finalAmount: finalAmount,
//       });
//   } catch (error) {
//       console.error("Error in getOrderDetailsPageAdmin:", error.stack);
//       res.redirect("/pageerror");
//   }
// };
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
      console.error("Error in getOrderDetailsPageAdmin:", error.stack);
      res.redirect("/pageerror");
  }
};
// const returnSingleProduct = async (req, res) => {
//   try {
//       const { orderId, singleProductId, returnReason } = req.body;
//       console.log("return reason", returnReason, "orderIdssss:", orderId, "singleProductIdssss:", singleProductId);

//       if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(singleProductId)) {
//           return res.status(400).json({ message: "Invalid order or product ID" });
//       }

//       const order = await Order.findOne({ _id: orderId });
//       if (!order) {
//           return res.status(404).json({ message: "Order not found" });
//       }

//       const productIndex = order.orderedItems.findIndex(
//           (item) => item.product.toString() === singleProductId
//       );
//       if (productIndex === -1) {
//           return res.status(404).json({ message: "Product not found in order" });
//       }

//       if (!['shipped', 'delivered'].includes(order.status)) {
//           return res.status(400).json({ message: "Order status does not allow return" });
//       }

//       if (order.orderedItems[productIndex].productStatus !== 'confirmed' &&
//           order.orderedItems[productIndex].productStatus !== 'shipped' &&
//           order.orderedItems[productIndex].productStatus !== 'delivered') {
//           return res.status(400).json({ message: "Product cannot be returned due to its current status" });
//       }

//       const filter = { _id: orderId };
//       const update = {
//           $set: {
//               "orderedItems.$[elem].productStatus": "return-requested",
//               "orderedItems.$[elem].returnReason": returnReason
//           }
//       };
//       const options = {
//           arrayFilters: [{ "elem.product": new mongoose.Types.ObjectId(singleProductId) }]
//       };

//       const updateResult = await Order.updateOne(filter, update, options);
//       if (updateResult.modifiedCount === 0) {
//           return res.status(500).json({ message: "Failed to submit return request" });
//       }

//       const allItemsRequestedReturn = order.orderedItems.every(
//           (item) => item.productStatus === 'return-requested' || item.productStatus === 'cancelled' || item.productStatus === 'returned'
//       );
//       if (allItemsRequestedReturn) {
//           await Order.updateOne({ _id: orderId }, { status: 'return-requested' });
//       }

//       res.status(200).json({ message: "Return request submitted to admin for approval" });
//   } catch (error) {
//       console.error("Error in returnSingleProduct:", error.stack);
//       res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

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

          console.log("Return reason for product:", order.orderedItems[productIndex].returnReason);

          if (action === "approve") {
              const orderedItemPrice = order.orderedItems[productIndex].price;
              const originalTotalPrice = order.totalPrice + order.discount;
              const newTotalPrice = order.totalPrice - orderedItemPrice;
              let newDiscount = order.discount;
              let newFinalAmount = order.finalAmount;
              let refundAmount = orderedItemPrice;

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

              const product = await Product.findById(singleProductId);
              if (product) {
                  product.quantity = parseInt(product.quantity) + order.orderedItems[productIndex].quantity;
                  await product.save();
                  console.log("Stock restored for product:", singleProductId, "New quantity:", product.quantity);
              } else {
                  console.log("Product not found for stock update:", singleProductId);
              }

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
          if (order.status !== "return-requested") {
              console.log("Order status not 'return-requested':", order.status);
              return res.status(400).json({ message: "No return request pending for this order" });
          }

          if (action === "approve") {
              const refundAmount = order.finalAmount;
              console.log("Full order return approved. Refund amount:", refundAmount);

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

              for (const item of order.orderedItems) {
                  const product = await ingestion.findById(item.product);
                  if (product) {
                      product.quantity = parseInt(product.quantity) + item.quantity;
                      await product.save();
                      console.log("Stock restored for product:", item.product, "New quantity:", product.quantity);
                  }
              }

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
//   returnSingleProduct,
  approveReturnRequest,
};