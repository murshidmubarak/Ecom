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
        console.error("Error hashing password:", error);
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
        console.log(error);
        res.redirect("/pageNotFound");
    }
};

// const forgotEmailValid = async (req, res) => {
//     try {
//         const email = req.body.email;
//         const findUser = await User.findOne({ email: email });
//         if (findUser) {
//             const otp = generateOtp();
//             const emailSent = await sendVerificationEmail(email, otp);
//             if (emailSent) {
//                 req.session.userOtp = otp;
//                 req.session.email = email;
//                 res.render("forgotPass-otp");
//                 console.log("Email sent successfully", otp);
//             } else {
//                 res.json({ success: false, message: "Error sending OTP" });
//             }
//         } else {
//             res.render("forgot-password", { message: "Email not found" });
//         }
//     } catch (error) {
//         res.redirect("/pageNotFound");
//         console.log(error);
//     }
// };

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
        console.log('resending otp');
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resend otp", otp);
            res.status(200).json({ success: true, message: 'resend otp successful' });
        }
    } catch (error) {
        console.error('error in resend otp', error);
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
        console.log('error occurred', error);
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
            walletCount = wallet.transactions.length;
            walletTransactions = wallet.transactions
                .slice((walletPage - 1) * limit, walletPage * limit)
                .map(transaction => ({
                    ...transaction._doc,
                    transactionId: transaction.transactionId || 'N/A',
                    transactionDate: transaction.transactionDate || new Date(),
                    type: transaction.type || 'Unknown',
                    description: transaction.description || 'No description',
                    amount: transaction.amount || 0,
                    balanceAfter: transaction.balanceAfter || 0,
                    status: transaction.status || 'Unknown'
                }));
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
            profilePhoto: userData.profilePhoto // Pass profile photo to view
        });
    } catch (error) {
        console.error('Error rendering profile page:', error);
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
        console.error('Error fetching order details:', error);
        res.redirect('/page404');
    }
};

const changeEmail = async (req, res) => {
    try {
        res.render("change-email");
    } catch (error) {
        console.error("error rendering change email page");
        res.redirect('page404');
    }
};

const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                res.render("change-email-otp");
                console.log("email sent", email);
                console.log("otp", otp);
            } else {
                res.json("email-error");
            }
        } else {
            res.render("change-email", {
                message: "user not exist"
            });
        }
    } catch (error) {
        console.log('error in change valid email');
        res.redirect('page404');
    }
};

const veriyfyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            res.render("new-email", {
                userData: req.session.userData
            });
        } else {
            res.render("change-email-otp", {
                message: "otp not match",
                userData: req.session.userData
            });
        }
    } catch (error) {
        console.log("error verify email otp");
        res.redirect('page404');
    }
};

const updateEmail = async (req, res) => {
    try {
        const newEmail = req.body.newEmail;
        const userId = req.session.user;
        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.redirect("/userProfile");
    } catch (error) {
        console.log("error in update email", error);
        res.redirect('page404');
    }
};

const changePassword = async (req, res) => {
    try {
        res.render("change-password");
    } catch (error) {
        console.log("error in change password render");
        res.redirect('page404');
    }
};

const changePasswordValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                res.render("change-password-otp");
                console.log("email sent", email);
                console.log("otp", otp);
            } else {
                res.json({
                    success: false,
                    message: "failed to send otp try again"
                });
            }
        } else {
            res.render("change-password", {
                message: "user not exist"
            });
        }
    } catch (error) {
        console.log('error in change valid email');
        res.redirect('page404');
    }
};

const verrifyChangePassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            res.json({
                success: true,
                redirectUrl: "/reset-password"
            });
        } else {
            res.json({
                success: false,
                message: "otp not match"
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "something went wrong"
        });
        console.log(error);
    }
};

const addAddress = async (req, res) => {
    try {
        const user = req.session.user;
        res.render("add-address", {
            user: user,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("error in add address render");
        res.redirect('page404');
    }
};

const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
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
        res.redirect("/userProfile");
    } catch (error) {
        console.error("error in add address post", error);
        res.redirect('page404');
    }
};

const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currentAddress = await Address.findOne({"address._id": addressId}); 

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
            csrfToken: req.csrfToken()
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

        return res.redirect("/userProfile");
    } catch (error) {
        console.error("error in edit address post", error);
        res.redirect('page404');
    }
};

// const deleteAddress = async (req, res) => {
//     try {
//         const addressId = req.query.id;
//         const findAddress = await Address.findOne({ "address._id": addressId });
//         if (!findAddress) {
//             return res.status(404).send("address not found");
//         }
       
//         await Address.updateOne(
//             { "address._id": addressId },
//             { $pull: { address: { _id: addressId } } }
//         );

//         res.redirect("/userProfile");
//     } catch (error) {
//         console.error("error in delete address", error);
//         res.redirect('page404');
//     }
// };

// New function to handle profile photo upload
// const uploadProfilePhoto = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//             return res.redirect('/login');
//         }

//         if (!req.file) {
//             return res.redirect('/userProfile?tab=dashboard&error=No file uploaded');
//         }

//         const profilePhotoPath = `/uploads/profiles/${req.file.filename}`;
//         await User.findByIdAndUpdate(userId, { profilePhoto: profilePhotoPath });

//         res.redirect('/userProfile?tab=dashboard');
//     } catch (error) {
//         console.error('Error uploading profile photo:', error);
//         res.redirect('/userProfile?tab=dashboard&error=Failed to upload photo');
//     }
// };

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
        console.error("error in delete address", error);
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
        console.error('Error uploading profile photo:', error);
        res.redirect('/userProfile?tab=dashboard&error=Failed to upload photo');
    }
};

const removeProfilePhoto = async (req, res) => {
    try {
        const userId = req.session.user;
       
        await User.findByIdAndUpdate(userId, { profilePhoto: null });
        res.redirect('/userProfile?tab=dashboard');
    } catch (error) {
        console.error('Error removing profile photo:', error);
        res.redirect('/userProfile?tab=dashboard&error=Failed to remove photo');
    }
};

module.exports = {
    getForgotPassPage, forgotEmailValid, verifyForgotPassOtp, getResetPassPage, resendOtp, postNewPassword, userProfile,
    changeEmail, changeEmailValid, veriyfyEmailOtp, updateEmail, changePassword, changePasswordValid, verrifyChangePassOtp,
    addAddress, postAddAddress, getOrderDetails, editAddress, postEditAddress, deleteAddress, uploadProfilePhoto, removeProfilePhoto
};