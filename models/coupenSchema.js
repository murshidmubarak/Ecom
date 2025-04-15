// models/coupenSchema.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    couponName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[A-Za-z0-9]{1,50}$/,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    offerPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Inactive"],
      required: true,
      default: "Active",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;