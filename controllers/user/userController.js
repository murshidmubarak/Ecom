const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const loadsignup = async (req,res)=>{
    try {

        console.log('signup renderd');
        return res.render('signup')
       
        
    } catch (error) {
        res.status(500).send("server error")
    }
}



const pageNotFound = async (req,res)=>{
    try {
        res.render("page404")
    } catch (error) {
        //res.redirect("/pageNotFound")
       
        

    }
}



const loadHomepage = async (req,res)=>{
    /* try {
        res.render('home');
        console.log("render home page");
        
    } catch (error) {
        console.log("render home page error");
        res.status(500).send("server error");
        
    } */

    try {
        const user = req.session.user;
        const categories = await Category.find({isListed:true});
        let productData = await Product.find({isBlocked:false,category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}}).sort({createdAt:-1})

        // productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productData = productData.slice(0,4);


        console.log("productData",productData);


        if(user){
            const userData = await User.findOne({id:user._id})
            res.render('home',{user:userData,products:productData})
        }else{
            return res.render('home',{products:productData})
        }

        //return res.render("login", { message }); // Always show login page
    } catch (error) {
        console.error("Load login error:", error);
        res.redirect("/pageNotFound");
    }
}


function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

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


const signup = async (req, res) => {
    try {
        const { name, email, password, cPassword } = req.body;

        if (!name || !email || !password || !cPassword) {
            return res.json({ success: false, message: "All fields are required" });
        }

        if (password !== cPassword) {
            return res.json({ success: false, message: "Passwords do not match" });
        }

        // ✅ Check if user already exists
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.json({ success: false, message: "User already exists" });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json({ success: false, message: "Error sending email. Try again later." });
        }

        req.session.userOtp = otp;
        console.log("Generated OTP:", req.session.userOtp);

        setTimeout(() => {
            console.log('sdfsdfsdf')
            delete req.session.userOtp
            console.log(req.session.userOtp);
            
        }, 10000);

        // ✅ Store password in session (Fixed)
        req.session.userData = { name, email, password }; 
        console.log("hello",req.session.userData);
        

        return res.json({ success: true, message: "OTP sent successfully!" });

    } catch (error) {
        console.error("Signup Error:", error);
        return res.json({ success: false, message: "Internal server error" });
    }
};


const getotp= async(req,res)=>{
    try {
        const otp=req.session.userOtp
        console.log("otpget",otp);
        
        res.render("verify-otp")
    } catch (error) {
        console.error(error);
        return res.status(500).json({success:false,message:"invalid server error"});
    }
}



const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
};

/* const verifyOtp = async (req, res) => {
    try {
        const otp = req.session.userOtp;
        console.log("Received OTP:", otp);
        console.log("Session OTP:", req.session.userOtp);
        console.log("Session User Data:", req.session.userData);

        // Check if OTP exists
        if (!req.session.userOtp) {
            console.log("No OTP found in session");
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        // Compare OTP
        if (String(otp) !== String(req.session.userOtp)) {
            console.log("Invalid OTP");
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        const user = req.session.userData;
        if (!user) {
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        const existingUser = await User.findOne({ email: user.email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already registered. Please log in." });
        }

     
        const passwordHash = await securePassword(user.password);

        const savedUser = new User({
            name: user.name,
            email: user.email,
            password: passwordHash
        });

        await savedUser.save();

        // Store user ID in session
        req.session.user = savedUser._id;
        console.log("User successfully verified and saved:", savedUser);

      
        return res.redirect("/");

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};
 */




const verifyOtp = async (req, res) => {
    try {
        const { otp: userOtp } = req.body; // OTP submitted by the user
        if(!req.session.userOtp){
            console.log("No OTP found in session");
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }
        const sessionOtp = req.session.userOtp; // OTP stored in the session
        const userData = req.session.userData; // User data stored in the session

        // return console.log(req.session.userOtp);
        
        console.log("User-submitted OTP:", userOtp);
        console.log("Session OTP:", sessionOtp);
        console.log("Session User Data:", userData);

        // Check if OTP exists in the session
        if (!sessionOtp) {
            console.log("No OTP found in session");
            return res.status(400).json({ success: false, message: "OTP expired. Please request a new one." });
        }

        

        // Compare OTPs
        if (String(userOtp) !== String(sessionOtp)) {
            console.log("Invalid OTP");
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        // Check if user data exists in the session
        if (!userData) {
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        // Check if the user already exists in the database
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already registered. Please log in." });
        }

        // If everything is fine, proceed with user creation
        const passwordHash = await securePassword(userData.password);
        let code=Math.floor(100000 + Math.random() * 900000).toString();
        const savedUser = new User({
           
            name: userData.name,
            email: userData.email,
            password: passwordHash
        });

        await savedUser.save();

        // Store user ID in session
        req.session.user = savedUser._id;
        console.log("User successfully verified and saved:", savedUser);

        // Return JSON instead of redirect
        return res.status(200).json({ success: true, message: "OTP verified successfully" });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

const resendOtp = async (req,res)=>{
    try {
        
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"email not found"})
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("resend otp,",otp);
            res.status(200).json({success:true,message:"otp resend successfully"})
            
        }else{
            res.status(500).json({success:false,message:"failed to resend otp try agin"})
        }
    } catch (error) {
       console.error("error resend otp");
       res.status(500).json({success:false,message:"server er"})
    }
}

const loadLogin = async (req, res) => {
/*     try {
        const message = req.session.message || ""; // Ensure message is a valid string
        req.session.message = null; // Clear the message after rendering

        if (!req.session.user) {
            return res.render("login", { message }); // Pass message to EJS
        } else {
            return res.redirect("/");
        }
    } catch (error) {
        console.error("Load login error:", error);
        res.redirect("/pageNotFound");
    } */

        // try {
        //     /* const message = req.session.message || ""; 
        //     req.session.message = null;  */
        //     const user = req.session.user
        //     if(user){
        //         const userData = await User.findOne({id:user._id})
        //         res.render('home',{use:userData})
        //     }else{
        //         return res.render('home',)
        //     }
    
        //     //return res.render("login", { message }); // Always show login page
        // } catch (error) {
        //     console.error("Load login error:", error);
        //     res.redirect("/pageNotFound");
        // }

        try {
            console.log('load');
            
            res.render('login')
        } catch (error) {
            
        }


};



const login = async (req, res) => {
    const { email, password } = req.body;
    console.log('aaaaaaaaaaa:', req.session.admin)
console.log(req.body);

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
  
        req.session.user = existingUser._id
  
        return res.status(200).json({ success: true, message: "Login successful" });
  
    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ success: false, message: "Failed to Login. Please try again." });
    }
};

const logout = (req, res) => {
    try {
        delete req.session.user
        res.redirect('/')
    } catch (error) {
        console.error("Unexpected Logout Error:", error);
        res.redirect("/pageNotFound");
    }
};


const loadShop = async (req, res) => {
    try {
        // Get user data if logged in
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        
        // Get all categories
        const categories = await Category.find({ isListed: true });
        
        // Get filter parameters from request
        const categoryId = req.query.category;
        const priceRange = req.query.price;
        const sortOption = req.query.sort || 'newest';
        const searchQuery = req.query.search;
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        
        
        const query = { isBlocked: false};
        
       
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
        
        // Save search history if logged in and searching by category
        if (user && userData && categoryId) {
            const searchEntry = {
                category: categoryId,
                searchedOn: new Date()
            };
            
            userData.searchHistory.push(searchEntry);
            await userData.save();
        }
        
        // Generate category links for the view
        const categoriesWithLinks = categories.map(category => ({
            _id: category._id,
            name: category.name,
            link: `/shop?category=${category._id}`
        }));
        
        
        const priceFilters = [
            { id: 'under500', name: 'Under ₹500', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}price=under500${sortOption !== 'newest' ? '&sort='+sortOption : ''}` },
            { id: '500to1000', name: '₹500 - ₹1000', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}price=500to1000${sortOption !== 'newest' ? '&sort='+sortOption : ''}` },
            { id: '1000to1500', name: '₹1000 - ₹1500', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}price=1000to1500${sortOption !== 'newest' ? '&sort='+sortOption : ''}` },
            { id: 'above1500', name: 'Above ₹1500', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}price=above1500${sortOption !== 'newest' ? '&sort='+sortOption : ''}` },
            { id: 'all', name: 'All Prices', link: `/shop?${categoryId ? 'category='+categoryId : ''}${sortOption !== 'newest' ? '&sort='+sortOption : ''}` }
        ];
        
        
        const sortLinks = [
            { id: 'newest', name: 'Newest', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}${priceRange ? 'price='+priceRange+'&' : ''}sort=newest` },
            { id: 'price-low-high', name: 'Price: Low to High', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}${priceRange ? 'price='+priceRange+'&' : ''}sort=price-low-high` },
            { id: 'price-high-low', name: 'Price: High to Low', link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}${priceRange ? 'price='+priceRange+'&' : ''}sort=price-high-low` }
        ];
        
        // Generate pagination links
        const paginationLinks = [];
        for (let i = 1; i <= totalPages; i++) {
            paginationLinks.push({
                pageNumber: i,
                link: `/shop?${categoryId ? 'category='+categoryId+'&' : ''}${priceRange ? 'price='+priceRange+'&' : ''}${sortOption !== 'newest' ? 'sort='+sortOption+'&' : ''}page=${i}`,
                active: i === page
            });
        }

        console.log(products);
        
        
        // Render the shop page
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
            prevPageLink: page > 1 ? `/shop?${categoryId ? 'category='+categoryId+'&' : ''}${priceRange ? 'price='+priceRange+'&' : ''}${sortOption !== 'newest' ? 'sort='+sortOption+'&' : ''}page=${page-1}` : null,
            nextPageLink: page < totalPages ? `/shop?${categoryId ? 'category='+categoryId+'&' : ''}${priceRange ? 'price='+priceRange+'&' : ''}${sortOption !== 'newest' ? 'sort='+sortOption+'&' : ''}page=${page+1}` : null
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






module.exports = {
    loadHomepage, pageNotFound, loadsignup, signup, verifyOtp, resendOtp, loadLogin, login, getotp,logout,loadShop,getProductDetails
};
