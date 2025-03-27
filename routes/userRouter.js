const express = require("express");
const {checkUserBlocked ,userAuth,adminAuth} = require("../middlewares/auth");
const router = express.Router();
const userController = require("../controllers/user/userController")
const passport = require('passport')
const profileController = require("../controllers/user/profileController")



router.get("/pageNotFound",userController.pageNotFound);
router.get('/signup',userController.loadsignup);
router.get("/",checkUserBlocked,userController.loadHomepage);
router.post('/signup',userController.signup);
router.get("/verify-otp",userController.getotp);
router.post("/verify-otp",userController.verifyOtp);
router.get("/home",checkUserBlocked ,userController.loadHomepage);
router.post("/resend-otp",userController.resendOtp)
router.get('/login',userController.loadLogin);
router.post("/login",userController.login);
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




module.exports = router;