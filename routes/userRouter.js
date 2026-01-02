const express = require("express");
const router = express.Router();
const { checkUserBlocked, userAuth, isLogin } = require("../middlewares/auth");
const { ownsOrder, ownsAddress } = require("../middlewares/ownership");
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
    // passport.authenticate('google', { failureRedirection: '/' }),
    passport.authenticate('google', { failureRedirect: '/' }),

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
router.get("/userProfile", userAuth,  profileController.userProfile);

router.get('/change-email',userAuth,profileController.changeEmailGet)//display change email page
router.post('/change-email',userAuth,profileController.changeEmail);//after submitting new email and sending otp
router.get('/verifyEmailOtp',userAuth,profileController.verifyEmailOtpGet)//display verify email otp page
router.post('/verifyEmailOtp',userAuth,profileController.verifyEmailOtp);//verify email otp and change email

router.post("/resend-pass-otp", userAuth,  profileController.resendPassOtp);//resend pass otp
router.post("/changeEmailOtp", userAuth,  profileController.changeEmailOtp);//resend email otp

router.post("/verifyEmailPassOtp", userAuth,  profileController.verifyEmailPassOtp);//verify password otp
router.get("/passChangeOtp", userAuth,  profileController.passChangeOtp);//display password otp page
router.get("/change-password", userAuth,  profileController.changePassword);//display change password page
router.post("/change-password", userAuth,  profileController.changePasswordValid);//checking old password
router.get("/addnewPass", userAuth,  profileController.changepassGet);//display add new password page
router.post("/addnewPass", userAuth,  profileController.changepassPost);//adding new password
router.post("/send-reset-otp", userAuth,  profileController.sendOtpforReset);//sending otp for password reset

router.post("/uploadProfilePhoto", userAuth,  upload.single('profilePhoto'), profileController.uploadProfilePhoto);
router.post("/removeProfilePhoto", userAuth,  profileController.removeProfilePhoto);

// Address Management Routes
router.get("/addAddress", userAuth, profileController.addAddress);
router.post("/addAddress", userAuth, profileController.postAddAddress);
router.get("/editAddress", userAuth, ownsAddress, profileController.editAddress);
router.post("/editAddress", userAuth, ownsAddress, profileController.postEditAddress);
router.get("/deleteAddress", userAuth, ownsAddress, profileController.deleteAddress);

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
router.get("/orderDetails", userAuth, ownsOrder, orderController.getOrderDetailsPage);
router.post("/cancelOrder", userAuth, ownsOrder, orderController.cancelOrder);
router.post("/cancelSingleProduct", userAuth,ownsOrder, orderController.cancelSingleProduct);
router.post("/returnSingleProduct", userAuth,ownsOrder, orderController.returnSingleProduct);
router.post("/returnrequestOrder", userAuth,ownsOrder, orderController.returnorder);
router.get("/downloadInvoice/:orderId", userAuth,ownsOrder, orderController.downloadInvoice);
router.post("/deleteItem", userAuth, cartController.deleteProduct);

module.exports = router;