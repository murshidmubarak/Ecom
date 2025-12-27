const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const whishlist = require("../../models/wishlistSchema");

const loadsignup = async (req, res) => {
    try {
        
        return res.render('signup', { csrfToken: req.csrfToken() });
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

       

        if (user) {
            const userData = await User.findOne({ _id: user });
            res.render('home', { user: userData, products: productData });
        } else {
            return res.render('home', { products: productData });
        }
    } catch (error) {
       
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
        
        return false;
    }
}

const signup = async (req, res) => {
    try {
        const { name, email, password, cPassword, code } = req.body;
       

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

        // req.session.userOtp = otp;

        // setTimeout(() => {
        //     delete req.session.userOtp;
           
        // }, 10000);

        req.session.userOtp ={
            code: otp,
            expiresAt: Date.now() + 1 * 60 * 1000 // 1 minute from now
        }

        req.session.userData = { name, email, password, referralCode: code };
       

        return res.json({ success: true, message: "OTP sent successfully!" });
    } catch (error) {
       
        return res.json({ success: false, message: "Internal server error" });
    }
};

const getotp = async (req, res) => {
    try {
        const otp = req.session.userOtp;
       
        res.render("verify-otp", { csrfToken: req.csrfToken(), otp });
    } catch (error) {
       
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
        console.log("User-submitted OTP:", userOtp);
        

        if (!sessionOtp) {
            
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        if (Date.now() > sessionOtp.expiresAt) {
            delete req.session.userOtp;
            
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }

        if (String(userOtp) !== String(sessionOtp.code)) {
           
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (!userData) {
            
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            
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
       

        if (userData.referralCode) {
            const referrer = await User.findOne({ referalCode: userData.referralCode });
            if (referrer && !referrer.redeemedUsers.includes(savedUser._id)) {
               
                let referrerWallet = await Wallet.findOne({ userId: referrer._id });
                if (!referrerWallet) {
                    referrerWallet = new Wallet({ userId: referrer._id, transactions: [] });
                    await referrerWallet.save();
                   
                }
                const referrerBalance = referrerWallet.transactions.length > 0
                    ? referrerWallet.transactions.sort(
                        (a, b) => b.transactionDate - a.transactionDate
                      )[0].balanceAfter || 0
                    : 0;
                const referralBonus = 100;
                const newReferrerBalance = referrerBalance + referralBonus;
                const referrerTransaction = {
                    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    amount: referralBonus,
                    type: "credit",
                    description: "referral_bonus",
                    balanceAfter: newReferrerBalance,
                    status: "completed",
                    transactionDate: new Date()
                };
                referrerWallet.transactions.push(referrerTransaction);
                await referrerWallet.save();
                

                // Update referrer's user.wallet
                referrer.wallet = newReferrerBalance;
                referrer.redeemedUsers.push(savedUser._id);
                await referrer.save();
                

                let referredWallet = await Wallet.findOne({ userId: savedUser._id });
                if (!referredWallet) {
                    referredWallet = new Wallet({
                        userId: savedUser._id,
                        transactions: [{
                            transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            amount: referralBonus,
                            type: "credit",
                            description: "referral_bonus",
                            balanceAfter: referralBonus,
                            status: "completed",
                            transactionDate: new Date()
                        }]
                    });
                    await referredWallet.save();
                    
                }

                // Update referred user's user.wallet
                savedUser.wallet = referralBonus;
                await savedUser.save();
                
            } else {
                console.log("No valid referrer or user already referred");
            }
        }

        delete req.session.userOtp;
        req.session.user = savedUser._id;
       

        return res.status(200).json({ success: true, message: "OTP verified successfully" });
        
    } catch (error) {
      
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
        // req.session.userOtp = otp;

        req.session.userOtp ={
            code: otp,
            expiresAt: Date.now() + 1 * 60 * 1000 // 1 minute from now
        }

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resent OTP:", otp);
            res.status(200).json({ success: true, message: "OTP resent successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP, try again" });
        }
    } catch (error) {
       
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const loadLogin = async (req, res) => {
    try {
       
        res.render('login', { csrfToken: req.csrfToken() });
    } catch (error) {
        
        res.redirect("/pageNotFound");
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
   

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
        

        return res.status(200).json({ success: true, message: "Login successful" });
    } catch (err) {
       
        return res.status(500).json({ success: false, message: "Failed to Login. Please try again." });
    }
};

const logout = (req, res) => {
    try {
        
        delete req.session.user;
        res.redirect('/');
    } catch (error) {
        
        res.redirect("/pageNotFound");
    }
};


const loadShop = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        const categories = await Category.find({ isListed: true });
        const listedCategoryIds = categories.map(category => category._id);

        const categoryId = req.query.category;
        const priceRange = req.query.price;
        const sortOption = req.query.sort || 'newest';
        const searchQuery = req.query.search;
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const query = {
            isBlocked: false,
            category: { $in: listedCategoryIds }
        };

        // Validate categoryId
        if (categoryId && categoryId !== 'all') {
            const categoryExists = categories.find(cat => cat._id.toString() === categoryId);
            if (categoryExists) {
                query.category = categoryId;
                
            } 
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
            .populate('category')
            .sort(sortCriteria)
            .limit(limit)
            .skip(skip);

        // Get user's wishlist if user is logged in
        let userWishlist = null;
        if (userData) {
            userWishlist = await whishlist.findOne({ userId: userData._id });
        }

        // Add wishlist status to each product
        const productsWithWishlistStatus = products.map(product => {
            const isInWishlist = userWishlist && userWishlist.products.some(
                wishlistProduct => wishlistProduct.productId.toString() === product._id.toString()
            );
            return {
                ...product.toObject(),
                isInWishlist
            };
        });

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        

        if (user && userData && categoryId && query.category !== listedCategoryIds) {
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
            { id: 'under500', name: 'Under ₹500', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}price=under500${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: '500to1000', name: '₹500 - ₹1000', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}price=500to1000${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: '1000to1500', name: '₹1000 - ₹1500', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}price=1000to1500${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: 'above1500', name: 'Above ₹1500', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}price=above1500${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` },
            { id: 'all', name: 'All Prices', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId : ''}${sortOption !== 'newest' ? '&sort=' + sortOption : ''}` }
        ];

        const sortLinks = [
            { id: 'newest', name: 'Newest', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}sort=newest` },
            { id: 'price-low-high', name: 'Price: Low to High', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}sort=price-low-high` },
            { id: 'price-high-low', name: 'Price: High to Low', link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}sort=price-high-low` }
        ];

        const paginationLinks = [];
        for (let i = 1; i <= totalPages; i++) {
            paginationLinks.push({
                pageNumber: i,
                link: `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}${sortOption !== 'newest' ? 'sort=' + sortOption + '&' : ''}page=${i}`,
                active: i === page
            });
        }

        res.render('shop', {
            user: userData,
            products: productsWithWishlistStatus, // Pass products with wishlist status
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
            prevPageLink: page > 1 ? `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}${sortOption !== 'newest' ? 'sort=' + sortOption + '&' : ''}page=${page - 1}` : null,
            nextPageLink: page < totalPages ? `/shop?${categoryId && categoryId !== 'all' && categories.find(cat => cat._id.toString() === categoryId) ? 'category=' + categoryId + '&' : ''}${priceRange ? 'price=' + priceRange + '&' : ''}${sortOption !== 'newest' ? 'sort=' + sortOption + '&' : ''}page=${page + 1}` : null
        });
    } catch (error) {
        
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

            const csrfToken = req.csrfToken();

        res.render('product-details', {
            csrfToken,
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
           
            return res.redirect("/login");
        }

        const [user, wallet, orders, userAddress] = await Promise.all([
            User.findById(userId),
            Wallet.findOne({ userId }),
            Order.find({ userId }).populate("orderedItems.product"),
            Address.findOne({ userId })
        ]);

        if (!user) {
            
            return res.redirect("/login");
        }

        let walletBalance = user.wallet || 0; // Fallback to user.wallet
        if (wallet && wallet.transactions && wallet.transactions.length > 0) {
            const latestTransaction = wallet.transactions.sort(
                (a, b) => b.transactionDate - a.transactionDate
            )[0];
            if (latestTransaction && typeof latestTransaction.balanceAfter === 'number') {
                walletBalance = latestTransaction.balanceAfter;

                // Synchronize user.wallet if out of sync
                if (user.wallet !== walletBalance) {
                    console.log(`Synchronizing user.wallet: ${user.wallet} -> ${walletBalance}`);
                    user.wallet = walletBalance;
                    await user.save();
                }
            } else {
                console.warn(`Invalid latestTransaction.balanceAfter: ${latestTransaction.balanceAfter}`);
            }
        } else {
           
            if (!wallet && user.wallet !== 0) {
                // Create empty wallet to align with user.wallet
                const newWallet = new Wallet({ userId: user._id, transactions: [] });
                await newWallet.save();
              
            }
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