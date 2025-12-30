const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongoose = require('mongoose');
const Wallet = require("../../models/walletSchema");
const moment = require('moment');
const { profileUpload } = require('../../middlewares/multer'); // Import profileUpload
const sharp = require('sharp'); // Import sharp for image processing
const path = require('path');
const fs = require('fs').promises;


function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
       
        throw error;
    }
};

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.VERIFY_EMAIL,
                pass: process.env.VERIFY_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.VERIFY_EMAIL,
            to: email,
            subject: 'Your OTP for Sign-up verification',
            text: `Your OTP is ${otp}`,
        });

        console.log(`Your otp is ${otp}`);
        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error.message);
        return false;
    }
}

const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password");
    } catch (error) {
       
        res.redirect("/pageNotFound");
    }
};


const forgotEmailValid = async (req, res) => {
  try {
    const email = req.body.email;
    const findUser = await User.findOne({ email: email });

    if (!findUser) {
      // Show error message in same page using SweetAlert
      return res.render("forgot-password", {
        message: "Email not found",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.email = email;
      console.log("Email sent successfully", otp);
      return res.render("forgotPass-otp");
    } else {
      return res.render("forgot-password", {
        message: "Failed to send OTP. Please try again.",
      });
    }
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enterOtp = req.body.otp;
        if (req.session.userOtp === enterOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getResetPassPage = async (req, res) => {
    try {
        res.render("reset-password", { csrfToken: req.csrfToken() });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resend otp", otp);
            res.status(200).json({ success: true, message: 'resend otp successful' });
        }
    } catch (error) {
        
        res.status(500).json({ success: false, message: 'server error' });
    }
};

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );
            res.redirect("/login");
        } else {
            res.render("reset-password", { message: 'password not match' });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
        
    }
};



const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.redirect('/login');
    }

    // Pagination parameters
    const ordersPage = parseInt(req.query.ordersPage) || 1;
    const walletPage = parseInt(req.query.walletPage) || 1;
    const limit = 3;
    const activeTab = req.query.tab || 'dashboard';

    // Fetch user data
    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect('/login');
    }

    // Fetch paginated orders
    const ordersCount = await Order.countDocuments({ userId });
    const orders = await Order.find({ userId })
      .populate('orderedItems.product')
      .sort({ createdOn: -1 })
      .skip((ordersPage - 1) * limit)
      .limit(limit);

    // Fetch paginated wallet transactions
    const wallet = await Wallet.findOne({ userId });
    let walletTransactions = [];
    let walletCount = 0;
    if (wallet && wallet.transactions) {
      // Sort transactions by transactionDate in descending order
      walletTransactions = wallet.transactions
        .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)) // Newest first
        .slice((walletPage - 1) * limit, walletPage * limit)
        .map(transaction => ({
          ...transaction._doc,
          transactionId: transaction.transactionId || 'N/A',
          transactionDate: transaction.transactionDate || new Date(),
          type: transaction.type || 'Unknown',
          description: transaction.description || 'No description',
          amount: transaction.amount || 0,
          balanceAfter: transaction.balanceAfter || 0,
          status: transaction.status || 'Unknown',
        }));
      walletCount = wallet.transactions.length;
    }

    const walletBalance = userData.wallet || 0;

    // Calculate pagination metadata
    const ordersTotalPages = Math.ceil(ordersCount / limit);
    const walletTotalPages = Math.ceil(walletCount / limit);

    const csrfToken = req.csrfToken();

    res.render('profile', {
      csrfToken,
      user: userData,
      userAddress: (await Address.findOne({ userId })) || { address: [] },
      orders: orders || [],
      wallet,
      walletBalance,
      walletTransactions: walletTransactions || [],
      moment,
      ordersPage,
      walletPage,
      ordersTotalPages,
      walletTotalPages,
      limit,
      activeTab,
      profilePhoto: userData.profilePhoto, // Pass profile photo to view
    });
  } catch (error) {
    console.error("Error in userProfile:", error);
    res.redirect('/page404');
  }
};


const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.query.id;
        const order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');
        if (!order) {
            return res.redirect('/page404');
        }
        res.render('orderDetails', { order, user: await User.findById(userId) });
    } catch (error) {
       
        res.redirect('/page404');
    }
};

const passChangeOtp = async (req, res) => {
    try {
        console.log("Rendering passChangeOtp page");
        res.render("passChangeOtp", { csrfToken: req.csrfToken() });
        
    } catch (error) {
        console.error("Error in passChangeOtp:", error);
        res.redirect('page404');
        
    }
}

const verifyEmailPassOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required"
      });
    }

    // ✅ FIX: use same key as sendOtpforReset
    const sessionOtp = req.session.resetOtp;

    if (!sessionOtp) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not generated. Please resend OTP."
      });
    }

    // expiry check
    if (Date.now() > sessionOtp.expiresAt) {
      delete req.session.resetOtp;

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one."
      });
    }

    // OTP match check
    if (String(otp) !== String(sessionOtp.code)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    // ✅ OTP verified successfully
    delete req.session.resetOtp;

    // allow password reset
    req.session.passOtpVerified = true;

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
        redirectUrl: "/addnewPass"
    });

  } catch (error) {
    console.error("Error in verifyEmailPassOtp:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

const resendOtpemailPass = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(user.email, otp);
        if (emailSent) {
            req.session.resetOtp ={
                code: otp,
                expiresAt: Date.now() + 1 * 60 * 1000 // 1 minute from now
            };
            return res.status(200).json({ success: true, message: "OTP sent successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
        
    }
}


const changePassword = async (req, res) => {
    try {
  

        res.render("change-password", { 
            csrfToken: req.csrfToken ? req.csrfToken() : "dummy-token-for-testing"
        });

    } catch (error) {

        res.redirect('page404');
    }
};


const changePasswordValid = async (req, res) => {
    try {
        const { currentPassword } = req.body;

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "User not logged in"
            });
        }

        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        req.session.canChangePassword = true;

        return res.status(200).json({
            success: true,
            message: "Password verified successfully",
            redirectUrl: "/addnewPass"
        });

    } catch (error) {
        console.error("changePasswordValid error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const changepassGet = async (req, res) => {
    try {
        if (!req.session.canChangePassword && !req.session.passOtpVerified) {
            return res.redirect("/change-password");
        }

        res.render("addnewPass");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const changepassPost = async (req, res) => {
    try {
        if (!req.session.canChangePassword && !req.session.passOtpVerified) {
            return res.status(403).json({
            success: false,
             message: "Unauthorized password change"
           });
        }

        const { newPassword, confirmNewPassword } = req.body;
        console.log("Received newPassword:", newPassword);
        console.log("Received confirmNewPassword:", confirmNewPassword);

        if (!newPassword || !confirmNewPassword) {
            return res.status(400).json({
                success: false,
                message: "Both password fields are required"
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({
                success: false,
                message: "New passwords do not match"
            });
        }
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in"
            });
        }
        const hashedPassword = await securePassword(newPassword);
        await User.findByIdAndUpdate(userId, { password: hashedPassword });
        req.session.canChangePassword = false; // Clear the flag after password change

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });

    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const sendOtpforReset = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(user.email, otp);
        if (emailSent) {
            req.session.resetOtp ={
                code: otp,
                expiresAt: Date.now() + 1 * 60 * 1000 // 1 minute from now
            };
            return res.status(200).json({ success: true, message: "OTP sent successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const addAddress = async (req, res) => {
    try {
        const user = req.session.user;
        const redirectPage = req.query.redirect || 'profile'; // Default fallback
        res.render("add-address", {
            user: user,
            csrfToken: req.csrfToken(),
            redirectPage: redirectPage // Always send
        });
    } catch (error) {
        console.error("Error in GET /addAddress:", error);
        res.redirect('page404');
    }
};


const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });

        const { addressType, name, city, landMark, state, pincode, phone, altPhone, redirect } = req.body;
        const redirectPage = redirect; // ✅ define redirectPage

        const userAddress = await Address.findOne({ userId: userData._id });

        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }

        // ✅ Use defined redirectPage
        res.redirect(redirectPage === 'checkout' ? '/checkout' : '/userProfile');
    } catch (error) {
        
        res.redirect('page404');
    }
};

const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currentAddress = await Address.findOne({"address._id": addressId}); 
        const redirectPage = req.query.redirect || 'profile';

        if (!currentAddress) {
            return res.redirect('/page404');
        }
        const addressData = currentAddress.address.find((item)=>{
            return item._id.toString() === addressId;
        });

        if (!addressData) {
            return res.redirect('/page404');
        }

        res.render("edit-address", {
            user: user,
            address: addressData,
            csrfToken: req.csrfToken(),
             redirectPage
        });
    } catch (error) {
        console.error("error in edit address render", error);
        res.redirect('page404');
    }
};

const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ "address._id": addressId });
        const redirectPage = req.body.redirect;
        if (!findAddress) {
            return res.redirect('/page404');
        }

        await Address.updateOne(
            { "address._id": addressId },
            {$set:{
                "address.$":{
                    id: addressId,
                    addressType: data.addressType,
                    name: data.name,
                    city: data.city,
                    landMark: data.landMark,
                    state: data.state,
                    pincode: data.pincode,
                    phone: data.phone,
                    altPhone: data.altPhone
                }
            }}
        );

         return res.redirect(redirectPage === 'checkout' ? '/checkout' : '/userProfile');
    } catch (error) {
        
        res.redirect('page404');
    }
};


const deleteAddress = async (req, res) => {
    try {
        const addressId = req.body.id || req.query.id; // Check both body and query
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send("address not found");
        }
       
        await Address.updateOne(
            { "address._id": addressId },
            { $pull: { address: { _id: addressId } } }
        );

        res.redirect("/userProfile");
    } catch (error) {
        
        res.redirect('page404');
    }
};

const uploadProfilePhoto = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.redirect('/login');
        }

        if (!req.file) {
            return res.redirect('/userProfile?tab=dashboard&error=No file uploaded');
        }

        const inputPath = req.file.path;
        const filename = req.file.filename;
        const outputPath = path.join('public/uploads/profiles', `cropped-${filename}`);
        const profilePhotoPath = `/uploads/profiles/cropped-${filename}`;

        // Crop and resize the image to a 300x300 square using sharp
        await sharp(inputPath)
            .resize(300, 300, {
                fit: 'cover', // Crop to cover the entire area
                position: 'center' // Center the crop
            })
            .toFile(outputPath);

        // Delete the original uploaded file
        await fs.unlink(inputPath);

        // Update user's profile photo in the database
        const user = await User.findByIdAndUpdate(
            userId,
            { profilePhoto: profilePhotoPath },
            { new: true }
        );

        if (!user) {
            return res.redirect('/userProfile?tab=dashboard&error=User not found');
        }

        res.redirect('/userProfile?tab=dashboard');
    } catch (error) {
        
        res.redirect('/userProfile?tab=dashboard&error=Failed to upload photo');
    }
};

const removeProfilePhoto = async (req, res) => {
    try {
        const userId = req.session.user;
       
        await User.findByIdAndUpdate(userId, { profilePhoto: null });
        res.redirect('/userProfile?tab=dashboard');
    } catch (error) {
       
        res.redirect('/userProfile?tab=dashboard&error=Failed to remove photo');
    }
};

module.exports = {
    getForgotPassPage, forgotEmailValid, verifyForgotPassOtp, getResetPassPage, resendOtp, postNewPassword, userProfile, changePassword,
    addAddress, postAddAddress, getOrderDetails, editAddress, postEditAddress, deleteAddress, uploadProfilePhoto, removeProfilePhoto,
     changePasswordValid,changepassGet,changepassPost, sendOtpforReset, passChangeOtp, verifyEmailPassOtp, resendOtpemailPass
};