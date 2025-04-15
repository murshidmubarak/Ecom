// controllers/admin/coupenController.js
const Coupon = require("../../models/coupenSchema");

const loadCoupen = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.render("coupen", { coupons });
  } catch (error) {
    console.error("Error loading coupons:", error);
    return res.redirect("/pageerror");
  }
};

const createCoupon = async (req, res) => {
  try {
    const { couponName, startDate, endDate, offerPrice, minimumPrice, status } = req.body;

    // Server-side validation
    const sDateObj = new Date(startDate);
    const eDateObj = new Date(endDate);
    const todayDateObj = new Date();
    todayDateObj.setHours(0, 0, 0, 0);

    if (sDateObj > eDateObj) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
    if (sDateObj <= todayDateObj) {
      return res.status(400).json({ error: "Start date must be today or later" });
    }
    if (!/^[A-Za-z0-9]{1,50}$/.test(couponName)) {
      return res.status(400).json({ error: "Invalid coupon name" });
    }
    if (isNaN(offerPrice) || isNaN(minimumPrice) || offerPrice >= minimumPrice) {
      return res.status(400).json({ error: "Offer price must be less than minimum price" });
    }
    if (!["Active", "Expired", "Inactive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const newCoupon = new Coupon({
      couponName,
      startDate: sDateObj,
      endDate: eDateObj,
      offerPrice: parseFloat(offerPrice),
      minimumPrice: parseFloat(minimumPrice),
      status, // Use status from form
    });

    await newCoupon.save();
    
    return res.redirect("/admin/coupen");
  } catch (error) {
    console.error("Error creating coupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Coupon name already exists" });
    }
    return res.status(500).json({ error: "Failed to create coupon" });
  }
};

const editCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { couponName, startDate, endDate, offerPrice, minimumPrice, status, isActive } = req.body;

    const sDateObj = new Date(startDate);
    const eDateObj = new Date(endDate);
    const todayDateObj = new Date();
    todayDateObj.setHours(0, 0, 0, 0);

    if (sDateObj > eDateObj) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
    if (sDateObj <= todayDateObj) {
      return res.status(400).json({ error: "Start date must be today or later" });
    }
    if (!/^[A-Za-z0-9]{1,50}$/.test(couponName)) {
      return res.status(400).json({ error: "Invalid coupon name" });
    }
    if (isNaN(offerPrice) || isNaN(minimumPrice) || offerPrice >= minimumPrice) {
      return res.status(400).json({ error: "Offer price must be less than minimum price" });
    }
    if (!["Active", "Expired", "Inactive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      {
        couponName,
        startDate: sDateObj,
        endDate: eDateObj,
        offerPrice: parseFloat(offerPrice),
        minimumPrice: parseFloat(minimumPrice),
        status,
        isActive: isActive === "true",
      },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    return res.redirect("/admin/coupen");
  } catch (error) {
    console.error("Error editing coupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Coupon name already exists" });
    }
    return res.status(500).json({ error: "Failed to edit coupon" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Coupon ID is required" });
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(id);

    if (!deletedCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    return res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({ error: "Failed to delete coupon" });
  }
};

module.exports = {
  loadCoupen,
  createCoupon,
  editCoupon,
  deleteCoupon,
};