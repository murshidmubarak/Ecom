const Coupon = require("../../models/coupenSchema");

const loadCoupen = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    const csrfToken = req.csrfToken ? req.csrfToken() : null; // Get CSRF token if available
    return res.render("coupen", { coupons, csrfToken });
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

    const existingCoupon = await Coupon.findOne({ couponName });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: "Coupon name already existssssss" });
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
    return res.status(200).json({ success: true, message: "Coupon created successfully" });

   

    
    return res.redirect("/admin/coupen");
  } catch (error) {
    console.error("Error creating coupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Coupon name already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to create coupon" });
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

  //  const existingCoupon = await Coupon.findOne({ couponName });
  //   if (existingCoupon) {
  //     return res.status(400).json({ success: false, message: "Coupon name already existssssss" });
  //   }

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

     await updatedCoupon.save();
    return res.status(200).json({ success: true, message: "Coupon updated successfully" });

    // if (!updatedCoupon) {
    //   return res.status(404).json({ error: "Coupon not found" });
    // }

    // return res.redirect("/admin/coupen");
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