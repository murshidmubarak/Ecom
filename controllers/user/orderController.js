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
      
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const serverDate = new Date();
    

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
     
      return res.status(404).json({ error: "User not found" });
    }

    if (!cart || !cart.items || cart.items.length === 0) {
     
      return res.redirect("/shop");
    }

  

    const grandTotal = cart.items.reduce((total, item) => {
      const salePrice = Number(item.productId.salePrice) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + quantity * salePrice;
    }, 0);
   

    const normalizedCouponApplied = user.couponApplied.map(code => code.toUpperCase());
    

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
   

    let errorMessage = null;



    const cartData = cart.items.map((item) => ({
      cart: {
        productId: item.productId._id,
        quantity: item.quantity,
      },
      productDetails: item.productId,
    }));

    const csrfToken = req.csrfToken();
    

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
   
    res.redirect("/pageNotFound");
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, totalPrice } = req.body;
    const userId = req.session.user;
   

    if (!couponCode || !totalPrice || !userId) {
     
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const sanitizedCouponCode = couponCode.trim().toUpperCase();
    

    const coupon = await Coupon.findOne({ 
      couponName: { $regex: `^${sanitizedCouponCode}$`, $options: 'i' }
    });
    const allCoupons = await Coupon.find().sort({ createdAt: -1 });
    

   
    if (!coupon) {
      return res.status(400).json({ error: "Coupon does not exist" });
    }

    if (!coupon.isActive) {
    
      return res.status(400).json({ error: "Coupon is inactive" });
    }

    if (coupon.status === "Expired" || new Date() > coupon.endDate) {
      
      return res.status(400).json({ error: "Coupon has expired" });
    }

    if (coupon.status !== "Active" || new Date() < coupon.startDate) {
     
      return res.status(400).json({ error: "Coupon is not valid yet" });
    }

    if (parseFloat(totalPrice) < coupon.minimumPrice) {
   
      return res.status(400).json({
        error: `Minimum order amount is ₹${coupon.minimumPrice}`,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      
      return res.status(404).json({ error: "User not found" });
    }

    const normalizedCouponApplied = user.couponApplied.map(code => code.toUpperCase());
    if (normalizedCouponApplied.includes(sanitizedCouponCode)) {
     
      return res.status(400).json({ error: "Coupon already used" });
    }

   

    
    res.json({
      success: true,
      discount: coupon.offerPrice,
      couponName: coupon.couponName,
    });
  } catch (error) {
   
    res.status(500).json({ error: "Failed to apply coupon", details: error.message });
  }
};


const orderPlaced = async (req, res) => {
  try {
    const { totalPrice, addressId, paymentMethod, couponApplied, discount } = req.body;
    const userId = req.session.user;

    if (!userId || !addressId || !totalPrice || !paymentMethod) {
      
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [user, cart, addressDoc, wallet] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId }).populate("items.productId"),
      Address.findOne({ userId, "address._id": addressId }),
      Wallet.findOne({ userId }),
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
      (addr) => addr._id.toString() === addressId
    );
    if (!address) {
     
      return res.status(404).json({ error: "Address ID not found" });
    }

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.quantity < item.quantity) {
        
        return res.status(400).json({ error: `Insufficient stock for product ${item.productId.productName}` });
      }
    }
    

    for( const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.isBlocked) {
      
        return res.status(400).json({ error: `Cannot proceed to checkout. The following product is blocked: ${item.productId.productName}. Please remove it from your cart.` });
      }
    }
    for (const item of cart.items) {
      const categoryOfProduct = await item.productId.category;
      if (!categoryOfProduct || categoryOfProduct.isListed === false) {
        
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
    

    if (paymentMethod === "wallet") {
      const walletBalance = wallet ? wallet.transactions.reduce(
        (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
        0
      ) : 0;
      
      if (walletBalance < finalAmount) {
        
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
            
            await Order.deleteOne({ _id: savedOrder._id });
            return res.status(400).json({ error: `Insufficient stock for product ${item.product}` });
          }
          const newQuantity = currentQuantity - item.quantity;
          product.quantity = newQuantity.toString();
          await product.save();
          
        }
      }

     if (couponApplied) {
  const sanitizedCouponCode = couponApplied.trim().toUpperCase();

  
  await User.updateOne(
    { _id: userId },
    { $push: { couponApplied: sanitizedCouponCode } }
  );
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
       
        await Order.findByIdAndUpdate(savedOrder._id, { payment: "failed" });
        return res.redirect(`/paymentFailed?orderId=${savedOrder.orderId}`);
      }
    } else {
      
      return res.status(400).json({ error: "Invalid payment method" });
    }
  } catch (error) {
   
    res.status(500).json({ error: "Server error", details: error.message });
    console.log(error)
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
    

    if (
      !orderId ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
   
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
   

    const order = await Order.findOne({ orderId });
    if (!order) {
    
      return res.status(404).json({ error: "Order not found" });
    }
   

    if (generatedSignature !== razorpay_signature) {
      
      await Order.findOneAndUpdate({ orderId }, { payment: "failed" });
      return res.redirect(`/paymentFailed?orderId=${orderId}`);
    }

    order.status = "confirmed";
    order.payment = "online";
    await order.save();
   

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
   

    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const currentQuantity = parseInt(product.quantity, 10);
        const newQuantity = currentQuantity - item.quantity;
        product.quantity = newQuantity.toString();
        await product.save();
        
      }
    }
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    res.json({
      success: true,
      orderId: order.orderId,
      message: "Payment verified successfully",
    });
  } catch (error) {
   
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
     
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    if (!user) {
      
      return res.redirect('/login');
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
     
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

    const csrfToken = req.csrfToken();

    res.render('paymentFailed', {
      csrfToken,
      errorMessage: 'Payment failed or was cancelled. Please try again.',
      orderId,
      user,
      userAddress
    });
  } catch (error) {

    res.render('paymentFailed', {
      errorMessage: 'An error occurred while loading the payment failed page.',
      orderId: req.query.orderId || null,
      user: null,
      userAddress: null
    });
  }
};

const retryPayment = async (req, res) => {
      const { orderId } = req.query;
      const userId = req.session.user;
  try {
    
   

    if (!orderId || !userId) {
    
      return res.status(400).json({ error: "Missing orderId or userId" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
    
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "pending") {
      
      return res.status(400).json({ error: "Order is not eligible for retry" });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: "INR",
      receipt: order._id.toString(),
    });
    

        order.payment = "online";
        order.status = "confirmed"; // Reset status to success for retry
        await order.save();
       
     for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const currentQuantity = parseInt(product.quantity, 10);
        const newQuantity = currentQuantity - item.quantity;
        product.quantity = newQuantity.toString();
        await product.save();
        
      }
    }


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
    
    res.redirect("/pageNotFound");
  }
};

const getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.id;

    const findOrder = await Order.findOne({ orderId }).populate("orderedItems.product");
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
    const finalAmount = findOrder.finalAmount;

    const csrfToken = req.csrfToken();

    res.render("orderDetails", {
      csrfToken,
      orders: findOrder,
      user: findUser,
      totalGrant: totalGrant,
      totalPrice: totalPrice,
      finalAmount: finalAmount,
    });
  } catch (error) {
   
    res.redirect("/pageNotFound");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.body;

    const findOrder = await Order.findOne({ _id: orderId });
    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (findOrder.status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    await Order.updateOne({ _id: orderId }, { status: "cancelled" });

    // ✅ UPDATED: Only restock non-cancelled items
    for (const item of findOrder.orderedItems) {
      if (item.productStatus !== "cancelled") {
        const product = await Product.findById(item.product);
        if (product) {
          product.quantity = parseInt(product.quantity) + item.quantity;
          await product.save();
        }
      }
    }

    if (findOrder.payment === "online" || findOrder.payment === "wallet") {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // ✅ UPDATED: Calculate refund excluding already cancelled items
      let totalCancelledProductRefund = 0;
      for (const item of findOrder.orderedItems) {
        if (item.productStatus === "cancelled") {
          const productPrice = item.price;
          const totalOrderAmount = findOrder.totalPrice + findOrder.discount;
          const discountPercentage = (productPrice / totalOrderAmount) * 100;
          const discountAmount = (discountPercentage / 100) * findOrder.discount;
          const itemRefund = (productPrice * item.quantity) - (discountAmount * item.quantity);
          totalCancelledProductRefund += itemRefund;
        }
      }

      const refundAmount = findOrder.finalAmount - totalCancelledProductRefund;
      // ✅ END UPDATED

      user.wallet = (user.wallet || 0) + refundAmount;
      const userSaveResult = await user.save();

      let userWallet = await Wallet.findOne({ userId });
      if (!userWallet) {
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
    }

    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


const cancelSingleProduct = async (req, res) => {
  const { orderId, singleProductId } = req.body;

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

    const oid = new mongoose.Types.ObjectId(singleProductId);
    const productIndex = order.orderedItems.findIndex(
      (item) => item.product.toString() === singleProductId
    );
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found in order" });
    }
    const orderedItem = order.orderedItems[productIndex];
    

    const totalOrderAmount = order.totalPrice + order.discount;

    const productPrice = orderedItem.price;

    const discountPercentage = (productPrice / totalOrderAmount) * 100;

    const discountAmountForSingleProduct = (discountPercentage / 100) * order.discount;

    const refundAmount = orderedItem.price * orderedItem.quantity - discountAmountForSingleProduct * orderedItem.quantity;

    const filter = { _id: orderId };
    const update = {
      $set: {
        "orderedItems.$[elem].productStatus": "cancelled",
      },
    };
    const options = { arrayFilters: [{ "elem.product": oid }] };
    const orderUpdateResult = await Order.updateOne(filter, update, options);

    if (orderUpdateResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update order status" });
    }
   

    const product = await Product.findById(singleProductId);
    if (product) {
      product.quantity = parseInt(product.quantity) + orderedItem.quantity;
      await product.save();
     
    } else {
      console.log("Product not found for stock update:", singleProductId);
    }

    if (order.payment === "online" || order.payment === "wallet") {
      const user = await User.findById(order.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
     

      const oldWalletBalance = user.wallet || 0;
      user.wallet = oldWalletBalance + refundAmount;
      const userSaveResult = await user.save();
      

      if (userSaveResult.wallet !== user.wallet) {
        return res.status(500).json({ message: "Failed to update user wallet" });
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
      
    }

    const updatedOrder = await Order.findOne({ _id: orderId });
    const allCancelled = updatedOrder.orderedItems.every(
      (item) => item.productStatus === "cancelled"
    );
    if (allCancelled) {
      await Order.updateOne({ _id: orderId }, { status: "cancelled" });
      return res.status(200).json({
        message: "All products cancelled, order status updated to cancelled",
      });
    }

    res.status(200).json({ message: "Product status updated successfully" });
  } catch (error) {
   
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
   
    res.status(500).send("An error occurred while generating the invoice");
  }
};

const clearCart = async (req, res) => {
  try {
    const { userId } = req.body;
    

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
     
      return res.status(400).json({ error: "Missing or invalid userId" });
    }

    const result = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },
      { new: true }
    );

    if (!result) {
    
      return res.status(404).json({ error: "Cart not found" });
    }

   
    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (error) {
  
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const changeOrderStatus = async (req, res) => {
  const { orderId, status } = req.body;
  

  if (!orderId || !status) {
   
    return res.status(400).json({ message: "Missing orderId or status" });
  }

  try {
    const order = await Order.findOne({ orderId });
    if (!order) {
      
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    if (status === "failed") {
      order.payment = "failed";
    }
    await order.save();
   

    res.status(200).json({ message: "Order status updated successfully" });
  } catch (error) {
   
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