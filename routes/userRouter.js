// const express = require("express");
// const { checkUserBlocked, userAuth, isLogin } = require("../middlewares/auth");
// const router = express.Router();
// const userController = require("../controllers/user/userController");
// const passport = require('passport');
// const profileController = require("../controllers/user/profileController");
// const cartController = require("../controllers/user/cartController");
// const orderController = require("../controllers/user/orderController");
// const upload = require("../middlewares/multer"); // Updated import

// router.get("/pageNotFound", userController.pageNotFound);
// router.get('/signup', userController.loadsignup);
// router.get("/", checkUserBlocked, userController.loadHomepage);
// router.post('/signup', userController.signup);
// router.get("/verify-otp", userController.getotp);
// router.post("/verify-otp", userController.verifyOtp);
// router.get("/home", checkUserBlocked, userController.loadHomepage);
// router.post("/resend-otp", userController.resendOtp);
// router.get('/login', isLogin, userController.loadLogin);
// router.post("/login", isLogin, userController.login);
// router.get("/logout", userController.logout);

// router.get('/auth/google', 
//     passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// router.get('/auth/google/callback',
//     passport.authenticate('google', { failureRedirect: '/' }),
//     (req, res) => {
//         req.session.admin = true;
//         console.log('aaaaaaaaabbbbbbbbbbbbbbbaaaaaa:', req.session.admin);
//         req.session.user = req.user._id;
//         res.redirect('/home');
//     }
// );

// router.get('/shop', checkUserBlocked, userController.loadShop);
// router.get('/productDetails', checkUserBlocked, userController.getProductDetails);

// router.get('/forgot-password', profileController.getForgotPassPage);
// router.post('/forgot-email-valid', profileController.forgotEmailValid);
// router.post('/verify-passForgotOtp', profileController.verifyForgotPassOtp);
// router.get('/reset-password', profileController.getResetPassPage);
// router.post('/resend-forgot-otp', profileController.resendOtp);
// router.post("/reset-password", profileController.postNewPassword);

// router.get("/userProfile", profileController.userProfile);
// router.get("/change-email", profileController.changeEmail);
// router.post("/change-email", profileController.changeEmailValid);
// router.post("/verify-email-otp", profileController.veriyfyEmailOtp);
// router.post("/update-email", profileController.updateEmail);
// router.get("/change-password", profileController.changePassword);
// router.post("/change-password", profileController.changePasswordValid);
// router.post("/verify-changepassword-otp", profileController.verrifyChangePassOtp);

// router.get("/cart", checkUserBlocked, cartController.getCartPage);
// router.post("/addToCart", cartController.addToCart);
// router.post("/changeQuantity", userAuth, cartController.changeQuantity);
// router.get("/deleteItem", userAuth, cartController.deleteProduct);

// router.get("/wishlist", userAuth, cartController.loadWishList);
// router.post("/addToWishlist", userAuth, cartController.addTowishlist);
// router.post('/removeFromWishlist', cartController.removeFromWishlist);

// router.get("/checkout", userAuth, orderController.getCheckoutPage);
// router.get("/deleteItem", userAuth, orderController.deleteProduct);
// router.post("/orderPlaced", userAuth, orderController.orderPlaced);
// router.get("/orderDetails", userAuth, orderController.getOrderDetailsPage);
// router.post("/cancelOrder", userAuth, orderController.cancelOrder);
// router.post("/returnrequestOrder", userAuth, orderController.returnorder);
// router.post("/singleProductId", userAuth, orderController.changeSingleProductStatus);
// router.get("/downloadInvoice/:orderId", userAuth, orderController.downloadInvoice);
// router.post("/cancelSingleProduct", userAuth, orderController.cancelSingleProduct);
// router.post("/returnSingleProduct", userAuth, orderController.returnSingleProduct);
// router.post('/verifyPayment', userAuth, orderController.verifyPayment);
// router.post("/applyCoupon", userAuth, orderController.applyCoupon);
// router.post("/clearCart", userAuth, orderController.clearCart);
// router.post("/changeStatus", userAuth, orderController.changeOrderStatus);


// router.get("/addAddress", userAuth, profileController.addAddress);
// router.post("/addAddress", userAuth, profileController.postAddAddress);
// router.get("/editAddress", userAuth, profileController.editAddress);
// router.post("/editAddress", userAuth, profileController.postEditAddress);
// router.get("/deleteAddress", userAuth, profileController.deleteAddress);
// router.get("/paymentFailed", userAuth, orderController.paymentFailed);

// router.post("/uploadProfilePhoto", userAuth, upload.single('profilePhoto'), profileController.uploadProfilePhoto);
// router.post("/removeProfilePhoto", userAuth, profileController.removeProfilePhoto);



// module.exports = router;

const express = require("express");
const router = express.Router();
const { checkUserBlocked, userAuth, isLogin } = require("../middlewares/auth");
const userController = require("../controllers/user/userController");
const passport = require('passport');
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderController");
const upload = require("../middlewares/multer"); // Multer middleware for file uploads

// Page Not Found
router.get("/pageNotFound", userController.pageNotFound);

// User Authentication Routes
router.get('/signup', userController.loadsignup);
router.post('/signup', userController.signup);
router.get("/verify-otp", userController.getotp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get('/login', isLogin, userController.loadLogin);
router.post("/login", isLogin, userController.login);
router.get("/logout", userController.logout);

// Google Authentication Routes
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirection: '/' }),
    (req, res) => {
        console.log('=== Google Callback Debug ===');
        console.log('User from passport:', req.user);
        console.log('Session before setting user:', req.session);
        
        if (!req.user) {
            console.log('No user found after authentication');
            return res.redirect('/?error=auth_failed');
        }
        
        req.session.user = req.user._id;
        
        // Force session save
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
            } else {
                console.log('Session saved successfully');
            }
            console.log('Final session:', req.session);
            res.redirect('/');
        });
    }
);
// Homepage and Shop Routes
router.get("/", checkUserBlocked, userController.loadHomepage);
// router.get("/home", checkUserBlocked, userController.loadHomepage);
router.get('/shop', checkUserBlocked, userController.loadShop);
router.get('/productDetails', checkUserBlocked, userController.getProductDetails);

// Password Reset Routes
router.get('/forgot-password', profileController.getForgotPassPage);
router.post('/forgot-email-valid', profileController.forgotEmailValid);
router.post('/verify-passForgotOtp', profileController.verifyForgotPassOtp);
router.get('/reset-password', profileController.getResetPassPage);
router.post('/resend-forgot-otp', profileController.resendOtp);
router.post("/reset-password", profileController.postNewPassword);

// User Profile Routes
router.get("/userProfile", userAuth, profileController.userProfile);
router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/change-email", userAuth, profileController.changeEmailValid);
router.post("/verify-email-otp", userAuth, profileController.veriyfyEmailOtp);
router.post("/update-email", userAuth, profileController.updateEmail);
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid);
router.post("/verify-changepassword-otp", userAuth, profileController.verrifyChangePassOtp);
router.post("/uploadProfilePhoto", userAuth, upload.single('profilePhoto'), profileController.uploadProfilePhoto);
router.post("/removeProfilePhoto", userAuth, profileController.removeProfilePhoto);

// Address Management Routes
router.get("/addAddress", userAuth, profileController.addAddress);
router.post("/addAddress", userAuth, profileController.postAddAddress);
router.get("/editAddress", userAuth, profileController.editAddress);
router.post("/editAddress", userAuth, profileController.postEditAddress);
router.get("/deleteAddress", userAuth, profileController.deleteAddress);

// Cart Routes
router.get("/cart", checkUserBlocked, cartController.getCartPage);
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/changeQuantity", userAuth, cartController.changeQuantity);
router.get("/deleteItem", userAuth, cartController.deleteProduct); // Updated to use cartController

// Wishlist Routes
router.get("/wishlist", userAuth, cartController.loadWishList);
router.post("/addToWishlist", userAuth, cartController.addTowishlist);
router.post('/removeFromWishlist', userAuth, cartController.removeFromWishlist);

// Order and Checkout Routes
router.get("/checkout", userAuth, orderController.getCheckoutPage);
router.post("/orderPlaced", userAuth, orderController.orderPlaced);
router.post('/verifyPayment', userAuth, orderController.verifyPayment);
router.get("/paymentFailed", userAuth, orderController.paymentFailed);
router.get("/retryPayment", userAuth, orderController.retryPayment);
router.post("/applyCoupon", userAuth, orderController.applyCoupon);
router.post("/clearCart", userAuth, orderController.clearCart);
router.post("/changeOrderStatus", userAuth, orderController.changeOrderStatus); 
router.get("/orderDetails", userAuth, orderController.getOrderDetailsPage);
router.post("/cancelOrder", userAuth, orderController.cancelOrder);
router.post("/cancelSingleProduct", userAuth, orderController.cancelSingleProduct);
router.post("/returnSingleProduct", userAuth, orderController.returnSingleProduct);
router.post("/returnrequestOrder", userAuth, orderController.returnorder);
router.get("/downloadInvoice/:orderId", userAuth, orderController.downloadInvoice);

module.exports = router;