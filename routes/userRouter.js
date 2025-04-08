const express = require("express");
const {checkUserBlocked ,userAuth,isLogin} = require("../middlewares/auth");
const router = express.Router();
const userController = require("../controllers/user/userController")
const passport = require('passport')
const profileController = require("../controllers/user/profileController")
const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderController");





router.get("/pageNotFound",userController.pageNotFound);
router.get('/signup',userController.loadsignup);
router.get("/",checkUserBlocked,userController.loadHomepage);
router.post('/signup',userController.signup);
router.get("/verify-otp",userController.getotp);
router.post("/verify-otp",userController.verifyOtp);
router.get("/home",checkUserBlocked ,userController.loadHomepage);
router.post("/resend-otp",userController.resendOtp)
router.get('/login',isLogin,userController.loadLogin);
router.post("/login",isLogin,userController.login);
router.get("/logout",userController.logout);


router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        req.session.admin=true
        console.log('aaaaaaaaabbbbbbbbbbbbbbbaaaaaa:',req.session.admin)
        req.session.user = req.user._id;
        res.redirect('/home'); // Change this to your desired route
    }
);

router.get('/shop',checkUserBlocked, userController.loadShop);
router.get('/productDetails',checkUserBlocked, userController.getProductDetails );

router.get('/forgot-password', profileController.getForgotPassPage);
router.post('/forgot-email-valid', profileController.forgotEmailValid);
router.post('/verify-passForgotOtp', profileController.verifyForgotPassOtp);
router.get('/reset-password', profileController.getResetPassPage);
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword)

router.get("/userProfile",profileController.userProfile)
router.get("/change-email",profileController.changeEmail)
router.post("/change-email",profileController.changeEmailValid);
router.post("/verify-email-otp",profileController.veriyfyEmailOtp)
router.post("/update-email",profileController.updateEmail)
router.get("/change-password",profileController.changePassword)
router.post("/change-password",profileController.changePasswordValid)
router.post("/verify-changepassword-otp",profileController.verrifyChangePassOtp)


router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity", userAuth,cartController.changeQuantity)
router.get("/deleteItem", userAuth, cartController.deleteProduct)

router.get("/wishlist", userAuth,cartController.loadWishList)
router.post("/addToWishlist", userAuth, cartController.addTowishlist)  
router.post('/removeFromWishlist', cartController.removeFromWishlist); 

router.get("/checkout", userAuth,orderController.getCheckoutPage);
router.get("/deleteItem", userAuth, orderController.deleteProduct);
router.post("/orderPlaced", userAuth,orderController.orderPlaced);
router.get("/orderDetails", userAuth,orderController.getOrderDetailsPage);
router.post("/cancelOrder",userAuth,orderController.cancelOrder);
router.post("/returnrequestOrder",userAuth,orderController.returnorder);
router.post("/singleProductId",userAuth,orderController.changeSingleProductStatus);
router.get("/downloadInvoice/:orderId",userAuth,orderController.downloadInvoice);
router.post("/cancelSingleProduct",userAuth,orderController.cancelSingleProduct);
router.post("/returnSingleProduct",userAuth,orderController.returnSingleProduct)



router.get("/addAddress", userAuth,profileController.addAddress);
router.post("/addAddress", userAuth,profileController.postAddAddress);
router.get("/editAddress", userAuth,profileController.editAddress);
router.post("/editAddress", userAuth,profileController.postEditAddress);
router.get("/deleteAddress", userAuth,profileController.deleteAddress);
 
 
module.exports = router;