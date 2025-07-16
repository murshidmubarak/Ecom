const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const mongoose = require("mongoose");
const Wishlist = require("../../models/wishlistSchema");

const MAX_QUANTITY_PER_ITEM = 3;

const getCartPage = async (req, res) => {
    try {
        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect("/login");
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        const productIds = cart?.items.map(item => item.productId) || [];
        const products = await Product.find({
            _id: { $in: productIds },
            isBlock: false
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render("cart", {
                user,
                quantity: 0,
                data: [],
                grandTotal: 0,
                _csrf: req.csrfToken(),
            });
        }

        const data = cart.items.map((item) => ({
            quantity: item.quantity,
            productDetails: [item.productId],
        }));

        const quantity = cart.items.reduce((total, item) => total + item.quantity, 0);
        const grandTotal = cart.items.reduce((total, item) => {
            const salePrice = Number(item.productId.salePrice) || 0;
            return total + (salePrice * item.quantity);
        }, 0);

        req.session.grandTotal = grandTotal;

       

        res.render("cart", {
            user,
            quantity,
            data,
            grandTotal,
            _csrf: req.csrfToken(),
        });
    } catch (error) {
       
        res.redirect("/pageNotFound");
    }
};

const addToCart = async (req, res) => {
    try {
       
        const { productId, _csrf } = req.body;
        const userId = req.session.user;

      

        if (!userId) {
            return res.json({ status: false, message: "Please login first" });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.json({ status: false, message: "Invalid product ID" });
        }

        const product = await Product.findById(productId).lean();

        if (!product) {
            return res.json({ status: false, message: "Product not found" });
        }

        const productQuantity = parseInt(product.quantity, 10);
        if (isNaN(productQuantity) || productQuantity <= 0) {
            return res.json({ outOfStock: true, message: "Out of stock" });
        }

        const salePrice = Number(product.salePrice);
        if (isNaN(salePrice)) {
            return res.json({ status: false, message: "Invalid product price" });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId.toString()
        );
        
       

        if (existingItemIndex === -1) {
            cart.items.push({
                productId: productId,
                quantity: 1,
            });
            console.log("Added new item:", cart.items[cart.items.length - 1]);
        } else {
            const item = cart.items[existingItemIndex];
            if (item.quantity >= MAX_QUANTITY_PER_ITEM) {
                return res.json({
                    status: false,
                    message: `Maximum ${MAX_QUANTITY_PER_ITEM} items allowed per product`,
                });
            }
            if (item.quantity >= productQuantity) {
                return res.json({ outOfStock: true, message: "Out of stock" });
            }
            item.quantity += 1;
            console.log("Incremented item:", item);
        }

        await cart.save();

        // Remove from wishlist
        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            const initialLength = wishlist.products.length;
            wishlist.products = wishlist.products.filter(
                (p) => p.productId.toString() !== productId.toString()
            );
            if (wishlist.products.length < initialLength) {
                await wishlist.save();
                console.log(`Removed product ${productId} from wishlist for user ${userId}`);
            }
        }

        const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
        const grandTotal = updatedCart.items.reduce((total, item) => {
            return total + (Number(item.productId.salePrice) * item.quantity);
        }, 0);

       

        return res.json({
            success: true,
            cartLength: updatedCart.items.length,
            grandTotal: grandTotal,
            message: "Product added to cart successfully",
        });
    } catch (error) {

        return res.status(500).json({ status: false, message: "Server error" });
    }
};

const changeQuantity = async (req, res) => {
    try {
        
        const { productId, count, _csrf } = req.body;
        const userId = req.session.user;

        

        if (count !== "1" && count !== "-1") {
            return res.status(400).json({ status: false, error: "Invalid count value" });
        }

        const countNum = parseInt(count);

        const [cart, product] = await Promise.all([
            Cart.findOne({ userId }).populate("items.productId"),
            Product.findById(productId),
        ]);

        if (!cart) {
            return res.status(404).json({ status: false, error: "Cart not found for this user" });
        }

        if (!product) {
            return res.status(404).json({ status: false, error: "Product not found in database" });
        }

        const cartItemIndex = cart.items.findIndex(
            (item) => item.productId._id.toString() === productId.toString()
        );

        if (cartItemIndex === -1) {
            return res.status(404).json({ status: false, error: "Product not found in cart" });
        }

        const cartItem = cart.items[cartItemIndex];
        const currentQuantity = cartItem.quantity;
        const newQuantity = currentQuantity + countNum;

        const productQuantity = parseInt(product.quantity, 10);
        const salePrice = Number(product.salePrice);

        if (isNaN(salePrice)) {
            return res.status(400).json({ status: false, error: "Invalid product price" });
        }

        if (newQuantity < 1) {
            return res.status(400).json({
                status: false,
                error: "Quantity cannot be less than 1",
                currentQuantity,
            });
        }

        if (newQuantity > MAX_QUANTITY_PER_ITEM) {
            return res.status(400).json({
                status: false,
                error: `Maximum ${MAX_QUANTITY_PER_ITEM} items allowed per product`,
                currentQuantity,
            });
        }

        if (newQuantity > productQuantity) {
            return res.status(400).json({
                status: false,
                error: `Only ${productQuantity} items available in stock`,
                currentQuantity,
                stockQuantity: productQuantity,
            });
        }

        cartItem.quantity = newQuantity;
        await cart.save();

        const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
        const grandTotal = updatedCart.items.reduce((total, item) => {
            return total + (Number(item.productId.salePrice) * item.quantity);
        }, 0);
        const totalAmount = salePrice * newQuantity;

        console.log("Updated item:", cartItem);
        console.log("Grand Total after change:", grandTotal);

        return res.json({
            status: true,
            quantityInput: newQuantity,
            totalAmount: totalAmount,
            grandTotal: grandTotal,
            stockQuantity: productQuantity,
        });
    } catch (error) {
      
        return res.status(500).json({ status: false, error: "Server error occurred" });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const userId = req.session.user;

        if (!productId || !userId) {
            return res.redirect("/cart");
        }

        await Cart.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId: productId } } }
        );

        return res.redirect("/cart");
    } catch (error) {
        console.error("Delete product error:", error);
        return res.redirect("/pageNotFound");
    }
};

const loadWishList = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId).populate({
            path: 'wishlist',
            populate: { path: 'products.productId' }
        });

        if (!user) {
            return res.redirect('/login');
        }

        const products = user.wishlist.length > 0 
            ? user.wishlist[0].products.map(item => item.productId) 
            : [];

        res.render('wishlist', { user, products, csrfToken: req.csrfToken() });
    } catch (error) {
        
        res.redirect('/pageNotFound');
    }
};

const addTowishlist = async (req, res) => {
    try {
     
        const { productId, _csrf } = req.body;
        const userId = req.session.user;

        

        if (!userId) {
            return res.status(401).json({ status: false, message: "Please log in" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [{ productId }] });
            await wishlist.save();
            user.wishlist = [wishlist._id];
            await user.save();
        } else {
            if (wishlist.products.some(p => p.productId.toString() === productId)) {
                return res.json({ status: false, message: "Product already in wishlist" });
            }
            wishlist.products.push({ productId });
            await wishlist.save();

            if (!user.wishlist.includes(wishlist._id)) {
                user.wishlist = [wishlist._id];
                await user.save();
            }
        }

        return res.json({ status: true, message: "Product added to wishlist" });
    } catch (error) {
        
        return res.status(500).json({ status: false, message: "Server error" });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        
        const { productId, _csrf } = req.body;
        const userId = req.session.user;

       

        if (!userId) {
            return res.status(401).json({ status: false, message: "Please log in" });
        }

        const user = await User.findById(userId);
        if (!user || !user.wishlist.length) {
            return res.status(404).json({ status: false, message: "Wishlist not found" });
        }

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.status(404).json({ status: false, message: "Wishlist not found" });
        }

        wishlist.products = wishlist.products.filter(
            p => p.productId.toString() !== productId
        );
        await wishlist.save();

        return res.json({ status: true, message: "Product removed from wishlist" });
    } catch (error) {
        
        return res.status(500).json({ status: false, message: "Server error" });
    }
};

module.exports = {
    getCartPage,
    addToCart,
    changeQuantity,
    deleteProduct,
    loadWishList,
    addTowishlist,
    removeFromWishlist
};