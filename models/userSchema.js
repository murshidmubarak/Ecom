/* const mongoose = require("mongoose");
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
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
        },
        phone: {
            type: String,
            required: false,
            default: null,
            trim: true,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        couponApplied: {
            type: [String], 
            default: []
        },
        password: {
            type: String,
            required: function () {
                return !this.googleId;
            },
            minlength: [6, "Password must be at least 6 characters long"],
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        profilePhoto: {
            type: String,
            default: null
        },
        wallet: {
            type: Number,
            default: 0,
            min: [0, "Wallet balance cannot be negative"],
        },
        wishlist: [{
            type: Schema.Types.ObjectId,
            ref: "Wishlist",
        }],
        orderHistory: [{
            type: Schema.Types.ObjectId,
            ref: "Order",
        }],
        createdOn: {
            type: Date,
            default: Date.now,
        },
        referalCode: {
            type: String,
            required: false,
        },
        redeemed: {
            type: Boolean,
            default: false,
        },
        redeemedUsers: [{
            type: Schema.Types.ObjectId,
            ref: "User",
        }],
        searchHistory: [{
            category: {
                type: Schema.Types.ObjectId,
                ref: "Category",
            },
            brand: {
                type: String,
                trim: true,
            },
            searchOn: {
                type: Date,
                default: Date.now,
            },
        }],
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ "cart.productId": 1 });

const User = mongoose.model("User", userSchema);
module.exports = User;