const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const loadsignup = async (req, res) => {
    try {
        console.log('signup renderd');
        return res.render('signup');
    } catch (error) {
        res.status(500).send("server error");
    }
};

const pageNotFound = async (req, res) => {
    try {
        res.render("page404");
    } catch (error) {
        //res.redirect("/pageNotFound")
    }
};

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        }).sort({ createdAt: -1 });

        productData = productData.slice(0, 4);

        console.log("productData", productData);

        if (user) {
            const userData = await User.findOne({ _id: user });
            res.render('home', { user: userData, products: productData });
        } else {
            return res.render('home', { products: productData });
        }
    } catch (error) {
        console.error("Load login error:", error);
        res.redirect("/pageNotFound");
    }
};

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateUniqueReferralCode() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const existingUser = await User.findOne({ referalCode: code });
        if (!existingUser) {
            console.log(`Generated referral code: ${code}`);
            return code;
        }
        attempts++;
    }
    throw new Error("Unable to generate unique referral code after multiple attempts");
}

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

        console.log(`Email sent, OTP: ${otp}`);
        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error.message);
        return false;
    }
}

const signup = async (req, res) => {
    try {
        const { name, email, password, cPassword, code } = req.body;
console.log(req.body);

        if (!name || !email || !password || !cPassword) {
            return res.json({ success: false, message: "All fields are required" });
        }

        if (password !== cPassword) {
            return res.json({ success: false, message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.json({ success: false, message: "User already exists" });
        }

        let referrer = null;
        if (code) {
            referrer = await User.findOne({ referalCode: code });
            if (!referrer) {
                return res.json({ success: false, message: "Invalid referral code" });
            }
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json({ success: false, message: "Error sending email. Try again later." });
        }

        req.session.userOtp = otp;
        console.log("Generated OTP:", req.session.userOtp);

        setTimeout(() => {
            console.log('Clearing OTP from session');
            delete req.session.userOtp;
            console.log("Session OTP after clear:", req.session.userOtp);
        }, 10000);

        req.session.userData = { name, email, password, referralCode: code };
        console.log("Stored user data in session:", req.session.userData);

        return res.json({ success: true, message: "OTP sent successfully!" });
    } catch (error) {
        console.error("Signup Error:", error);
        return res.json({ success: false, message: "Internal server error" });
    }
};

const getotp = async (req, res) => {
    try {
        const otp = req.session.userOtp;
        console.log("Rendering verify-otp, OTP:", otp);
        res.render("verify-otp");
    } catch (error) {
        console.error("Error rendering OTP page:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp: userOtp } = req.body;
        const sessionOtp = req.session.userOtp;
        const userData = req.session.userData;
      console.log("M74LVSM74LVSM74LVSM74LVSM74LVSM74LVSM74LVS",userData)
        console.log("User-submitted OTP:", userOtp);
        console.log("Session OTP:", sessionOtp);
        console.log("Session User Data:", userData);

        if (!sessionOtp) {
            console.log("No OTP found in session");
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        if (String(userOtp) !== String(sessionOtp)) {
            console.log("Invalid OTP");
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (!userData) {
            console.log("No user data in session");
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            console.log("Email already registered:", userData.email);
            return res.status(400).json({ success: false, message: "Email already registered. Please log in." });
        }

        const passwordHash = await securePassword(userData.password);
        const referralCode = await generateUniqueReferralCode();

        const savedUser = new User({
            name: userData.name,
            email: userData.email,
            password: passwordHash,
            referalCode: referralCode
        });

        await savedUser.save();
        console.log("Saved user with referral code:", savedUser);

        if (userData.referralCode) {
            const referrer = await User.findOne({ referalCode: userData.referralCode });
            if (referrer && !referrer.redeemedUsers.includes(savedUser._id)) {
                console.log(`Processing referral for referrer: ${referrer.email}`);
                let referrerWallet = await Wallet.findOne({ userId: referrer._id });
                if (!referrerWallet) {
                    referrerWallet = new Wallet({ userId: referrer._id, transactions: [] });
                    await referrerWallet.save();
                    console.log("Created new wallet for referrer:", referrerWallet);
                }
                const referrerBalance = referrerWallet.transactions.reduce(
                    (sum, tx) => sum + (tx.type.toLowerCase() === "credit" ? Number(tx.amount) : -Number(tx.amount)),
                    0
                );
                const referrerTransaction = {
                    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    amount: 100,
                    type: "credit",
                    description: "referral_bonus",
                    balanceAfter: referrerBalance + 100,
                    status: "completed",
                    transactionDate: Date.now()
                };
                referrerWallet.transactions.push(referrerTransaction);
                await referrerWallet.save();
                console.log("Referrer wallet transaction added:", referrerTransaction);

                const referredWallet = new Wallet({
                    userId: savedUser._id,
                    transactions: [{
                        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        amount: 100,
                        type: "credit",
                        description: "referral_bonus",
                        balanceAfter: 100,
                        status: "completed",
                        transactionDate: Date.now()
                    }]
                });
                await referredWallet.save();
                console.log("Referred user wallet transaction added:", referredWallet.transactions[0]);

                referrer.redeemedUsers.push(savedUser._id);
                await referrer.save();
                console.log("Referrer redeemedUsers updated:", referrer.redeemedUsers);
            } else {
                console.log("No valid referrer or user already referred");
            }
        }

        req.session.user = savedUser._id;
        console.log("User session set, ID:", savedUser._id);

        return res.status(200).json({ success: true, message: "OTP verified successfully" });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found" });
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resent OTP:", otp);
            res.status(200).json({ success: true, message: "OTP resent successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, try again" });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const loadLogin = async (req, res) => {
    try {
        console.log('load');
        res.render('login');
    } catch (error) {
        console.error("Load login error:", error);
        res.redirect("/pageNotFound");
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', email);

    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Invalid Credentials" });
        }

        let existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(400).json({ success: false, message: "Email is not registered. Please sign up." });
        }
        if (existingUser.isBlocked === true) {
            return res.status(403).json({ success: false, message: "Account is locked by an admin. Please contact support." });
        }

        let comparePassword = await bcrypt.compare(password, existingUser.password);
        if (!comparePassword) {
            return res.status(400).json({ success: false, message: "Incorrect Password" });
        }

        req.session.user = existingUser._id;
        console.log("Login successful, user ID:", existingUser._id);

        return res.status(200).json({ success: true, message: "Login successful" });
    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ success: false, message: "Failed to Login. Please try again." });
    }
};

const logout = (req, res) => {
    try {
        console.log("Logging out user");
        delete req.session.user;
        res.redirect('/');
    } catch (error) {
        console.error("Unexpected Logout Error:", error);
        res.redirect("/pageNotFound");
    }
};

const loadShop = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        const categories = await Category.find({ isListed: true });

        const categoryId = req.query.category;
        const priceRange = req.query.price;
        const sortOption = req.query.sort || 'newest';
        const searchQuery = req.query.search;
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const query = { isBlocked: false };

        if (categoryId && categoryId !== 'all') {
            query.category = categoryId;
        }

        if (priceRange) {
            switch (priceRange) {
                case 'under500':
                    query.salePrice = { $lt: 500 };
                    break;
                case '500to1000':
                    query.salePrice = { $gte: 500, $lte: 1000 };
                    break;
                case '1000to1500':
                    query.salePrice = { $gte: 1000, $lte: 1500 };
                    break;
                case 'above1500':
                    query.salePrice = { $gt: 1500 };
                    break;
            }
        }

        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

        let sortCriteria = {};
        switch (sortOption) {
            case 'newest':
                sortCriteria = { createdAt: -1 };
                break;
            case 'price-low-high':
                sortCriteria = { salePrice: 1 };
                break;
            case 'price-high-low':
                sortCriteria = { salePrice: -1 };
                break;
            default:
                sortCriteria = { createdOn: -1 };
        }

        const products = await Product.find(query)
            .sort(sortCriteria)
            .limit(limit)
            .skip(skip);

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        if (user && userData && categoryId) {
            const searchEntry = {
                category: categoryId,
                searchedOn: new Date()
            };

            userData.searchHistory.push(searchEntry);
            await userData.save();
        }

        const categoriesWithLinks = categories.map(category => ({
            _id: category._id,
            name: category.name,
            link: `/shop?category=${category._id}`
        }));

        const priceFilters = [
            { id: 'under500', name: 'Under ₹500', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}price=under500${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: '500to1000', name: '₹500 - ₹1000', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}price=500to1000${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: '1000to1500', name: '₹1000 - ₹1500', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}price=1000to1500${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: 'above1500', name: 'Above ₹1500', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}price=above1500${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: 'all', name: 'All Prices', link: `/shop?${categoryId ? 'category=' + categoryId : ''}${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` }
        ];

        const sortLinks = [
            { id: 'newest', name: 'Newest', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}sort=newest` },
            { id: 'price-low-high', name: 'Price: Low to High', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}sort=price-low-high` },
            { id: 'price-high-low', name: 'Price: High to Low', link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}sort=price-high-low` }
        ];

        const paginationLinks = [];
        for (let i = 1; i <= totalPages; i++) {
            paginationLinks.push({
                pageNumber: i,
                link: `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}${sortOption !== 'newest' ? 'sort=' + sortOption + '&' : ''}page=${i}`,
                active: i === page
            });
        }

        console.log("Shop products:", products);

        res.render('shop', {
            user: userData,
            products: products,
            categories: categories,
            categoriesWithLinks: categoriesWithLinks,
            priceFilters: priceFilters,
            sortLinks: sortLinks,
            paginationLinks: paginationLinks,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: categoryId || 'all',
            selectedPrice: priceRange || 'all',
            selectedSort: sortOption || 'newest',
            prevPageLink: page > 1 ? `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}${sortOption !== 'newest' ? 'sort=' + sortOption + '&' : ''}page=${page - 1}` : null,
            nextPageLink: page < totalPages ? `/shop?${categoryId ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}${sortOption !== 'newest' ? 'sort=' + sortOption + '&' : ''}page=${page + 1}` : null
        });
    } catch (error) {
        console.error('Error loading shop page:', error);
        res.redirect("/pageNotFound");
    }
};

const getProductDetails = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const user = userId ? await User.findById(typeof userId === 'object' ? userId._id : userId) : null;
        const productId = req.query.id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId }
        })
            .limit(4)
            .select('productName productImage salePrice regularPrice');

        res.render('product-details', {
            user,
            product,
            relatedProducts,
            quantity: product.quantity,
            category: await Category.findById(product.category),
        });
    } catch (error) {
        next(error);
    }
};

const loadProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            console.log("No user session, redirecting to login");
            return res.redirect("/login");
        }

        const [user, wallet, orders, userAddress] = await Promise.all([
            User.findById(userId),
            Wallet.findOne({ userId }),
            Order.find({ userId }).populate("orderedItems.product"),
            Address.findOne({ userId })
        ]);

        if (!user) {
            console.log("User not found for ID:", userId);
            return res.redirect("/login");
        }

        let walletBalance = 0;
        if (wallet && wallet.transactions && wallet.transactions.length > 0) {
            walletBalance = wallet.transactions.reduce((sum, tx) => {
                const amount = Number(tx.amount) || 0;
                const isCredit = tx.type.toLowerCase() === "credit";
                return sum + (isCredit ? amount : -amount);
            }, 0);
        }

        console.log("Profile data:", {
            email: user.email,
            referalCode: user.referalCode,
            redeemedUsers: user.redeemedUsers ? user.redeemedUsers.length : 0,
            walletExists: !!wallet,
            transactionCount: wallet ? wallet.transactions.length : 0,
            walletBalance
        });

        res.render("profile", {
            user,
            wallet,
            orders,
            userAddress,
            walletBalance,
            moment: require("moment")
        });
    } catch (error) {
        console.error("Error loading profile:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    loadsignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    getotp,
    logout,
    loadShop,
    getProductDetails,
    loadProfile
};