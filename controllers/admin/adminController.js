const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt  = require ("bcrypt");
const { loadsignup } = require("../user/userController");


const pageerror = (req,res)=>{
    res.render("pageerror",{
              errorCode: 404,
              errorMessage: "Page Not Found"
    })
}  

/* const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard");
    }
    res.render("admin-login", { errorMessage: null }); 

   
}
 */
/* const login = async(req,res)=>{
    try {
        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true});
        console.log(admin);
        
        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin = true;
                return res.redirect("/admin")
            }else{
               return res.redirect("/login");
            }
        }
    } catch (error) {
        console.log("login error");
        return res.redirect("/pageerror");
        
    }
} */


 const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    res.render("admin-login", { 
        errorMessage: null,
        csrfToken: req.csrfToken() // Added: Pass CSRF token to admin-login.ejs
    });
};

const login = async (req, res) => {
    try {
        const { email, password, _csrf } = req.body; // Changed: Added _csrf to destructured body
        console.log("Admin login - Received:", { email, _csrf });

        if (!email || !password || !_csrf) { // Changed: Added _csrf check
            return res.render("admin-login", { 
                errorMessage: "Missing required fields ",
                csrfToken: req.csrfToken() // Added: Pass CSRF token on error
            });
        }

        const admin = await User.findOne({ email, isAdmin: true });
        console.log("Admin login - Found admin:", admin);

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin/salesReport");
            } else {
                return res.render("admin-login", { 
                    errorMessage: "Incorrect password",
                    csrfToken: req.csrfToken() // Added: Pass CSRF token on error
                });
            }
        } else {
            return res.render("admin-login", { 
                errorMessage: "Admin not found",
                csrfToken: req.csrfToken() // Added: Pass CSRF token on error
            });
        }
    } catch (error) {
        console.error("Admin login error:", error);
        // Added: Handle CSRF-specific errors
        if (error.code === 'EBADCSRFTOKEN') {
            return res.render("admin-login", { 
                errorMessage: "Invalid CSRF token. Please try again.",
                csrfToken: req.csrfToken() // Added: Pass new CSRF token
            });
        }
        return res.render("admin-login", { 
            errorMessage: "An error occurred. Please try again.",
            csrfToken: req.csrfToken() // Added: Pass CSRF token on error
        });
    }
};
    
const loadDashboard = async (req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard");
        } catch (error) {
            res.redirect("/pageerror");
        }
    }
}

const logout =async (req,res)=>{
     try {
        req.session.admin=false
        res.redirect('/admin/login')
     } catch (error) {

        console.log("unexpected error");
        res.redirect("/pageerror")
        
        
     }
}




module.exports ={
    loadLogin,login,loadDashboard,pageerror,logout
}