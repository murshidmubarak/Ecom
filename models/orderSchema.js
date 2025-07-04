

/* const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
   orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    }, 
 
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        productStatus: {
            type: String,
            enum: ['confirmed', 'pending', 'shipped', 'delivered', 'cancelled', 'returned'],
            default: 'confirmed'
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Object,
        required: true
    },
    invoiceDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return request', 'returned', 'confirmed'],
        default: 'pending'
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: [String], 
        default: []
      },
    payment: {
        type: String,
        enum: ['cod', 'online'],
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
});

// Prevent model overwrite
module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema); */

// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const orderSchema = new Schema({
//   orderId: {
//     type: String,
//     required: true,
//     unique: true
//   }, 
//   orderedItems: [{
//     product: {
//       type: Schema.Types.ObjectId,
//       ref: "Product",
//       required: true
//     },
//     quantity: {
//       type: Number,
//       required: true
//     },
//     price: {
//       type: Number,
//       default: 0
//     },
//     productStatus: {
//       type: String,
//       enum: ['confirmed', 'pending', 'shipped', 'delivered', 'cancelled', 'returned'],
//       default: 'confirmed'
//     }
//   }],
//   totalPrice: {
//     type: Number,
//     required: true
//   },
//   discount: {
//     type: Number,
//     default: 0
//   },
//   finalAmount: {
//     type: Number,
//     required: true
//   },
//   address: {
//     type: Object,
//     required: true
//   },
//   invoiceDate: {
//     type: Date,
//     default: Date.now
//   },
//   status: {
//     type: String,
//     required: true,
//     enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return request', 'returned', 'confirmed', 'failed'],
//     default: 'pending'
//   },
//   createdOn: {
//     type: Date,
//     default: Date.now,
//     required: true
//   },
//   couponApplied: {
//     type: [String], 
//     default: []
//   },
//   payment: {
//     type: String,
//     enum: ['cod', 'online'],
//     required: true
//   },
//   userId: {
//     type: Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   }
// });

// // Prevent model overwrite
// module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);




// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const orderSchema = new Schema({
//   orderId: {
//     type: String,
//     required: true,
//     unique: true
//   }, 
//   orderedItems: [{
//     product: {
//       type: Schema.Types.ObjectId,
//       ref: "Product",
//       required: true
//     },
//     quantity: {
//       type: Number,
//       required: true
//     },
//     price: {
//       type: Number,
//       default: 0
//     },
//     productStatus: {
//       type: String,
//       enum: ['confirmed', 'pending', 'shipped', 'delivered', 'cancelled', 'returned', 'return-requested', 'return-rejected'],
//       default: 'confirmed'
//     }
//   }],
//   totalPrice: {
//     type: Number,
//     required: true
//   },
//   discount: {
//     type: Number,
//     default: 0
//   },
//   finalAmount: {
//     type: Number,
//     required: true
//   },
//   address: {
//     type: Object,
//     required: true
//   },
//   invoiceDate: {
//     type: Date,
//     default: Date.now
//   },
//   status: {
//     type: String,
//     required: true,
//     enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return-requested', 'returned', 'confirmed', 'failed'],
//     default: 'pending'
//   },
//   createdOn: {
//     type: Date,
//     default: Date.now,
//     required: true
//   },
//   couponApplied: {
//     type: [String], 
//     default: []
//   },
//   payment: {
//     type: String,
//     enum: ['cod', 'online', 'wallet', 'failed'],
//     required: true
//   },
//   userId: {
//     type: Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   }
// });

// // Prevent model overwrite
// module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);



const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  }, 
  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      default: 0
    },
    productStatus: {
      type: String,
      enum: ['confirmed', 'pending', 'shipped', 'delivered', 'cancelled', 'returned', 'return-requested', 'return-rejected'],
      default: 'confirmed'
    },
    returnReason: {
      type: String,
      default: ''
    }
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: Object,
    required: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return-requested', 'returned', 'confirmed', 'failed'],
    default: 'pending'
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: [String], 
    default: []
  },
  payment: {
    type: String,
    enum: ['cod', 'online', 'wallet', 'failed'],
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

// Prevent model overwrite
module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);