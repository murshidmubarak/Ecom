// const User = require("../../models/userSchema");
// const Product = require("../../models/productSchema");
// const Address = require("../../models/addressSchema");
// const Order = require("../../models/orderSchema");
// const Cart = require("../../models/cartSchema");
// const Coupon = require("../../models/coupenSchema");
// const mongoose = require("mongoose");
// const easyinvoice = require("easyinvoice");
// const moment = require("moment");
// const fs = require("fs");
// const path = require("path");
// const razorpayInstance = require("../../config/razorpay");
// const crypto = require("crypto");
// const Wallet = require("../../models/walletSchema");

// // Function to generate 4-character unique orderId
// const generateOrderId = async () => {
//   const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
//   let orderId;
//   let isUnique = false;
//   const length = 4;

//   while (!isUnique) {
//     orderId = '';
//     const bytes = crypto.randomBytes(length);
//     for (let i = 0; i < length; i++) {
//       orderId += characters[bytes[i] % characters.length];
//     }
//     const existingOrder = await Order.findOne({ orderId });
//     if (!existingOrder) isUnique = true;
//   }

//   return orderId;
// };

// const getCheckoutPage = async (req, res) => {
//   try {
//     const userId = req.session.user || req.query.userId;

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       console.log("getCheckoutPage - Invalid userId:", userId);
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const serverDate = new Date();
//     console.log("getCheckoutPage - Server date:", serverDate.toISOString(), "Timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);

//     const [user, cart, addressData, wallet, coupons] = await Promise.all([
//       User.findById(userId),
//       Cart.findOne({ userId }).populate({
//         path: "items.productId",
//         populate: { path: "category", model: "Category" },
//       }),
//       Address.findOne({ userId }),
//       Wallet.findOne({ userId }),
//       Coupon.find({
//         isActive: true,
//         status: { $regex: "^Active$", $options: "i" },
//         startDate: { $lte: serverDate },
//         endDate: { $gte: serverDate },
//       }),
//     ]);

//     if (!user) {
//       console.log("getCheckoutPage - User not found:", userId);
//       return res.status(404).json({ error: "User not found" });
//     }

//     if (!cart || !cart.items || cart.items.length === 0) {
//       console.log("getCheckoutPage - Cart empty for user:", userId);
//       return res.redirect("/shop");
//     }

//     console.log("getCheckoutPage - Raw coupons from DB:", JSON.stringify(coupons, null, 2));

//     const grandTotal = cart.items.reduce((total, item) => {
//       const salePrice = Number(item.productId.salePrice) || 0;
//       const quantity = Number(item.quantity) || 0;
//       return total + quantity * salePrice;
//     }, 0);
//     console.log("getCheckoutPage - Calculated grandTotal:", grandTotal);

//     const normalizedCouponApplied = user.couponApplied.map(code => code.toUpperCase());
//     console.log("getCheckoutPage - Normalized user.couponApplied:", normalizedCouponApplied);

//     const availableCoupons = coupons.filter(
//       coupon => {
//         const isValid = coupon.minimumPrice <= grandTotal &&
//                         !normalizedCouponApplied.includes(coupon.couponName.toUpperCase());
//         console.log("getCheckoutPage - Coupon filter:", {
//           couponName: coupon.couponName,
//           minimumPrice: coupon.minimumPrice,
//           grandTotal,
//           userApplied: normalizedCouponApplied,
//           isValid
//         });
//         return isValid;
//       }
//     );
//     console.log("getCheckoutPage - Available coupons after filtering:", JSON.stringify(availableCoupons, null, 2));

//     let errorMessage = null;

//     const blockedProducts = cart.items.filter(item => item.productId.isBlocked);
//     if (blockedProducts.length > 0) {
//       const blockedProductNames = blockedProducts
//         .map(item => item.productId.productName)
//         .join(", ");
//       errorMessage = `Cannot proceed to checkout. The following products are blocked: ${blockedProductNames}. Please remove them from your cart.`;
//     }

//     const unlistedCategoryProducts = cart.items.filter(
//       item => item.productId.category && !item.productId.category.isListed
//     );
//     if (unlistedCategoryProducts.length > 0 && !errorMessage) {
//       const unlistedProductNames = unlistedCategoryProducts
//         .map(item => item.productId.productName)
//         .join(", ");
//       errorMessage = `Cannot proceed to checkout. The following products belong to unlisted categories: ${unlistedProductNames}. Please remove them from your cart.`;
//     }

//     const cartData = cart.items.map((item) => ({
//       cart: {
//         productId: item.productId._id,
//         quantity: item.quantity,
//       },
//       productDetails: item.productId,
//     }));

//     res.render("checkout", {
//       product: cartData,
//       user,
//       isCart: true,
//       userAddress: addressData,
//       grandTotal,
//       razorpayKey: process.env.RAZORPAY_KEY_ID,
//       walletBalance: wallet
//         ? wallet.transactions.reduce(
//             (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
//             0
//           ).toFixed(2)
//         : "0.00",
//       errorMessage,
//       coupons: availableCoupons,
//     });
//   } catch (error) {
//     console.error("Error in getCheckoutPage:", error);
//     res.redirect("/pageNotFound");
//   }
// };

// const applyCoupon = async (req, res) => {
//   try {
//     const { couponCode, totalPrice } = req.body;
//     const userId = req.session.user;
//     console.log("applyCoupon - Request body:", req.body);

//     if (!couponCode || !totalPrice || !userId) {
//       console.log("applyCoupon - Missing fields:", { couponCode, totalPrice, userId });
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       console.log("applyCoupon - Invalid userId:", userId);
//       return res.status(400).json({ error: "Invalid user ID" });
//     }

//     const sanitizedCouponCode = couponCode.trim().toUpperCase();
//     console.log("applyCoupon - Sanitized couponCode:", sanitizedCouponCode);

//     const coupon = await Coupon.findOne({ 
//       couponName: { $regex: `^${sanitizedCouponCode}$`, $options: 'i' }
//     });
//     const allCoupons = await Coupon.find().sort({ createdAt: -1 });
//     console.log("applyCoupon - All coupons in DB:", JSON.stringify(allCoupons, null, 2));

//     console.log("applyCoupon - Coupon query result:", JSON.stringify(coupon, null, 2));
//     if (!coupon) {
//       return res.status(400).json({ error: "Coupon does not exist" });
//     }

//     if (!coupon.isActive) {
//       console.log("applyCoupon - Coupon inactive:", coupon.couponName);
//       return res.status(400).json({ error: "Coupon is inactive" });
//     }

//     if (coupon.status === "Expired" || new Date() > coupon.endDate) {
//       console.log("applyCoupon - Coupon expired:", coupon.couponName, "End date:", coupon.endDate);
//       return res.status(400).json({ error: "Coupon has expired" });
//     }

//     if (coupon.status !== "Active" || new Date() < coupon.startDate) {
//       console.log("applyCoupon - Coupon not yet valid:", coupon.couponName, "Start date:", coupon.startDate);
//       return res.status(400).json({ error: "Coupon is not valid yet" });
//     }

//     if (parseFloat(totalPrice) < coupon.minimumPrice) {
//       console.log("applyCoupon - Total price too low:", totalPrice, "Minimum:", coupon.minimumPrice);
//       return res.status(400).json({
//         error: `Minimum order amount is ₹${coupon.minimumPrice}`,
//       });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       console.log("applyCoupon - User not found:", userId);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const normalizedCouponApplied = user.couponApplied.map(code => code.toUpperCase());
//     if (normalizedCouponApplied.includes(sanitizedCouponCode)) {
//       console.log("applyCoupon - Coupon already used by user:", sanitizedCouponCode);
//       return res.status(400).json({ error: "Coupon already used" });
//     }

//     await User.updateOne(
//       { _id: userId },
//       { $push: { couponApplied: sanitizedCouponCode } }
//     );

//     console.log("applyCoupon - Coupon applied successfully:", coupon.couponName);
//     res.json({
//       success: true,
//       discount: coupon.offerPrice,
//       couponName: coupon.couponName,
//     });
//   } catch (error) {
//     console.error("Error in applyCoupon:", error);
//     res.status(500).json({ error: "Failed to apply coupon", details: error.message });
//   }
// };

// const orderPlaced = async (req, res) => {
//   try {
//     const { totalPrice, addressId, paymentMethod, couponApplied, discount } = req.body;
//     const userId = req.session.user;
//     console.log("orderPlaced - Request body:", { totalPrice, addressId, paymentMethod, couponApplied, discount, userId });

//     if (!userId || !addressId || !totalPrice || !paymentMethod) {
//       console.log("orderPlaced - Missing required fields");
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const [user, cart, addressDoc, wallet] = await Promise.all([
//       User.findById(userId),
//       Cart.findOne({ userId }).populate("items.productId"),
//       Address.findOne({ userId, "address._id": addressId }),
//       Wallet.findOne({ userId }),
//     ]);

//     if (!user) {
//       console.log("orderPlaced - User not found:", userId);
//       return res.status(404).json({ error: "User not found" });
//     }

//     if (!cart || !cart.items.length) {
//       console.log("orderPlaced - Cart empty for user:", userId);
//       return res.status(400).json({ error: "Cart is empty" });
//     }

//     if (!addressDoc) {
//       console.log("orderPlaced - Address not found for user:", userId);
//       return res.status(404).json({ error: "Address not found" });
//     }

//     const address = addressDoc.address.find(
//       (addr) => addr._id.toString() === addressId
//     );
//     if (!address) {
//       console.log("orderPlaced - Specific address not found:", addressId);
//       return res.status(404).json({ error: "Address ID not found" });
//     }

//     for (const item of cart.items) {
//       const product = await Product.findById(item.productId._id);
//       if (!product || product.quantity < item.quantity) {
//         console.log("orderPlaced - Insufficient stock for product:", item.productId._id);
//         return res.status(400).json({ error: `Insufficient stock for product ${item.productId.productName}` });
//       }
//     }

//     const orderedItems = cart.items.map((item) => ({
//       product: item.productId._id,
//       quantity: Number(item.quantity),
//       price: item.productId.salePrice,
//       productStatus: "confirmed",
//     }));

//     const finalAmount = parseFloat(totalPrice);
//     const totalDiscount = couponApplied && discount > 0 ? parseFloat(discount) : 0;

//     console.log("orderPlaced - Calculated:", { totalPrice: finalAmount, discount: totalDiscount, finalAmount });

//     const newOrderId = await generateOrderId();

//     const newOrder = new Order({
//       orderId: newOrderId,
//       orderedItems,
//       totalPrice: finalAmount,
//       discount: totalDiscount,
//       finalAmount,
//       address,
//       payment: paymentMethod === "cod" ? "cod" : paymentMethod === "wallet" ? "wallet" : "online",
//       userId,
//       status: paymentMethod === "cod" || paymentMethod === "wallet" ? "confirmed" : "pending",
//       createdOn: Date.now(),
//       couponApplied: couponApplied ? [couponApplied] : [],
//     });

//     const savedOrder = await newOrder.save();
//     console.log("orderPlaced - Order saved:", { orderId: savedOrder.orderId, mongoId: savedOrder._id, totalPrice: savedOrder.totalPrice, discount: savedOrder.discount, finalAmount: savedOrder.finalAmount });

//     if (paymentMethod === "wallet") {
//       const walletBalance = wallet ? wallet.transactions.reduce(
//         (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
//         0
//       ) : 0;
//       console.log("orderPlaced - Wallet balance:", walletBalance);
//       if (walletBalance < finalAmount) {
//         console.log("orderPlaced - Insufficient wallet balance");
//         await Order.deleteOne({ _id: savedOrder._id });
//         return res.status(400).json({ error: "Insufficient wallet balance" });
//       }

//       const transaction = {
//         transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//         amount: finalAmount,
//         type: "debit",
//         description: "order_payment",
//         orderId: savedOrder._id,
//         balanceAfter: walletBalance - finalAmount,
//         status: "completed",
//         transactionDate: Date.now(),
//       };

//       if (!wallet) {
//         const newWallet = new Wallet({
//           userId,
//           transactions: [transaction],
//         });
//         await newWallet.save();
//         console.log("orderPlaced - New wallet created for user:", userId, "Wallet ID:", newWallet._id);
//       } else {
//         wallet.transactions.push(transaction);
//         await wallet.save();
//       }

//       user.wallet = (user.wallet || 0) - finalAmount;
//       await user.save();
//     }

//     if (paymentMethod === "cod" || paymentMethod === "wallet") {
//       await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

//       for (const item of orderedItems) {
//         const product = await Product.findById(item.product);
//         if (product) {
//           const currentQuantity = parseInt(product.quantity, 10);
//           if (currentQuantity < item.quantity) {
//             console.log("orderPlaced - Insufficient stock for product:", item.product);
//             await Order.deleteOne({ _id: savedOrder._id });
//             return res.status(400).json({ error: `Insufficient stock for product ${item.product}` });
//           }
//           const newQuantity = currentQuantity - item.quantity;
//           product.quantity = newQuantity.toString();
//           await product.save();
//           console.log("orderPlaced - Stock updated for product:", item.product, "New quantity:", product.quantity);
//         }
//       }

//       return res.json({
//         payment: true,
//         method: paymentMethod,
//         order: savedOrder,
//         orderId: savedOrder.orderId,
//       });
//     } else if (paymentMethod === "razorpay") {
//       try {
//         const razorpayOrder = await razorpayInstance.orders.create({
//           amount: Math.round(finalAmount * 100),
//           currency: "INR",
//           receipt: savedOrder._id.toString(),
//         });
//         console.log("orderPlaced - Razorpay order created:", razorpayOrder);

//         return res.json({
//           payment: true,
//           method: "razorpay",
//           order: savedOrder,
//           orderId: savedOrder.orderId,
//           razorpayOrderId: razorpayOrder.id,
//           amount: razorpayOrder.amount,
//           key: process.env.RAZORPAY_KEY_ID,
//         });
//       } catch (razorpayError) {
//         console.error("orderPlaced - Razorpay Error:", razorpayError);
//         await Order.findByIdAndUpdate(savedOrder._id, { payment: "failed" });
//         return res.redirect(`/paymentFailed?orderId=${savedOrder.orderId}`);
//       }
//     } else {
//       console.log("orderPlaced - Invalid payment method:", paymentMethod);
//       return res.status(400).json({ error: "Invalid payment method" });
//     }
//   } catch (error) {
//     console.error("Error in orderPlaced:", error);
//     res.status(500).json({ error: "Server error", details: error.message });
//   }
// };

// const verifyPayment = async (req, res) => {
//   try {
//     const {
//       orderId,
//       razorpay_payment_id,
//       razorpay_order_id,
//       razorpay_signature,
//     } = req.body;
//     const userId = req.session.user;
//     console.log("verifyPayment - Request body:", { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature, userId });

//     if (
//       !orderId ||
//       !razorpay_payment_id ||
//       !razorpay_order_id ||
//       !razorpay_signature
//     ) {
//       console.log("verifyPayment - Missing payment verification fields");
//       return res.status(400).json({ error: "Missing payment verification fields" });
//     }

//     const generatedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(razorpay_order_id + "|" + razorpay_payment_id)
//       .digest("hex");
//     console.log("verifyPayment - Generated signature:", generatedSignature);
//     console.log("verifyPayment - Received signature:", razorpay_signature);

//     const order = await Order.findOne({ orderId });
//     if (!order) {
//       console.log("verifyPayment - Order not found for orderId:", orderId);
//       return res.status(404).json({ error: "Order not found" });
//     }
//     console.log("verifyPayment - Order found:", order.orderId);

//     if (generatedSignature !== razorpay_signature) {
//       console.log("verifyPayment - Signature verification failed");
//       await Order.findOneAndUpdate({ orderId }, { payment: "failed" });
//       return res.redirect(`/paymentFailed?orderId=${orderId}`);
//     }

//     order.status = "confirmed";
//     order.payment = "online";
//     await order.save();
//     console.log("verifyPayment - Order status updated to confirmed");

//     await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
//     console.log("verifyPayment - Cart cleared for user:", userId);

//     for (const item of order.orderedItems) {
//       const product = await Product.findById(item.product);
//       if (product) {
//         const currentQuantity = parseInt(product.quantity, 10);
//         const newQuantity = currentQuantity - item.quantity;
//         product.quantity = newQuantity.toString();
//         await product.save();
//         console.log("verifyPayment - Stock updated for product:", item.product, "New quantity:", product.quantity);
//       }
//     }

//     res.json({
//       success: true,
//       orderId: order.orderId,
//       message: "Payment verified successfully",
//     });
//   } catch (error) {
//     console.error("Error in verifyPayment:", error);
//     const order = await Order.findOne({ orderId: req.body.orderId });
//     if (order) {
//       await Order.findOneAndUpdate({ orderId: req.body.orderId }, { payment: "failed" });
//     }
//     res.redirect(`/paymentFailed?orderId=${req.body.orderId}`);
//   }
// };

// const paymentFailed = async (req, res) => {
//   try {
//     const orderId = req.query.orderId;
//     const userId = req.session.user;
//     if (!userId) {
//       console.error('paymentFailed: No user ID in session');
//       return res.redirect('/login');
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       console.error('paymentFailed: User not found for ID:', userId);
//       return res.redirect('/login');
//     }

//     const order = await Order.findOne({ orderId });
//     if (!order) {
//       console.error('paymentFailed: Order not found for orderId:', orderId);
//       return res.render('paymentFailed', {
//         errorMessage: 'Order not found',
//         orderId,
//         user,
//         userAddress: null
//       });
//     }

//     await Order.findOneAndUpdate({ orderId }, { payment: "failed", status: "pending" });

//     const userAddress = await Address.findOne({ userId });

//     console.log('paymentFailed: Rendering template with data:', {
//       orderId,
//       user: { name: user.name, email: user.email },
//       userAddress: userAddress ? userAddress.address : null,
//       errorMessage: 'Payment failed or was cancelled. Please try again.'
//     });

//     res.render('paymentFailed', {
//       errorMessage: 'Payment failed or was cancelled. Please try again.',
//       orderId,
//       user,
//       userAddress
//     });
//   } catch (error) {
//     console.error('paymentFailed: Error:', error);
//     res.render('paymentFailed', {
//       errorMessage: 'An error occurred while loading the payment failed page.',
//       orderId: req.query.orderId || null,
//       user: null,
//       userAddress: null
//     });
//   }
// };

// const retryPayment = async (req, res) => {
//   try {
//     const { orderId } = req.query;
//     const userId = req.session.user;
//     console.log("retryPayment - Request:", { orderId, userId });

//     if (!orderId || !userId) {
//       console.log("retryPayment - Missing orderId or userId");
//       return res.status(400).json({ error: "Missing orderId or userId" });
//     }

//     const order = await Order.findOne({ orderId });
//     if (!order) {
//       console.log("retryPayment - Order not found for orderId:", orderId);
//       return res.status(404).json({ error: "Order not found" });
//     }

//     if (order.status !== "pending") {
//       console.log("retryPayment - Order is not in pending state:", order.status);
//       return res.status(400).json({ error: "Order is not eligible for retry" });
//     }

//     const razorpayOrder = await razorpayInstance.orders.create({
//       amount: Math.round(order.finalAmount * 100),
//       currency: "INR",
//       receipt: order._id.toString(),
//     });
//     console.log("retryPayment - Razorpay order created:", razorpayOrder);

//     res.json({
//       payment: true,
//       method: "razorpay",
//       order,
//       orderId: order.orderId,
//       razorpayOrderId: razorpayOrder.id,
//       amount: razorpayOrder.amount,
//       key: process.env.RAZORPAY_KEY_ID,
//     });
//   } catch (error) {
//     console.error("retryPayment - Error:", error);
//     await Order.findOneAndUpdate({ orderId }, { payment: "failed" });
//     res.redirect(`/paymentFailed?orderId=${orderId}`);
//   }
// };

// const deleteProduct = async (req, res) => {
//   try {
//     const { id } = req.query;
//     const userId = req.session.user;

//     if (!mongoose.Types.ObjectId.isValid(id) || !userId) {
//       return res.status(400).json({ error: "Invalid parameters" });
//     }

//     await Cart.findOneAndUpdate(
//       { userId },
//       { $pull: { items: { productId: id } } }
//     );

//     res.redirect("/checkout");
//   } catch (error) {
//     console.error("Error in deleteProduct:", error);
//     res.redirect("/pageNotFound");
//   }
// };

// const getOrderDetailsPage = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const orderId = req.query.id;

//     const findOrder = await Order.findOne({ orderId }).populate("orderedItems.product");
//     if (!findOrder) {
//       console.log("getOrderDetailsPage - Order not found for orderId:", orderId);
//       return res.redirect("/pageNotFound");
//     }

//     const findUser = await User.findOne({ _id: userId });
//     if (!findUser) {
//       return res.redirect("/pageNotFound");
//     }

//     let totalGrant = 0;
//     findOrder.orderedItems.forEach((val) => {
//       totalGrant += val.price * val.quantity;
//     });

//     const totalPrice = findOrder.totalPrice;
//     const finalAmount = findOrder.finalAmount;

//     res.render("orderDetails", {
//       orders: findOrder,
//       user: findUser,
//       totalGrant: totalGrant,
//       totalPrice: totalPrice,
//       finalAmount: finalAmount,
//     });
//   } catch (error) {
//     console.error("Error in getOrderDetailsPage:", error);
//     res.redirect("/pageNotFound");
//   }
// };

// const cancelOrder = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const { orderId } = req.body;
//     console.log("Cancel Order Request:", { orderId });

//     const findOrder = await Order.findOne({ _id: orderId });
//     if (!findOrder) {
//       console.log("Order not found for ID:", orderId);
//       return res.status(404).json({ message: "Order not found" });
//     }
//     console.log("Order found:", findOrder);

//     if (findOrder.status === "cancelled") {
//       console.log("Order already cancelled:", orderId);
//       return res.status(400).json({ message: "Order is already cancelled" });
//     }

//     await Order.updateOne({ _id: orderId }, { status: "cancelled" });
//     console.log("Order status updated to 'cancelled'");

//     for (const item of findOrder.orderedItems) {
//       const product = await Product.findById(item.product);
//       if (product) {
//         product.quantity = parseInt(product.quantity) + item.quantity;
//         await product.save();
//         console.log("Stock restored for product:", item.product);
//       }
//     }

//     if (findOrder.payment === "online" || findOrder.payment === "wallet") {
//       const user = await User.findById(userId);
//       if (!user) {
//         console.log("User not found for ID:", userId);
//         return res.status(404).json({ message: "User not found" });
//       }
//       console.log("User found:", user._id, "Current wallet balance:", user.wallet);

//       const refundAmount = findOrder.finalAmount;
//       user.wallet = (user.wallet || 0) + refundAmount;
//       const userSaveResult = await user.save();
//       console.log(
//         "User wallet updated. New balance:",
//         user.wallet,
//         "Save result:",
//         userSaveResult
//       );

//       let userWallet = await Wallet.findOne({ userId });
//       if (!userWallet) {
//         console.log("No wallet found for user. Creating new wallet.");
//         userWallet = new Wallet({ userId, transactions: [] });
//       }

//       const transaction = {
//         transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//         amount: refundAmount,
//         type: "credit",
//         description: "refund",
//         orderId: orderId,
//         balanceAfter: user.wallet,
//         status: "completed",
//         transactionDate: Date.now(),
//       };
//       userWallet.transactions.push(transaction);
//       userWallet.updatedAt = Date.now();
//       const walletSaveResult = await userWallet.save();
//       console.log(
//         "Wallet transaction added:",
//         transaction,
//         "Save result:",
//         walletSaveResult
//       );
//     }

//     res.status(200).json({ message: "Order cancelled successfully" });
//   } catch (error) {
//     console.error("Error in cancelOrder:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// const cancelSingleProduct = async (req, res) => {
//   const { orderId, singleProductId } = req.body;
//   console.log("cancelSingleProduct - Request:", { orderId, singleProductId });

//   if (
//     !mongoose.Types.ObjectId.isValid(orderId) ||
//     !mongoose.Types.ObjectId.isValid(singleProductId)
//   ) {
//     console.log("Invalid ID format:", { orderId, singleProductId });
//     return res.status(400).json({ message: "Invalid ID format" });
//   }

//   try {
//     const order = await Order.findOne({ _id: orderId });
//     if (!order) {
//       console.log("Order not found for ID:", orderId);
//       return res.status(404).json({ message: "Order not found" });
//     }
//     console.log("Order details:", { orderId: order._id, payment: order.payment });

//     const oid = new mongoose.Types.ObjectId(singleProductId);
//     const productIndex = order.orderedItems.findIndex(
//       (item) => item.product.toString() === singleProductId
//     );
//     if (productIndex === -1) {
//       console.log("Product not found in order:", singleProductId);
//       return res.status(404).json({ message: "Product not found in order" });
//     }
//     console.log("Order details before processing:", order);
//     const orderedItem = order.orderedItems[productIndex];
//     console.log("Ordered item details:", orderedItem);

//     const totalOrderAmount = order.totalPrice + order.discount;
//     console.log("Total order amount (including discount):", totalOrderAmount);

//     const productPrice = orderedItem.price;
//     console.log("Product price:", productPrice);

//     const discountPercentage = (productPrice / totalOrderAmount) * 100;
//     console.log("Discount percentage for the product:", discountPercentage);

//     const discountAmountForSingleProduct = (discountPercentage / 100) * order.discount;
//     console.log("Discount amount for the single product:", discountAmountForSingleProduct);

//     const refundAmount = orderedItem.price * orderedItem.quantity - discountAmountForSingleProduct;
//     console.log("Refund amount calculated:", { refundAmount });

//     const filter = { _id: orderId };
//     const update = {
//       $set: {
//         "orderedItems.$[elem].productStatus": "cancelled",
//       },
//     };
//     const options = { arrayFilters: [{ "elem.product": oid }] };
//     const orderUpdateResult = await Order.updateOne(filter, update, options);
//     console.log("Order update result:", orderUpdateResult);

//     if (orderUpdateResult.modifiedCount === 0) {
//       console.log("Order update failed - no changes made");
//       return res.status(500).json({ message: "Failed to update order status" });
//     }
//     console.log("Product status updated to 'cancelled'");

//     const product = await Product.findById(singleProductId);
//     if (product) {
//       product.quantity = parseInt(product.quantity) + orderedItem.quantity;
//       await product.save();
//       console.log(
//         "Stock restored for product:",
//         singleProductId,
//         "New quantity:",
//         product.quantity
//       );
//     } else {
//       console.log("Product not found for stock update:", singleProductId);
//     }

//     if (order.payment === "online" || order.payment === "wallet") {
//       const user = await User.findById(order.userId);
//       if (!user) {
//         console.log("User not found for ID:", order.userId);
//         return res.status(404).json({ message: "User not found" });
//       }
//       console.log("User found:", { id: user._id, currentWallet: user.wallet });

//       const oldWalletBalance = user.wallet || 0;
//       user.wallet = oldWalletBalance + refundAmount;
//       const userSaveResult = await user.save();
//       console.log("User wallet updated:", {
//         oldBalance: oldWalletBalance,
//         refundAmount,
//         newBalance: user.wallet,
//       });

//       if (userSaveResult.wallet !== user.wallet) {
//         console.log("User wallet save failed - balance mismatch");
//         return res.status(500).json({ message: "Failed to update user wallet" });
//       }

//       let userWallet = await Wallet.findOne({ userId: order.userId });
//       if (!userWallet) {
//         console.log("No wallet found for user. Creating new wallet.");
//         userWallet = new Wallet({ userId: order.userId, transactions: [] });
//       }

//       const transaction = {
//         transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//         amount: refundAmount,
//         type: "credit",
//         description: "refund",
//         orderId: orderId,
//         balanceAfter: user.wallet,
//         status: "completed",
//         transactionDate: Date.now(),
//       };
//       userWallet.transactions.push(transaction);
//       userWallet.updatedAt = Date.now();
//       await userWallet.save();
//       console.log("Wallet transaction added:", transaction);
//     }

//     const updatedOrder = await Order.findOne({ _id: orderId });
//     const allCancelled = updatedOrder.orderedItems.every(
//       (item) => item.productStatus === "cancelled"
//     );
//     if (allCancelled) {
//       await Order.updateOne({ _id: orderId }, { status: "cancelled" });
//       console.log("All items cancelled, order status updated to 'cancelled'");
//       return res.status(200).json({
//         message: "All products cancelled, order status updated to cancelled",
//       });
//     }

//     res.status(200).json({ message: "Product status updated successfully" });
//   } catch (error) {
//     console.error("Error in cancelSingleProduct:", error.stack);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// const returnSingleProduct = async (req, res) => {
//   const { orderId, singleProductId } = req.body;
//   const oid = new mongoose.Types.ObjectId(singleProductId);

//   if (
//     !mongoose.Types.ObjectId.isValid(orderId) ||
//     !mongoose.Types.ObjectId.isValid(singleProductId)
//   ) {
//     return res.status(400).json({ message: "Invalid ID format" });
//   }

//   try {
//     const order = await Order.findOne({ _id: orderId });
//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }
//     if (order.status !== "shipped" && order.status !== "delivered") {
//       return res.status(400).json({
//         message: "Order must be shipped or delivered to request a return",
//       });
//     }

//     const productIndex = order.orderedItems.findIndex(
//       (item) => item.product.toString() === singleProductId
//     );
//     if (productIndex === -1) {
//       return res.status(404).json({ message: "Product not found in order" });
//     }

//     if (
//       order.orderedItems[productIndex].productStatus === "returned" ||
//       order.orderedItems[productIndex].productStatus === "return-requested"
//     ) {
//       return res.status(400).json({
//         message: "Product is already returned or a return is requested",
//       });
//     }

//     const filter = { _id: orderId };
//     const update = {
//       $set: { "orderedItems.$[elem].productStatus": "return-requested" },
//     };
//     const options = { arrayFilters: [{ "elem.product": oid }] };
//     await Order.updateOne(filter, update, options);

//     res.status(200).json({
//       message: "Return request submitted to admin for approval",
//     });
//   } catch (error) {
//     console.error("Error in returnSingleProduct:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const returnorder = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const { orderId } = req.body;
//     const findOrder = await Order.findOne({ _id: orderId });

//     if (!findOrder) {
//       return res.status(404).json({ message: "Order not found" });
//     }
//     if (
//       findOrder.status === "returned" ||
//       findOrder.status === "return-requested"
//     ) {
//       return res.status(400).json({
//         message: "Order is already returned or a return is requested",
//       });
//     }
//     if (findOrder.status !== "shipped" && findOrder.status !== "delivered") {
//       return res.status(400).json({
//         message: "Order must be shipped or delivered to request a return",
//       });
//     }

//     await Order.updateOne({ _id: orderId }, { status: "return-requested" });
//     res.status(200).json({
//       message: "Return request submitted to admin for approval",
//     });
//   } catch (error) {
//     console.error("Error in returnorder:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const changeSingleProductStatus = async (req, res) => {
//   const { orderId, singleProductId, status } = req.body;
//   const oid = new mongoose.Types.ObjectId(singleProductId);

//   if (
//     !mongoose.Types.ObjectId.isValid(orderId) ||
//     !mongoose.Types.ObjectId.isValid(singleProductId)
//   ) {
//     return res.status(400).json({ message: "Invalid ID format" });
//   }

//   try {
//     const order = await Order.findOne({ _id: orderId });
//     const productIndex = order.orderedItems.findIndex(
//       (item) => item.product.toString() === singleProductId
//     );
//     const orderedItemPrice = order.orderedItems[productIndex].price;
//     const newPrice = order.totalPrice - orderedItemPrice;
//     const newFinalAmount = order.finalAmount - orderedItemPrice;

//     const filter = { _id: orderId };
//     const update = {
//       $set: {
//         "orderedItems.$[elem].productStatus": status,
//         totalPrice: newPrice,
//         finalAmount: newFinalAmount,
//       },
//     };
//     const options = {
//       arrayFilters: [{ "elem.product": oid }],
//     };
//     const result = await Order.updateOne(filter, update, options);
//     res.status(200).json({
//       message: "Product status updated successfully",
//       result,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// const downloadInvoice = async (req, res) => {
//   try {
//     const orderId = req.params.orderId;
//     const order = await Order.findById(orderId).populate("orderedItems.product");

//     if (!order) {
//       return res.status(404).send("Order not found");
//     }

//     const data = {
//       documentTitle: "INVOICE",
//       currency: "INR",
//       taxNotation: "gst",
//       marginTop: 25,
//       marginRight: 25,
//       marginLeft: 25,
//       marginBottom: 25,
//       sender: {
//         company: "Male Fashion",
//         address: "Thrikkakkara",
//         zip: "682021",
//         city: "Kochi",
//         country: "India",
//       },
//       client: {
//         company: order.address.name,
//         address: `${order.address.landMark}, ${order.address.city}`,
//         zip: order.address.pincode,
//         city: order.address.state,
//         country: "India",
//       },
//       information: {
//         number: order.orderId || order._id.toString(),
//         date: moment(order.createdOn).format("YYYY-MM-DD HH:mm:ss"),
//       },
//       products: order.orderedItems.map((item) => ({
//         quantity: item.quantity,
//         description: item.product.productName || "Product",
//         tax: 0,
//         price: item.price,
//       })),
//       bottomNotice:
//         `Total: ₹${order.totalPrice.toFixed(2)}\n` +
//         (order.couponApplied.length > 0
//           ? `Coupon Discount: -₹${order.discount.toFixed(2)}\n`
//           : "") +
//         `Final Amount: ₹${order.finalAmount.toFixed(2)}`,
//     };

//     const result = await easyinvoice.createInvoice(data);
//     const invoicePath = path.join(
//       __dirname,
//       "../../public/invoice/",
//       `invoice_${orderId}.pdf`
//     );
//     fs.writeFileSync(invoicePath, result.pdf, "base64");
//     res.download(invoicePath, `invoice_${orderId}.pdf`, (err) => {
//       if (err) {
//         console.error("Error downloading the file", err);
//       }
//       fs.unlinkSync(invoicePath);
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("An error occurred while generating the invoice");
//   }
// };

// const clearCart = async (req, res) => {
//   try {
//     const { userId } = req.body;
//     console.log("clearCart - Clearing cart for user:", userId);

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       console.log("clearCart - Missing or invalid userId:", userId);
//       return res.status(400).json({ error: "Missing or invalid userId" });
//     }

//     const result = await Cart.findOneAndUpdate(
//       { userId },
//       { $set: { items: [] } },
//       { new: true }
//     );

//     if (!result) {
//       console.log("clearCart - Cart not found for user:", userId);
//       return res.status(404).json({ error: "Cart not found" });
//     }

//     console.log("clearCart - Cart cleared successfully for user:", userId);
//     res.json({ success: true, message: "Cart cleared successfully" });
//   } catch (error) {
//     console.error("clearCart - Error:", error);
//     res.status(500).json({ error: "Server error", details: error.message });
//   }
// };

// const changeOrderStatus = async (req, res) => {
//   const { orderId, status } = req.body;
//   console.log("changeOrderStatus - Request:", { orderId, status });

//   if (!orderId || !status) {
//     console.log("changeOrderStatus - Missing orderId or status:", { orderId, status });
//     return res.status(400).json({ message: "Missing orderId or status" });
//   }

//   try {
//     const order = await Order.findOne({ orderId });
//     if (!order) {
//       console.log("changeOrderStatus - Order not found for orderId:", orderId);
//       return res.status(404).json({ message: "Order not found" });
//     }

//     order.status = status;
//     if (status === "failed") {
//       order.payment = "failed";
//     }
//     await order.save();
//     console.log("changeOrderStatus - Order status updated to:", order.status, "Order ID:", orderId);

//     res.status(200).json({ message: "Order status updated successfully" });
//   } catch (error) {
//     console.error("changeOrderStatus - Error:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// module.exports = {
//   getCheckoutPage,
//   deleteProduct,
//   orderPlaced,
//   getOrderDetailsPage,
//   cancelOrder,
//   changeSingleProductStatus,
//   returnorder,
//   downloadInvoice,
//   returnSingleProduct,
//   cancelSingleProduct,
//   verifyPayment,
//   applyCoupon,
//   clearCart,
//   changeOrderStatus,
//   paymentFailed,
//   retryPayment,
// };

const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/coupenSchema");
const mongoose = require("mongoose");
const easyinvoice = require("easyinvoice");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const razorpayInstance = require("../../config/razorpay");
const crypto = require("crypto");
const Wallet = require("../../models/walletSchema");

// Function to generate 4-character unique orderId
const generateOrderId = async () => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let orderId;
  let isUnique = false;
  const length = 4;

  while (!isUnique) {
    orderId = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      orderId += characters[bytes[i] % characters.length];
    }
    const existingOrder = await Order.findOne({ orderId });
    if (!existingOrder) isUnique = true;
  }

  return orderId;
};

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user || req.query.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.log("getCheckoutPage - Invalid userId:", userId);
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const serverDate = new Date();
    console.log("getCheckoutPage - Server date:", serverDate.toISOString(), "Timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);

    const [user, cart, addressData, wallet, coupons] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId }).populate({
        path: "items.productId",
        populate: { path: "category", model: "Category" },
      }),
      Address.findOne({ userId }),
      Wallet.findOne({ userId }),
      Coupon.find({
        isActive: true,
        status: { $regex: "^Active$", $options: "i" },
        startDate: { $lte: serverDate },
        endDate: { $gte: serverDate },
      }),
    ]);

    if (!user) {
      console.log("getCheckoutPage - User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    if (!cart || !cart.items || cart.items.length === 0) {
      console.log("getCheckoutPage - Cart empty for user:", userId);
      return res.redirect("/shop");
    }

    console.log("getCheckoutPage - Raw coupons from DB:", JSON.stringify(coupons, null, 2));

    const grandTotal = cart.items.reduce((total, item) => {
      const salePrice = Number(item.productId.salePrice) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + quantity * salePrice;
    }, 0);
    console.log("getCheckoutPage - Calculated grandTotal:", grandTotal);

    const normalizedCouponApplied = user.couponApplied.map(code => code.toUpperCase());
    console.log("getCheckoutPage - Normalized user.couponApplied:", normalizedCouponApplied);

    const availableCoupons = coupons.filter(
      coupon => {
        const isValid = coupon.minimumPrice <= grandTotal &&
                        !normalizedCouponApplied.includes(coupon.couponName.toUpperCase());
        console.log("getCheckoutPage - Coupon filter:", {
          couponName: coupon.couponName,
          minimumPrice: coupon.minimumPrice,
          grandTotal,
          userApplied: normalizedCouponApplied,
          isValid
        });
        return isValid;
      }
    );
    console.log("getCheckoutPage - Available coupons after filtering:", JSON.stringify(availableCoupons, null, 2));

    let errorMessage = null;

    // const blockedProducts = cart.items.filter(item => item.productId.isBlocked);
    // if (blockedProducts.length > 0) {
    //   const blockedProductNames = blockedProducts
    //     .map(item => item.productId.productName)
    //     .join(", ");
    //   errorMessage = `Cannot proceed to checkout. The following products are blocked: ${blockedProductNames}. Please remove them from your cart.`;
    // }

    // const unlistedCategoryProducts = cart.items.filter(
    //   item => item.productId.category && !item.productId.category.isListed
    // );
    // if (unlistedCategoryProducts.length > 0 && !errorMessage) {
    //   const unlistedProductNames = unlistedCategoryProducts
    //     .map(item => item.productId.productName)
    //     .join(", ");
    //   errorMessage = `Cannot proceed to checkout. The following products belong to unlisted categories: ${unlistedProductNames}. Please remove them from your cart.`;
    // }

    const cartData = cart.items.map((item) => ({
      cart: {
        productId: item.productId._id,
        quantity: item.quantity,
      },
      productDetails: item.productId,
    }));

    const csrfToken = req.csrfToken();
    console.log("getCheckoutPage - CSRF Token:", csrfToken);

    res.render("checkout", {
      csrfToken,
      product: cartData,
      user,
      isCart: true,
      userAddress: addressData,
      grandTotal,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      walletBalance: wallet
        ? wallet.transactions.reduce(
            (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
            0
          ).toFixed(2)
        : "0.00",
      errorMessage,
      coupons: availableCoupons,
    });
  } catch (error) {
    console.error("Error in getCheckoutPage:", error);
    res.redirect("/pageNotFound");
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, totalPrice } = req.body;
    const userId = req.session.user;
    console.log("applyCoupon - Request body:", req.body);

    if (!couponCode || !totalPrice || !userId) {
      console.log("applyCoupon - Missing fields:", { couponCode, totalPrice, userId });
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("applyCoupon - Invalid userId:", userId);
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const sanitizedCouponCode = couponCode.trim().toUpperCase();
    console.log("applyCoupon - Sanitized couponCode:", sanitizedCouponCode);

    const coupon = await Coupon.findOne({ 
      couponName: { $regex: `^${sanitizedCouponCode}$`, $options: 'i' }
    });
    const allCoupons = await Coupon.find().sort({ createdAt: -1 });
    console.log("applyCoupon - All coupons in DB:", JSON.stringify(allCoupons, null, 2));

    console.log("applyCoupon - Coupon query result:", JSON.stringify(coupon, null, 2));
    if (!coupon) {
      return res.status(400).json({ error: "Coupon does not exist" });
    }

    if (!coupon.isActive) {
      console.log("applyCoupon - Coupon inactive:", coupon.couponName);
      return res.status(400).json({ error: "Coupon is inactive" });
    }

    if (coupon.status === "Expired" || new Date() > coupon.endDate) {
      console.log("applyCoupon - Coupon expired:", coupon.couponName, "End date:", coupon.endDate);
      return res.status(400).json({ error: "Coupon has expired" });
    }

    if (coupon.status !== "Active" || new Date() < coupon.startDate) {
      console.log("applyCoupon - Coupon not yet valid:", coupon.couponName, "Start date:", coupon.startDate);
      return res.status(400).json({ error: "Coupon is not valid yet" });
    }

    if (parseFloat(totalPrice) < coupon.minimumPrice) {
      console.log("applyCoupon - Total price too low:", totalPrice, "Minimum:", coupon.minimumPrice);
      return res.status(400).json({
        error: `Minimum order amount is ₹${coupon.minimumPrice}`,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("applyCoupon - User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    const normalizedCouponApplied = user.couponApplied.map(code => code.toUpperCase());
    if (normalizedCouponApplied.includes(sanitizedCouponCode)) {
      console.log("applyCoupon - Coupon already used by user:", sanitizedCouponCode);
      return res.status(400).json({ error: "Coupon already used" });
    }

    await User.updateOne(
      { _id: userId },
      { $push: { couponApplied: sanitizedCouponCode } }
    );

    console.log("applyCoupon - Coupon applied successfully:", coupon.couponName);
    res.json({
      success: true,
      discount: coupon.offerPrice,
      couponName: coupon.couponName,
    });
  } catch (error) {
    console.error("Error in applyCoupon:", error);
    res.status(500).json({ error: "Failed to apply coupon", details: error.message });
  }
};

// const orderPlaced = async (req, res) => {
//   try {
//     const { totalPrice, addressId, paymentMethod, couponApplied, discount } = req.body;
//     const userId = req.session.user;
//     console.log("orderPlaced - Request body:", { totalPrice, addressId, paymentMethod, couponApplied, discount, userId });

//     if (!userId || !addressId || !totalPrice || !paymentMethod) {
//       console.log("orderPlaced - Missing required fields");
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const [user, cart, addressDoc, wallet] = await Promise.all([
//       User.findById(userId),
//       Cart.findOne({ userId }).populate("items.productId"),
//       Address.findOne({ userId, "address._id": addressId }),
//       Wallet.findOne({ userId }),
//     ]);

//     if (!user) {
//       console.log("orderPlaced - User not found:", userId);
//       return res.status(404).json({ error: "User not found" });
//     }

//     if (!cart || !cart.items.length) {
//       console.log("orderPlaced - Cart empty for user:", userId);
//       return res.status(400).json({ error: "Cart is empty" });
//     }

//     if (!addressDoc) {
//       console.log("orderPlaced - Address not found for user:", userId);
//       return res.status(404).json({ error: "Address not found" });
//     }

//     const address = addressDoc.address.find(
//       (addr) => addr._id.toString() === addressId
//     );
//     if (!address) {
//       console.log("orderPlaced - Specific address not found:", addressId);
//       return res.status(404).json({ error: "Address ID not found" });
//     }

//     for (const item of cart.items) {
//       const product = await Product.findById(item.productId._id);
//       if (!product || product.quantity < item.quantity) {
//         console.log("orderPlaced - Insufficient stock for product:", item.productId._id);
//         return res.status(400).json({ error: `Insufficient stock for product ${item.productId.productName}` });
//       }
//     }

//     const orderedItems = cart.items.map((item) => ({
//       product: item.productId._id,
//       quantity: Number(item.quantity),
//       price: item.productId.salePrice,
//       productStatus: "confirmed",
//     }));

//     const finalAmount = parseFloat(totalPrice);
//     const totalDiscount = couponApplied && discount > 0 ? parseFloat(discount) : 0;

//     console.log("orderPlaced - Calculated:", { totalPrice: finalAmount, discount: totalDiscount, finalAmount });

//     const newOrderId = await generateOrderId();

//     const newOrder = new Order({
//       orderId: newOrderId,
//       orderedItems,
//       totalPrice: finalAmount,
//       discount: totalDiscount,
//       finalAmount,
//       address,
//       payment: paymentMethod === "cod" ? "cod" : paymentMethod === "wallet" ? "wallet" : "online",
//       userId,
//       status: paymentMethod === "cod" || paymentMethod === "wallet" ? "confirmed" : "pending",
//       createdOn: Date.now(),
//       couponApplied: couponApplied ? [couponApplied] : [],
//     });

//     const savedOrder = await newOrder.save();
//     console.log("orderPlaced - Order saved:", { orderId: savedOrder.orderId, mongoId: savedOrder._id, totalPrice: savedOrder.totalPrice, discount: savedOrder.discount, finalAmount: savedOrder.finalAmount });

//     if (paymentMethod === "wallet") {
//       const walletBalance = wallet ? wallet.transactions.reduce(
//         (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
//         0
//       ) : 0;
//       console.log("orderPlaced - Wallet balance:", walletBalance);
//       if (walletBalance < finalAmount) {
//         console.log("orderPlaced - Insufficient wallet balance");
//         await Order.deleteOne({ _id: savedOrder._id });
//         return res.status(400).json({ error: "Insufficient wallet balance" });
//       }

//       const transaction = {
//         transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//         amount: finalAmount,
//         type: "debit",
//         description: "order_payment",
//         orderId: savedOrder._id,
//         balanceAfter: walletBalance - finalAmount,
//         status: "completed",
//         transactionDate: Date.now(),
//       };

//       if (!wallet) {
//         const newWallet = new Wallet({
//           userId,
//           transactions: [transaction],
//         });
//         await newWallet.save();
//         console.log("orderPlaced - New wallet created for user:", userId, "Wallet ID:", newWallet._id);
//       } else {
//         wallet.transactions.push(transaction);
//         await wallet.save();
//       }

//       user.wallet = (user.wallet || 0) - finalAmount;
//       await user.save();
//     }

//     if (paymentMethod === "cod" || paymentMethod === "wallet") {
//       await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

//       for (const item of orderedItems) {
//         const product = await Product.findById(item.product);
//         if (product) {
//           const currentQuantity = parseInt(product.quantity, 10);
//           if (currentQuantity < item.quantity) {
//             console.log("orderPlaced - Insufficient stock for product:", item.product);
//             await Order.deleteOne({ _id: savedOrder._id });
//             return res.status(400).json({ error: `Insufficient stock for product ${item.product}` });
//           }
//           const newQuantity = currentQuantity - item.quantity;
//           product.quantity = newQuantity.toString();
//           await product.save();
//           console.log("orderPlaced - Stock updated for product:", item.product, "New quantity:", product.quantity);
//         }
//       }

//       return res.json({
//         payment: true,
//         method: paymentMethod,
//         order: savedOrder,
//         orderId: savedOrder.orderId,
//       });
//     } else if (paymentMethod === "razorpay") {
//       try {
//         const razorpayOrder = await razorpayInstance.orders.create({
//           amount: Math.round(finalAmount * 100),
//           currency: "INR",
//           receipt: savedOrder._id.toString(),
//         });
//         console.log("orderPlaced - Razorpay order created:", razorpayOrder);

//         return res.json({
//           payment: true,
//           method: "razorpay",
//           order: savedOrder,
//           orderId: savedOrder.orderId,
//           razorpayOrderId: razorpayOrder.id,
//           amount: razorpayOrder.amount,
//           key: process.env.RAZORPAY_KEY_ID,
//         });
//       } catch (razorpayError) {
//         console.error("orderPlaced - Razorpay Error:", razorpayError);
//         await Order.findByIdAndUpdate(savedOrder._id, { payment: "failed" });
//         return res.redirect(`/paymentFailed?orderId=${savedOrder.orderId}`);
//       }
//     } else {
//       console.log("orderPlaced - Invalid payment method:", paymentMethod);
//       return res.status(400).json({ error: "Invalid payment method" });
//     }
//   } catch (error) {
//     console.error("Error in orderPlaced:", error);
//     res.status(500).json({ error: "Server error", details: error.message });
//   }
// };
const orderPlaced = async (req, res) => {
  try {
    const { totalPrice, addressId, paymentMethod, couponApplied, discount } = req.body;
    const userId = req.session.user;
    console.log("orderPlaced - Request body:", { totalPrice, addressId, paymentMethod, couponApplied, discount, userId });

    if (!userId || !addressId || !totalPrice || !paymentMethod) {
      console.log("orderPlaced - Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [user, cart, addressDoc, wallet] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId }).populate("items.productId"),
      Address.findOne({ userId, "address._id": addressId }),
      Wallet.findOne({ userId }),
    ]);

    if (!user) {
      console.log("orderPlaced - User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    if (!cart || !cart.items.length) {
      console.log("orderPlaced - Cart empty for user:", userId);
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (!addressDoc) {
      console.log("orderPlaced - Address not found for user:", userId);
      return res.status(404).json({ error: "Address not found" });
    }

    const address = addressDoc.address.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!address) {
      console.log("orderPlaced - Specific address not found:", addressId);
      return res.status(404).json({ error: "Address ID not found" });
    }

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.quantity < item.quantity) {
        console.log("orderPlaced - Insufficient stock for product:", item.productId._id);
        return res.status(400).json({ error: `Insufficient stock for product ${item.productId.productName}` });
      }
    }
    
    // const unlistedCategoryProducts = cart.items.filter(
    //   item => item.productId.category && !item.productId.category.isListed
    // );
    // if (unlistedCategoryProducts.length > 0) {
    //   const unlistedProductNames = unlistedCategoryProducts
    //     .map(item => item.productId.productName)
    //     .join(", ");
    //   console.log("orderPlaced - Unlisted category products found:", unlistedProductNames);
    //   return res.status(400).json({
    //     error: `Cannot proceed to checkout. The following products belong to unlisted categories: ${unlistedProductNames}. Please remove them from your cart.`,
    //   });
    // }

    // const blockedProducts = cart.items.filter(item => item.productId.isBlocked);
    // if (blockedProducts.length > 0) {
    //   const blockedProductNames = blockedProducts
    //     .map(item => item.productId.productName)
    //     .join(", ");
    //   console.log("orderPlaced - Blocked products found:", blockedProductNames);
    //   return res.status(400).json({
    //     error: `Cannot proceed to checkout. The following products are blocked: ${blockedProductNames}. Please remove them from your cart.`,
    //   });
    // }

    for( const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.isBlocked) {
        console.log("orderPlaced - Blocked product found:", item.productId._id);
        return res.status(400).json({ error: `Cannot proceed to checkout. The following product is blocked: ${item.productId.productName}. Please remove it from your cart.` });
      }
    }
    for (const item of cart.items) {
      const categoryOfProduct = await item.productId.category;
      if (!categoryOfProduct || categoryOfProduct.isListed === false) {
        console.log("orderPlaced - Unlisted product found:", item.productId._id);
        return res.status(400).json({ error: `Cannot proceed to checkout. The following product is unlisted: ${item.productId.productName}. Please remove it from your cart.` });
      }
    }
    const orderedItems = cart.items.map((item) => ({
      product: item.productId._id,
      quantity: Number(item.quantity),
      price: item.productId.salePrice,
      productStatus: "confirmed",
    }));

    const finalAmount = parseFloat(totalPrice);
    const totalDiscount = couponApplied && discount > 0 ? parseFloat(discount) : 0;

    console.log("orderPlaced - Calculated:", { totalPrice: finalAmount, discount: totalDiscount, finalAmount });

    const newOrderId = await generateOrderId();

    const newOrder = new Order({
      orderId: newOrderId,
      orderedItems,
      totalPrice: finalAmount,
      discount: totalDiscount,
      finalAmount,
      address,
      payment: paymentMethod === "cod" ? "cod" : paymentMethod === "wallet" ? "wallet" : "online",
      userId,
      status: paymentMethod === "cod" || paymentMethod === "wallet" ? "confirmed" : "pending",
      createdOn: Date.now(),
      couponApplied: couponApplied ? [couponApplied] : [],
    });

    const savedOrder = await newOrder.save();
    console.log("orderPlaced - Order saved:", { orderId: savedOrder.orderId, mongoId: savedOrder._id, totalPrice: savedOrder.totalPrice, discount: savedOrder.discount, finalAmount: savedOrder.finalAmount });

    if (paymentMethod === "wallet") {
      const walletBalance = wallet ? wallet.transactions.reduce(
        (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
        0
      ) : 0;
      console.log("orderPlaced - Wallet balance:", walletBalance);
      if (walletBalance < finalAmount) {
        console.log("orderPlaced - Insufficient wallet balance");
        await Order.deleteOne({ _id: savedOrder._id });
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      const transaction = {
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: finalAmount,
        type: "debit",
        description: "order_payment",
        orderId: savedOrder._id,
        balanceAfter: walletBalance - finalAmount,
        status: "completed",
        transactionDate: Date.now(),
      };

      if (!wallet) {
        const newWallet = new Wallet({
          userId,
          transactions: [transaction],
        });
        await newWallet.save();
        console.log("orderPlaced - New wallet created for user:", userId, "Wallet ID:", newWallet._id);
      } else {
        wallet.transactions.push(transaction);
        await wallet.save();
      }

      user.wallet = (user.wallet || 0) - finalAmount;
      await user.save();
    }

    if (paymentMethod === "cod" || paymentMethod === "wallet") {
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

      for (const item of orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const currentQuantity = parseInt(product.quantity, 10);
          if (currentQuantity < item.quantity) {
            console.log("orderPlaced - Insufficient stock for product:", item.product);
            await Order.deleteOne({ _id: savedOrder._id });
            return res.status(400).json({ error: `Insufficient stock for product ${item.product}` });
          }
          const newQuantity = currentQuantity - item.quantity;
          product.quantity = newQuantity.toString();
          await product.save();
          console.log("orderPlaced - Stock updated for product:", item.product, "New quantity:", product.quantity);
        }
      }

      return res.json({
        payment: true,
        method: paymentMethod,
        order: savedOrder,
        orderId: savedOrder.orderId,
      });
    } else if (paymentMethod === "razorpay") {
      try {
        const razorpayOrder = await razorpayInstance.orders.create({
          amount: Math.round(finalAmount * 100),
          currency: "INR",
          receipt: savedOrder._id.toString(),
        });
        console.log("orderPlaced - Razorpay order created:", razorpayOrder);

        return res.json({
          payment: true,
          method: "razorpay",
          order: savedOrder,
          orderId: savedOrder.orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          key: process.env.RAZORPAY_KEY_ID,
        });
      } catch (razorpayError) {
        console.error("orderPlaced - Razorpay Error:", razorpayError);
        await Order.findByIdAndUpdate(savedOrder._id, { payment: "failed" });
        return res.redirect(`/paymentFailed?orderId=${savedOrder.orderId}`);
      }
    } else {
      console.log("orderPlaced - Invalid payment method:", paymentMethod);
      return res.status(400).json({ error: "Invalid payment method" });
    }
  } catch (error) {
    console.error("Error in orderPlaced:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
const verifyPayment = async (req, res) => {
  try {
    const {
      orderId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;
    const userId = req.session.user;
    console.log("verifyPayment - Request body:", { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature, userId });

    if (
      !orderId ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      console.log("verifyPayment - Missing payment verification fields");
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
    console.log("verifyPayment - Generated signature:", generatedSignature);
    console.log("verifyPayment - Received signature:", razorpay_signature);

    const order = await Order.findOne({ orderId });
    if (!order) {
      console.log("verifyPayment - Order not found for orderId:", orderId);
      return res.status(404).json({ error: "Order not found" });
    }
    console.log("verifyPayment - Order found:", order.orderId);

    if (generatedSignature !== razorpay_signature) {
      console.log("verifyPayment - Signature verification failed");
      await Order.findOneAndUpdate({ orderId }, { payment: "failed" });
      return res.redirect(`/paymentFailed?orderId=${orderId}`);
    }

    order.status = "confirmed";
    order.payment = "online";
    await order.save();
    console.log("verifyPayment - Order status updated to confirmed");

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
    console.log("verifyPayment - Cart cleared for user:", userId);

    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const currentQuantity = parseInt(product.quantity, 10);
        const newQuantity = currentQuantity - item.quantity;
        product.quantity = newQuantity.toString();
        await product.save();
        console.log("verifyPayment - Stock updated for product:", item.product, "New quantity:", product.quantity);
      }
    }

    res.json({
      success: true,
      orderId: order.orderId,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Error in verifyPayment:", error);
    const order = await Order.findOne({ orderId: req.body.orderId });
    if (order) {
      await Order.findOneAndUpdate({ orderId: req.body.orderId }, { payment: "failed" });
    }
    res.redirect(`/paymentFailed?orderId=${req.body.orderId}`);
  }
};

const paymentFailed = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const userId = req.session.user;
    if (!userId) {
      console.error('paymentFailed: No user ID in session');
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('paymentFailed: User not found for ID:', userId);
      return res.redirect('/login');
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      console.error('paymentFailed: Order not found for orderId:', orderId);
      return res.render('paymentFailed', {
        errorMessage: 'Order not found',
        orderId,
        user,
        userAddress: null
      });
    }

    await Order.findOneAndUpdate({ orderId }, { payment: "failed", status: "pending" });

    const userAddress = await Address.findOne({ userId });

    console.log('paymentFailed: Rendering template with data:', {
      orderId,
      user: { name: user.name, email: user.email },
      userAddress: userAddress ? userAddress.address : null,
      errorMessage: 'Payment failed or was cancelled. Please try again.'
    });

    res.render('paymentFailed', {
      errorMessage: 'Payment failed or was cancelled. Please try again.',
      orderId,
      user,
      userAddress
    });
  } catch (error) {
    console.error('paymentFailed: Error:', error);
    res.render('paymentFailed', {
      errorMessage: 'An error occurred while loading the payment failed page.',
      orderId: req.query.orderId || null,
      user: null,
      userAddress: null
    });
  }
};

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.query;
    const userId = req.session.user;
    console.log("retryPayment - Request:", { orderId, userId });

    if (!orderId || !userId) {
      console.log("retryPayment - Missing orderId or userId");
      return res.status(400).json({ error: "Missing orderId or userId" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      console.log("retryPayment - Order not found for orderId:", orderId);
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "pending") {
      console.log("retryPayment - Order is not in pending state:", order.status);
      return res.status(400).json({ error: "Order is not eligible for retry" });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: "INR",
      receipt: order._id.toString(),
    });
    console.log("retryPayment - Razorpay order created:", razorpayOrder);

    res.json({
      payment: true,
      method: "razorpay",
      order,
      orderId: order.orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("retryPayment - Error:", error);
    await Order.findOneAndUpdate({ orderId }, { payment: "failed" });
    res.redirect(`/paymentFailed?orderId=${orderId}`);
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
    console.error("Error in deleteProduct:", error);
    res.redirect("/pageNotFound");
  }
};

const getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.id;

    const findOrder = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!findOrder) {
      console.log("getOrderDetailsPage - Order not found for orderId:", orderId);
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
    const finalAmount = findOrder.finalAmount;

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
    console.log("Cancel Order Request:", { orderId });

    const findOrder = await Order.findOne({ _id: orderId });
    if (!findOrder) {
      console.log("Order not found for ID:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }
    console.log("Order found:", findOrder);

    if (findOrder.status === "cancelled") {
      console.log("Order already cancelled:", orderId);
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    await Order.updateOne({ _id: orderId }, { status: "cancelled" });
    console.log("Order status updated to 'cancelled'");

    for (const item of findOrder.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity = parseInt(product.quantity) + item.quantity;
        await product.save();
        console.log("Stock restored for product:", item.product);
      }
    }

    if (findOrder.payment === "online" || findOrder.payment === "wallet") {
      const user = await User.findById(userId);
      if (!user) {
        console.log("User not found for ID:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("User found:", user._id, "Current wallet balance:", user.wallet);

      const refundAmount = findOrder.finalAmount;
      user.wallet = (user.wallet || 0) + refundAmount;
      const userSaveResult = await user.save();
      console.log(
        "User wallet updated. New balance:",
        user.wallet,
        "Save result:",
        userSaveResult
      );

      let userWallet = await Wallet.findOne({ userId });
      if (!userWallet) {
        console.log("No wallet found for user. Creating new wallet.");
        userWallet = new Wallet({ userId, transactions: [] });
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
      console.log(
        "Wallet transaction added:",
        transaction,
        "Save result:",
        walletSaveResult
      );
    }

    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const cancelSingleProduct = async (req, res) => {
  const { orderId, singleProductId } = req.body;
  console.log("cancelSingleProduct - Request:", { orderId, singleProductId });

  if (
    !mongoose.Types.ObjectId.isValid(orderId) ||
    !mongoose.Types.ObjectId.isValid(singleProductId)
  ) {
    console.log("Invalid ID format:", { orderId, singleProductId });
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }
    console.log("Order details:", { orderId: order._id, payment: order.payment });

    const oid = new mongoose.Types.ObjectId(singleProductId);
    const productIndex = order.orderedItems.findIndex(
      (item) => item.product.toString() === singleProductId
    );
    if (productIndex === -1) {
      console.log("Product not found in order:", singleProductId);
      return res.status(404).json({ message: "Product not found in order" });
    }
    console.log("Order details before processing:", order);
    const orderedItem = order.orderedItems[productIndex];
    console.log("Ordered item details:", orderedItem);

    const totalOrderAmount = order.totalPrice + order.discount;
    console.log("Total order amount (including discount):", totalOrderAmount);

    const productPrice = orderedItem.price;
    console.log("Product price:", productPrice);

    const discountPercentage = (productPrice / totalOrderAmount) * 100;
    console.log("Discount percentage for the product:", discountPercentage);

    const discountAmountForSingleProduct = (discountPercentage / 100) * order.discount;
    console.log("Discount amount for the single product:", discountAmountForSingleProduct);

    const refundAmount = orderedItem.price * orderedItem.quantity - discountAmountForSingleProduct;
    console.log("Refund amount calculated:", { refundAmount });

    const filter = { _id: orderId };
    const update = {
      $set: {
        "orderedItems.$[elem].productStatus": "cancelled",
      },
    };
    const options = { arrayFilters: [{ "elem.product": oid }] };
    const orderUpdateResult = await Order.updateOne(filter, update, options);
    console.log("Order update result:", orderUpdateResult);

    if (orderUpdateResult.modifiedCount === 0) {
      console.log("Order update failed - no changes made");
      return res.status(500).json({ message: "Failed to update order status" });
    }
    console.log("Product status updated to 'cancelled'");

    const product = await Product.findById(singleProductId);
    if (product) {
      product.quantity = parseInt(product.quantity) + orderedItem.quantity;
      await product.save();
      console.log(
        "Stock restored for product:",
        singleProductId,
        "New quantity:",
        product.quantity
      );
    } else {
      console.log("Product not found for stock update:", singleProductId);
    }

    if (order.payment === "online" || order.payment === "wallet") {
      const user = await User.findById(order.userId);
      if (!user) {
        console.log("User not found for ID:", order.userId);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("User found:", { id: user._id, currentWallet: user.wallet });

      const oldWalletBalance = user.wallet || 0;
      user.wallet = oldWalletBalance + refundAmount;
      const userSaveResult = await user.save();
      console.log("User wallet updated:", {
        oldBalance: oldWalletBalance,
        refundAmount,
        newBalance: user.wallet,
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
      await userWallet.save();
      console.log("Wallet transaction added:", transaction);
    }

    const updatedOrder = await Order.findOne({ _id: orderId });
    const allCancelled = updatedOrder.orderedItems.every(
      (item) => item.productStatus === "cancelled"
    );
    if (allCancelled) {
      await Order.updateOne({ _id: orderId }, { status: "cancelled" });
      console.log("All items cancelled, order status updated to 'cancelled'");
      return res.status(200).json({
        message: "All products cancelled, order status updated to cancelled",
      });
    }

    res.status(200).json({ message: "Product status updated successfully" });
  } catch (error) {
    console.error("Error in cancelSingleProduct:", error.stack);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const returnSingleProduct = async (req, res) => {
  const { orderId, singleProductId, returnReason } = req.body;
  const oid = new mongoose.Types.ObjectId(singleProductId);

  if (
    !mongoose.Types.ObjectId.isValid(orderId) ||
    !mongoose.Types.ObjectId.isValid(singleProductId)
  ) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== "shipped" && order.status !== "delivered") {
      return res.status(400).json({
        message: "Order must be shipped or delivered to request a return",
      });
    }

    const productIndex = order.orderedItems.findIndex(
      (item) => item.product.toString() === singleProductId
    );
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found in order" });
    }

    if (
      order.orderedItems[productIndex].productStatus === "returned" ||
      order.orderedItems[productIndex].productStatus === "return-requested"
    ) {
      return res.status(400).json({
        message: "Product is already returned or a return is requested",
      });
    }

    const filter = { _id: orderId };
    const update = {
      $set: { "orderedItems.$[elem].productStatus": "return-requested",
               "orderedItems.$[elem].returnReason": returnReason
       },
    };
    const options = { arrayFilters: [{ "elem.product": oid }] };
    await Order.updateOne(filter, update, options);

    res.status(200).json({
      message: "Return request submitted to admin for approval",
    });
  } catch (error) {
    console.error("Error in returnSingleProduct:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const returnorder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.body;
    const findOrder = await Order.findOne({ _id: orderId });

    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (
      findOrder.status === "returned" ||
      findOrder.status === "return-requested"
    ) {
      return res.status(400).json({
        message: "Order is already returned or a return is requested",
      });
    }
    if (findOrder.status !== "shipped" && findOrder.status !== "delivered") {
      return res.status(400).json({
        message: "Order must be shipped or delivered to request a return",
      });
    }

    await Order.updateOne({ _id: orderId }, { status: "return-requested" });
    res.status(200).json({
      message: "Return request submitted to admin for approval",
    });
  } catch (error) {
    console.error("Error in returnorder:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const changeSingleProductStatus = async (req, res) => {
  const { orderId, singleProductId, status } = req.body;
  const oid = new mongoose.Types.ObjectId(singleProductId);

  if (
    !mongoose.Types.ObjectId.isValid(orderId) ||
    !mongoose.Types.ObjectId.isValid(singleProductId)
  ) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
    const order = await Order.findOne({ _id: orderId });
    const productIndex = order.orderedItems.findIndex(
      (item) => item.product.toString() === singleProductId
    );
    const orderedItemPrice = order.orderedItems[productIndex].price;
    const newPrice = order.totalPrice - orderedItemPrice;
    const newFinalAmount = order.finalAmount - orderedItemPrice;

    const filter = { _id: orderId };
    const update = {
      $set: {
        "orderedItems.$[elem].productStatus": status,
        totalPrice: newPrice,
        finalAmount: newFinalAmount,
      },
    };
    const options = {
      arrayFilters: [{ "elem.product": oid }],
    };
    const result = await Order.updateOne(filter, update, options);
    res.status(200).json({
      message: "Product status updated successfully",
      result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const data = {
      documentTitle: "INVOICE",
      currency: "INR",
      taxNotation: "gst",
      marginTop: 25,
      marginRight: 25,
      marginLeft: 25,
      marginBottom: 25,
      sender: {
        company: "Male Fashion",
        address: "Thrikkakkara",
        zip: "682021",
        city: "Kochi",
        country: "India",
      },
      client: {
        company: order.address.name,
        address: `${order.address.landMark}, ${order.address.city}`,
        zip: order.address.pincode,
        city: order.address.state,
        country: "India",
      },
      information: {
        number: order.orderId || order._id.toString(),
        date: moment(order.createdOn).format("YYYY-MM-DD HH:mm:ss"),
      },
      products: order.orderedItems.map((item) => ({
        quantity: item.quantity,
        description: item.product.productName || "Product",
        tax: 0,
        price: item.price,
      })),
      bottomNotice:
        `Total: ₹${order.totalPrice.toFixed(2)}\n` +
        (order.couponApplied.length > 0
          ? `Coupon Discount: -₹${order.discount.toFixed(2)}\n`
          : "") +
        `Final Amount: ₹${order.finalAmount.toFixed(2)}`,
    };

    const result = await easyinvoice.createInvoice(data);
    const invoicePath = path.join(
      __dirname,
      "../../public/invoice/",
      `invoice_${orderId}.pdf`
    );
    fs.writeFileSync(invoicePath, result.pdf, "base64");
    res.download(invoicePath, `invoice_${orderId}.pdf`, (err) => {
      if (err) {
        console.error("Error downloading the file", err);
      }
      fs.unlinkSync(invoicePath);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while generating the invoice");
  }
};

const clearCart = async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("clearCart - Clearing cart for user:", userId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.log("clearCart - Missing or invalid userId:", userId);
      return res.status(400).json({ error: "Missing or invalid userId" });
    }

    const result = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },
      { new: true }
    );

    if (!result) {
      console.log("clearCart - Cart not found for user:", userId);
      return res.status(404).json({ error: "Cart not found" });
    }

    console.log("clearCart - Cart cleared successfully for user:", userId);
    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (error) {
    console.error("clearCart - Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const changeOrderStatus = async (req, res) => {
  const { orderId, status } = req.body;
  console.log("changeOrderStatus - Request:", { orderId, status });

  if (!orderId || !status) {
    console.log("changeOrderStatus - Missing orderId or status:", { orderId, status });
    return res.status(400).json({ message: "Missing orderId or status" });
  }

  try {
    const order = await Order.findOne({ orderId });
    if (!order) {
      console.log("changeOrderStatus - Order not found for orderId:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    if (status === "failed") {
      order.payment = "failed";
    }
    await order.save();
    console.log("changeOrderStatus - Order status updated to:", order.status, "Order ID:", orderId);

    res.status(200).json({ message: "Order status updated successfully" });
  } catch (error) {
    console.error("changeOrderStatus - Error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
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
  verifyPayment,
  applyCoupon,
  clearCart,
  changeOrderStatus,
  paymentFailed,
  retryPayment,
};