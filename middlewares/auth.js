const User = require("../models/userSchema");

const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then((data) => {
                if (data && !data.isBlocked) {
                    next();
                } else {
                    res.redirect("/login");
                }
            }) // The `.catch()` should be outside the `.then()` block
            .catch((error) => {
                console.log("Error in user auth middleware:", error);
                res.status(500).send("Internal server error");
            });
    } else {
        res.redirect("/login"); // Added this for cases where `req.session.user` is undefined
    }
};

const adminAuth = (req,res,next)=>{
    if(req.session.admin) next()
    else res.redirect('/admin/login')
}


module.exports ={
    userAuth,adminAuth
}