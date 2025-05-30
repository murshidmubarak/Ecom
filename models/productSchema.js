const mongoose = require("mongoose");
const {Schema}= mongoose;

const productSchema = new Schema ({
    productName:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    brand:{
        type:String,
        required:false,
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    salePrice:{
        type:Number,
        required:true,
    },
    productImage:{
        type:[String],
        required:true
     },
    productOffer:{
        type: Number, // Changed from String to Number
        default: 0,
        min: 0,
        max: 100
    },
    quantity:{
        type:String,
        default:true
    },
    color:{
        type:String,
        required:true
    },
  
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Availabe","out of stock","Discontinued"],
        required:true,
        default:"Availabe"
    }
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;