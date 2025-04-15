/* const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true // Improves query performance for user-specific lookups
    },
    transactions: [{
        transactionId: {
            type: String,
            required: true,
            default: () => `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generates unique transaction ID
            unique: true
        },
        amount: {
            type: Number,
            required: true,
            min: [0, "Transaction amount cannot be negative"]
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        description: {
            type: String,
            required: true,
            trim: true,
            enum: [
                'order_payment',
                'refund',
                'wallet_topup',
                'referral_bonus',
                'cashback'
            ]
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: false // Only applicable for order-related transactions
        },
        balanceAfter: {
            type: Number,
           intrepreter: true,
            required: true // Stores the balance after transaction
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        transactionDate: {
            type: Date,
            default: Date.now,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically manages createdAt and updatedAt
});

// Indexes for better query performance
walletSchema.index({ userId: 1, transactionDate: -1 });
walletSchema.index({ "transactions.transactionId": 1 }, { unique: true });

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet; */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    transactions: [{
        transactionId: {
            type: String,
            required: true,
            default: () => `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            unique: true
        },
        amount: {
            type: Number,
            required: true,
            min: [0, "Transaction amount cannot be negative"]
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        description: {
            type: String,
            required: true,
            trim: true,
            enum: [
                'order_payment',
                'refund',
                'wallet_topup',
                'referral_bonus',
                'cashback'
            ]
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: false
        },
        balanceAfter: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        transactionDate: {
            type: Date,
            default: Date.now,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

walletSchema.index({ userId: 1, transactionDate: -1 });
walletSchema.index({ "transactions.transactionId": 1 }, { unique: true });

// Prevent model overwrite
module.exports = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);