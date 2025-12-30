const Order = require("../models/orderSchema");
const Address = require("../models/addressSchema");


// ✅ ORDER OWNERSHIP
const ownsOrder = async (req, res, next) => {
  try {
    const orderId =
      req.query.id ||
      req.params.orderId ||
      req.body.orderId;

    if (!orderId) {
      console.error("No orderId provided");
      return res.redirect("/pageNotFound");
    }

    const order = await Order.findOne({
      orderId: orderId,               
      userId: req.session.user 
    });

    if (!order) {
      console.error("Order not found or not owned by user");
      return res.redirect("/pageNotFound");
    }

    req.order = order;
    next();
  } catch (error) {
    console.error("Order ownership error:", error);
    res.redirect("/pageNotFound");
  }
};



// ✅ ADDRESS OWNERSHIP
const ownsAddress = async (req, res, next) => {
  try {
    const addressId =
      req.params.id ||
      req.query.id ||
      req.body.id ||
      req.body.addressId;

    if (!addressId) {
      return res.redirect("/pageNotFound");
    }

    const addressDoc = await Address.findOne({
      userId: req.session.user,
      "address._id": addressId
    });

    if (!addressDoc) {
      return res.redirect("/pageNotFound");
    }

    // extract the matched address
    req.address = addressDoc.address.find(
      a => a._id.toString() === addressId
    );

    next();
  } catch (err) {
    console.error("ownsAddress error:", err);
    res.redirect("/pageNotFound");
  }
};



module.exports = {
  ownsOrder,
  ownsAddress
};