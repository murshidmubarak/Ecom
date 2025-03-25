const mongoose = require("mongoose");
const {Schema}= mongoose;

const cartSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"user",
        required:true

    },
    items:[{
        productId:{
         tye:Schema.Types.ObjectId,
         ref:"Product",
         required:true
        },
         quanitity:{
            type:Number,
            default:1
         },
         price:{
            type:Number,
            requied:true
         },
         totalPrice:{
            type:Number,
            required:true
         },
         status:{
            type:String,
            default:"placed"
         },
         cancellationReason:{
            type:String,
            default:"none"
         }
    }]
})


const Cart = mongoose.model("Cart",cartSchema);
module.exports = Cart