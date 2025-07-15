

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

      const csrfToken = req.csrfToken() ? req.csrfToken() : null

      res.render("order-list", {
          csrfToken,
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


// const approveReturnRequest = async (req, res) => {
//   try {
//       const { orderId, singleProductId, action } = req.body;

//       if (!mongoose.Types.ObjectId.isValid(orderId)) {
          
//           return res.status(400).json({ message: "Invalid order ID" });
//       }

//       const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
//       if (!order) {
          
//           return res.status(404).json({ message: "Order not found" });
//       }
      
//       if (singleProductId) {
//           if (!mongoose.Types.ObjectId.isValid(singleProductId)) {
             
//               return res.status(400).json({ message: "Invalid product ID" });
//           }

//           const oid = new mongoose.Types.ObjectId(singleProductId);
//           const productIndex = order.orderedItems.findIndex(
//               (item) => item.product._id.toString() === singleProductId
//           );
//           if (productIndex === -1) {
              
//               return res.status(404).json({ message: "Product not found in order" });
//           }

//           if (order.orderedItems[productIndex].productStatus !== "return-requested") {
           
//               return res.status(400).json({ message: "No return request pending for this product" });
//           }

//           console.log("Return reason for product:", order.orderedItems[productIndex].returnReason);

//           if (action === "approve") {
//               const orderedItemPrice = order.orderedItems[productIndex].price;
//               const originalTotalPrice = order.totalPrice + order.discount;
//               const newTotalPrice = order.totalPrice - orderedItemPrice;
//               let newDiscount = order.discount;
//               let newFinalAmount = order.finalAmount;
//               let refundAmount = orderedItemPrice;

//               if (order.couponApplied.includes("true") && order.discount > 0) {
//                   const priceProportion = newTotalPrice / originalTotalPrice;
//                   newDiscount = Number((order.discount * priceProportion).toFixed(2));
//                   newFinalAmount = Number((newTotalPrice - newDiscount).toFixed(2));
//                   refundAmount = Number(
//                       (orderedItemPrice - (order.discount * (orderedItemPrice / originalTotalPrice))).toFixed(2)
//                   );
                
//               } else {
//                   newFinalAmount = newTotalPrice;
                  
//               }

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
              

//               if (orderUpdateResult.modifiedCount === 0) {
                 
//                   return res.status(500).json({ message: "Failed to update order status" });
//               }

//               const product = await Product.findById(singleProductId);
//               if (product) {
//                   product.quantity = parseInt(product.quantity) + order.orderedItems[productIndex].quantity;
//                   await product.save();
                  
//               } else {
//                   console.log("Product not found for stock update:", singleProductId);
//               }

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

//               const user = await User.findById(order.userId);
//               if (!user) {
                 
//                   return res.status(404).json({ message: "User not found" });
//               }
//               console.log("User found:", { id: user._id, currentWallet: user.wallet });

//               const oldWalletBalance = user.wallet || 0;
//               user.wallet = oldWalletBalance + refundAmount;
//               const userSaveResult = await user.save();
           

//               if (userSaveResult.wallet !== user.wallet) {
                 
//                   return res.status(500).json({ message: "Failed to update user wallet" });
//               }

//               let userWallet = await Wallet.findOne({ userId: order.userId });
//               if (!userWallet) {
                 
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
              
//               res.status(200).json({ message: "Return request rejected for product" });
//           }
//       } else {
//           if (order.status !== "return-requested") {
//               return res.status(400).json({ message: "No return request pending for this order" });
//           }

//           if (action === "approve") {
//               const refundAmount = order.finalAmount;
//               console.log("Full order return approved. Refund amount:", refundAmount);

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

//               for (const item of order.orderedItems) {
//                   const product = await ingestion.findById(item.product);
//                   if (product) {
//                       product.quantity = parseInt(product.quantity) + item.quantity;
//                       await product.save();
//                       console.log("Stock restored for product:", item.product, "New quantity:", product.quantity);
//                   }
//               }

//               const user = await User.findById(order.userId);
//               if (!user) {
//                   console.log("User not found for ID:", order.userId);
//                   return res.status(404).json({ message: "User not found" });
//               }
//               console.log("User found:", { id: user._id, currentWallet: user.wallet });

//               const oldWalletBalance = user.wallet || 0;
//               user.wallet = oldWalletBalance + refundAmount;
//               const userSaveResult = await user.save();
              

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

      
    //   const orderedItemPrice = productItem.price;
    //   const productTotal = orderedItemPrice * quantity;
    //   const originalTotalPrice = order.totalPrice + order.discount;
    
    const orderedItem = order.orderedItems[productIndex];
     const quantity = orderedItem.quantity;
     console.log("Quantity of product being returned:", quantity);
     const totalOrderAmount = order.totalPrice + order.discount;
        console.log("Total order amount:", totalOrderAmount);
     const productPrice = orderedItem.price;
        console.log("Price of product being returned:", productPrice);
     const discountPercentage =(productPrice / totalOrderAmount) * 100;
        console.log("Discount percentage for product:", discountPercentage);
     const discountAmountForSingleProduct = (discountPercentage / 100) * order.discount;
        console.log("Discount amount for single product:", discountAmountForSingleProduct);
     const refundAmount = productPrice * quantity - discountAmountForSingleProduct * quantity;

        console.log("Refund amount calculated:", refundAmount);

   
  




      if (action === "approve") {

        const newTotalPrice = order.totalPrice - productPrice;
        console.log("New total price after return:", newTotalPrice);
        const newFinalAmount = order.finalAmount - refundAmount;
        console.log("New final amount after return:", newFinalAmount);
        const newDiscount = order.discount - discountAmountForSingleProduct;
        console.log("New discount after return:", newDiscount);

        // Update order and product status
        // let newTotalPrice = order.totalPrice - productTotal;
        // let newDiscount = order.discount;
        // let newFinalAmount = order.finalAmount;
        // let refundAmount = productTotal;

        // if (order.couponApplied.includes("true") && order.discount > 0) {
        //     coonsole.log("Coupon applied, calculating new discount and final amount",order.couponApplied);
        //   const discountPercentage = order.discount / originalTotalPrice;
        //   const discountOnProduct = discountPercentage * productTotal;
        //   refundAmount = Number((productTotal - discountOnProduct).toFixed(2));

        //   const priceProportion = newTotalPrice / originalTotalPrice;
        //   newDiscount = Number((order.discount * priceProportion).toFixed(2));
        //   newFinalAmount = Number((newTotalPrice - newDiscount).toFixed(2));
        // } else {
        //   newFinalAmount = newTotalPrice;
        // }

        // Update product status and order values
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

        if (orderUpdateResult.modifiedCount === 0) {
          return res.status(500).json({ message: "Failed to update order status" });
        }

        // Restock product
        const product = await Product.findById(singleProductId);
        if (product) {
          product.quantity = parseInt(product.quantity) + quantity;
          await product.save();
        }

        // Check if all products are returned/cancelled
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
        }

        // Update user wallet
        const user = await User.findById(order.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.wallet = (user.wallet || 0) + refundAmount;
        console.log("User wallet before save:", user.wallet);
        const userSaveResult = await user.save();

        if (!userSaveResult) {
          console.error("Failed to save user wallet");
        }

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
            status: "returned",
            totalPrice: 0,
            finalAmount: 0,
            discount: 0,
            couponApplied: ["false"],
            "orderedItems.$[].productStatus": "returned",
          }
        );

        // Restock all products
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