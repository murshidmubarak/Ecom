const express = require('express');

const router = express.Router();
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/costomerController")
const categoryController = require("../controllers/admin/categoryController")
const {userAuth,adminAuth} = require("../middlewares/auth");
const Product = require('../models/productSchema');
const ProductController = require("../controllers/admin/productController");
const upload = require("../middlewares/multer");
const orderController = require("../controllers/admin/orderController")
//const { route } = require('./userRouter');




router.get("/login",adminController.loadLogin);
router.post('/login',adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard);
router.get("/pageerror",adminController.pageerror)
router.get("/logout",adminController.logout)

router.get("/users",adminAuth,customerController.costomerInfo)
router.post("/users/:id/block", adminAuth, customerController.toggleBlockUser);

router.get("/categories",adminAuth,categoryController.categorInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.post('/searchCategory',adminAuth,categoryController.searchCategory);
router.post('/addCategryOffer',adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
router.get("/listCategory", adminAuth, categoryController.getListedCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistedCategory);
router.get("/admin/category", adminAuth, categoryController.getCategoryPage);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

router.get("/addProducts",adminAuth,ProductController.getProductAddPage)
router.post("/addProducts",adminAuth,upload.array("images",4),ProductController.addProducts)
router.get("/products",adminAuth,ProductController.getAllProducts)
router.get("/blockProduct",adminAuth,ProductController.blockProduct);
router.get("/unblockProduct",adminAuth,ProductController.unblockProduct);
 router.get("/editProduct",adminAuth,ProductController.getEditProduct);
router.post("/editProduct/:id",adminAuth,upload.array("images",4),ProductController.editProduct);
router.post("/deleteImage",adminAuth,ProductController.deleteSingleImage); 


router.get("/order-list", adminAuth, orderController.getOrderListPageAdmin);
router.get("/orderDetailsAdmin", adminAuth, orderController.getOrderDetailsPageAdmin);
router.get("/changeStatus", adminAuth, orderController.changeOrderStatus);
router.post('/approveReturnRequest',adminAuth,orderController.approveReturnRequest);











module.exports = router