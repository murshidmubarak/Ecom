const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");




function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
};



async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.VERIFY_EMAIL, // Ensure this is set in .env
                pass: process.env.VERIFY_PASSWORD // Ensure this is correct
            }
        });

        const info = await transporter.sendMail({
            from: process.env.VERIFY_EMAIL,
            to: email,
            subject: 'Your OTP for Sign-up verification',
            text: `Your OTP is ${otp}`,
        });

        console.log('hii')
        console.log(`Your otp is ${otp}`)
        return info.accepted.length > 0;
        
    } catch (error) {
        console.error("Error sending email:", error.message);
        return false;
    }

}

const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password");
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
}

const forgotEmailValid = async (req, res) => {
    try {
        const email = req.body.email; // Extract the email string from req.body
        const findUser = await User.findOne({ email: email });
        if (findUser) {
            const otp = generateOtp(); // Fixed typo: generateOTP() -> generateOtp()
            const emailSent = await sendVerificationEmail(email, otp); // Fixed typo: sendVarificationEmail -> sendVerificationEmail
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("Email sent successfully", otp);
            } else {
                res.json({ success: false, message: "Error sending OTP" });
            }
        } else {
            res.render("forgot-password", { message: "Email not found" });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
        console.log(error);
    }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        
        const enterOtp = req.body.otp;
        if (req.session.userOtp === enterOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" });

        }else{
            res.json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {

        res.status(500).json({ success: false, message: "Internal server error" });
        
    }
}

const getResetPassPage = async (req, res) => {
    try {
        res.render("reset-password");
    } catch (error) {

        res.redirect("/pageNotFound");

        
    }
}

const resendOtp = async(req,res)=>{
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log('resending otp');
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("resend otp",otp);
            res.status(200).json({success:true,message:'resend otp successfull'})
            
        }
        
    } catch (error) {

        console.error('error in resend otp',error);
        res.status(500).json({success:false,message:'server error'})
        
    }
}


const postNewPassword = async(req,res)=>{
    try {
        const{newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )

            res.redirect("/login")
        }else{
            res.render("reset-password",{message:'password not match'})
        }
    } catch (error) {

        res.redirect('/pageNotFound');
        console.log('error occured',error)
        
    }
}




module.exports = {
    getForgotPassPage,forgotEmailValid,verifyForgotPassOtp,getResetPassPage,resendOtp,postNewPassword
}
    
