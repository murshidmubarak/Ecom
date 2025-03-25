const mongoose = require("mongoose");
const {Schema}= mongoose;
const {v4:uuidv4} = require('uuid');

const orderSchema = new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderedItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            requred:true
        },
        price:{
            type:Number,
           default:0 
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:Schema.Types.ObjectId,
        ref:"User",
        rquird:true
    },
    invoceDate:{
        type:Date,

    },
    status:{
        type:String,
        required:true,
        enum:['pending','processing','shipped','Delivered','cancelled','return request','returned'],


    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    coiponApplied:{
        type:Boolean,
        default:false
    }

})

const Order = mongoose.model("Order",orderSchema);
moule.exports = Order;