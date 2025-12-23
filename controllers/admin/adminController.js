const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt  = require ("bcrypt");
// const { loadsignup } = require("../user/userController");


const pageerror = (req,res)=>{
    res.render("pageerror",{
              errorCode: 404,
              errorMessage: "Page Not Found"
    })
}  





 const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/salesReport");
    }
    res.render("admin-login", { 
        errorMessage: null,
        csrfToken: req.csrfToken() 
    });
};

const login = async (req, res) => {
    try {
        const { email, password, _csrf } = req.body; 

        if (!email || !password || !_csrf) { 
            return res.render("admin-login", { 
                errorMessage: "Missing required fields ",
                csrfToken: req.csrfToken() ,
                 oldEmail: email || "" 
            });
        }

        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin/salesReport");
            } else {
                return res.render("admin-login", { 
                    errorMessage: "Incorrect password",
                    csrfToken: req.csrfToken() ,
                    oldEmail: email
                });
            }
        } else {
            return res.render("admin-login", { 
                errorMessage: "Admin not found",
                csrfToken: req.csrfToken() ,
                oldEmail: email 
            });
        }
    } catch (error) {
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

        res.redirect("/pageerror")
        
        
     }
}




module.exports ={
    loadLogin,login,loadDashboard,pageerror,logout
}