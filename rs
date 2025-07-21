[1mdiff --git a/controllers/user/orderController.js b/controllers/user/orderController.js[m
[1mindex 20440ac..ce01148 100644[m
[1m--- a/controllers/user/orderController.js[m
[1m+++ b/controllers/user/orderController.js[m
[36m@@ -201,10 +201,7 @@[m [mconst applyCoupon = async (req, res) => {[m
       return res.status(400).json({ error: "Coupon already used" });[m
     }[m
 [m
[31m-    await User.updateOne([m
[31m-      { _id: userId },[m
[31m-      { $push: { couponApplied: sanitizedCouponCode } }[m
[31m-    );[m
[32m+[m[41m   [m
 [m
     [m
     res.json({[m
[36m@@ -371,6 +368,11 @@[m [mconst orderPlaced = async (req, res) => {[m
         }[m
       }[m
 [m
[32m+[m[32m       await User.updateOne([m
[32m+[m[32m      { _id: userId },[m
[32m+[m[32m      { $push: { couponApplied: sanitizedCouponCode } }[m
[32m+[m[32m    );[m
[32m+[m
       return res.json({[m
         payment: true,[m
         method: paymentMethod,[m
