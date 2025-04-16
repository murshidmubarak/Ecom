const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/coupenSchema"); // Fixed typo
const mongoose = require("mongoose");
const easyinvoice = require("easyinvoice");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const razorpayInstance = require("../../config/razorpay");
const crypto = require("crypto");
const Wallet = require("../../models/walletSchema");

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user || req.query.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const [user, cart, addressData, wallet] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId }).populate("items.productId"),
      Address.findOne({ userId }),
      Wallet.findOne({ userId }),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect("/shop");
    }

    const cartData = cart.items.map((item) => ({
      cart: {
        productId: item.productId._id,
        quantity: item.quantity,
      },
      productDetails: item.productId,
    }));

    const grandTotal = cart.items.reduce(
      (total, item) => total + item.quantity * item.productId.salePrice,
      0
    );

    const walletBalance = wallet ? wallet.transactions.reduce(
      (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
      0
    ) : 0;

    res.render("checkout", {
      product: cartData,
      user,
      isCart: true,
      userAddress: addressData,
      grandTotal: grandTotal || 0,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      walletBalance: walletBalance.toFixed(2),
    });
  } catch (error) {
    console.error("Error in getCheckoutPage:", error);
    res.redirect("/pageNotFound");
  }
};

const applyCoupon = async (req, res) => {
  try {
    //console.log("applyCoupon - Request:", req.body, "Session User:", req.session.user);
    const { couponCode, totalPrice } = req.body;
    const userId = req.session.user;
console.log(req.body);

    if (!couponCode || !totalPrice || !userId) {
      console.log("applyCoupon - Missing fields:", { couponCode, totalPrice, userId });
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("applyCoupon - Invalid userId:", userId);
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const coupon = await Coupon.findOne({ couponName: couponCode });
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    console.log("Coupeon",coupons);
    
    console.log("applyCoupon - Coupon query result:", coupon);
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

    const user = await User.findById(userId)
      let couponApplied = user.couponApplied.filter((item) => item === couponCode); 

console.log("Coupon applied",couponApplied);
    if (couponApplied.length!==0) {
      return res.status(400).json({ error: "Coupon already used" });
    }

    await user.updateOne(
      { userId },
      { $push: { couponApplied: couponCode } }
    );

    res.json({
      success: true,
      discount: coupon.offerPrice,
      couponName: coupon.couponName,
    });
  } catch (error) {
    console.error("Error in applyCoupon:", error);
    res.status(500).json({ error: "Failed to apply coupon" });
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

    const orderedItems = cart.items.map((item) => ({
      product: item.productId._id,
      quantity: Number(item.quantity),
      price: item.productId.salePrice,
      productStatus: "confirmed",
    }));
  console.log("Total price",totalPrice,"Discount",discount,"Coupon applied",couponApplied);
    const finalAmount = parseFloat(totalPrice) 
    console.log("Final Amount",finalAmount);
    const newOrder = new Order({
      orderId: require("uuid").v4(),
      orderedItems,
      totalPrice: parseFloat(totalPrice),
      discount: couponApplied ? parseFloat(discount) : 0,
      finalAmount,
      address,
      payment: paymentMethod === "cod" ? "cod" : "online", // Map wallet to online
      userId,
      status: paymentMethod === "cod" || paymentMethod === "wallet" ? "confirmed" : "pending",
      createdOn: Date.now(),
      couponApplied: !!couponApplied,
    });

    if (paymentMethod === "wallet") {
      const walletBalance = wallet ? wallet.transactions.reduce(
        (sum, tx) => sum + (tx.type === "credit" ? tx.amount : -tx.amount),
        0
      ) : 0;
      if (walletBalance < finalAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      const transaction = {
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: finalAmount,
        type: "debit",
        description: "order_payment",
        orderId: newOrder._id,
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

    const savedOrder = await newOrder.save();

    if (paymentMethod === "cod" || paymentMethod === "wallet") {
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

      for (const item of orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const currentQuantity = parseInt(product.quantity, 10);
          const newQuantity = currentQuantity - item.quantity;
          product.quantity = newQuantity.toString();
          await product.save();
        }
      }

      return res.json({
        payment: true,
        method: paymentMethod,
        order: savedOrder,
        orderId: savedOrder._id,
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
          orderId: savedOrder._id,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          key: process.env.RAZORPAY_KEY_ID,
        });
      } catch (razorpayError) {
        console.error("Razorpay Error:", razorpayError);
        await Order.deleteOne({ _id: savedOrder._id });
        return res.status(500).json({
          error: "Failed to create Razorpay order",
          details: razorpayError.message,
        });
      }
    } else {
      return res.status(400).json({ error: "Invalid payment method" });
    }
  } catch (error) {
    console.error("Error processing order:", error);
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

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
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

    res.json({
      success: true,
      orderId: order._id,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Server error", details: error.message });
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

    const findOrder = await Order.findOne({ _id: orderId }).populate(
      "orderedItems.product"
    );
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

    if (findOrder.payment === "online") {
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
    console.log("Order details:", {
      orderId: order._id,
      payment: order.payment,
      totalPrice: order.totalPrice,
      userId: order.userId,
    });

    const oid = new mongoose.Types.ObjectId(singleProductId);
    const productIndex = order.orderedItems.findIndex(
      (item) => item.product.toString() === singleProductId
    );
    if (productIndex === -1) {
      console.log("Product not found in order:", singleProductId);
      return res.status(404).json({ message: "Product not found in order" });
    }

    const orderedItemPrice = order.orderedItems[productIndex].price;
    const newPrice = order.totalPrice - orderedItemPrice;
    const newFinalAmount = order.finalAmount - orderedItemPrice;
    console.log(
      "Cancelling product. Refund amount:",
      orderedItemPrice,
      "New totalPrice:",
      newPrice
    );

    const filter = { _id: orderId };
    const update = {
      $set: {
        "orderedItems.$[elem].productStatus": "cancelled",
        totalPrice: newPrice,
        finalAmount: newFinalAmount,
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
      product.quantity =
        parseInt(product.quantity) + order.orderedItems[productIndex].quantity;
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

    if (order.payment === "online") {
      const user = await User.findById(order.userId);
      if (!user) {
        console.log("User not found for ID:", order.userId);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("User found:", { id: user._id, currentWallet: user.wallet });

      const oldWalletBalance = user.wallet || 0;
      
      user.wallet = oldWalletBalance + refundAmount;
      const userSaveResult = await user.save();
      console.log("User wallet update attempted:", {
        oldBalance: oldWalletBalance,
        refundAmount: orderedItemPrice,
        newBalance: user.wallet,
        saveResult: {
          modifiedCount: userSaveResult.modifiedCount,
          wallet: userSaveResult.wallet,
        },
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
        amount: orderedItemPrice,
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

    const updatedOrder = await Order.findOne({ _id: orderId });
    const allCancelled = updatedOrder.orderedItems.every(
      (item) => item.productStatus === "cancelled"
    );
    if (allCancelled) {
      const fullOrderUpdate = await Order.updateOne(
        { _id: orderId },
        { status: "cancelled" }
      );
      console.log(
        "All items cancelled, order status updated to 'cancelled'",
        fullOrderUpdate
      );
      res.status(200).json({
        message: "All products cancelled, order status updated to cancelled",
      });
    } else {
      res.status(200).json({ message: "Product status updated successfully" });
    }
  } catch (error) {
    console.error("Error in cancelSingleProduct:", error.stack);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const returnSingleProduct = async (req, res) => {
  const { orderId, singleProductId } = req.body;
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
      $set: { "orderedItems.$[elem].productStatus": "return-requested" },
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
        (order.couponApplied
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
};