const mongoose = require("mongoose");
const {Schema}= mongoose;

const brandSchema = new Schema({
    brandName:{
        type:string,
        required:true
    },
    brandImage:{
        type:[string],
        required : true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    cratedAt:{
        type:Date,
        default:Date.now
    }

})

const Brand = mongoose.model("brand",brandSchema);
module.exports = Brand;
