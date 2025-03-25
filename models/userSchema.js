const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"]  // ✅ Email validation
    },

    phone: {
        type: String,
        required: false,
        sparse: true,
        default: null
    },

    googleId: {
        type: String,
        unique: true,
        sparse: true  // ✅ Prevents duplicate null errors
    },

    password: {
        type: String,
        required: function () {
            return !this.googleId;  // ✅ Password required only if not using Google login
        }
    },

    isBlocked: {
        type: Boolean,
        default: false
    },

    isAdmin: {
        type: Boolean,
        default: false
    },

    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
        default: []  // ✅ Default empty array
    }],

    wallet: {
        type: Number,
        default: 0
    },

    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist",
        default: []  // ✅ Default empty array
    }],

    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order",
        default: []  // ✅ Default empty array
    }],

    createdOn: {
        type: Date,
        default: Date.now
    },

    referalCode: {
        type: String
    },

    redeemed: {
        type: Boolean,
        default: false  // ✅ Default set to false
    },

    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        default: []  // ✅ Default empty array
    }],

    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
});

const User = mongoose.model("User", userSchema);
module.exports = User;
