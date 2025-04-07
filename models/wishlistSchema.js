const mongoose = require("mongoose");
const { Schema } = mongoose;

const wishlistSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User", // Corrected to match 'User' model (case-sensitive)
        required: true
    },
    products: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product', // Matches 'Product' model
            required: true
        },
        addedOn: {
            type: Date,
            default: Date.now
        }
    }]
});

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;