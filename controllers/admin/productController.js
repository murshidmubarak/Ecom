const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs").promises;

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render("product-add", {
            cat: category,
        });
    } catch (error) {
        console.error("Error loading add product page:", error);
        res.redirect("/pageerror");
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        // Backend validation
        if (!products.productName || products.productName.trim() === "") {
            return res.status(400).json({ success: false, message: "Product name is required" });
        }
        if (!products.description || products.description.trim() === "") {
            return res.status(400).json({ success: false, message: "Description is required" });
        }
        if (!products.category) {
            return res.status(400).json({ success: false, message: "Category is required" });
        }
        const regularPrice = parseFloat(products.regularPrice);
        if (isNaN(regularPrice) || regularPrice <= 0) {
            return res.status(400).json({ success: false, message: "Regular price must be a positive number" });
        }
        const productOffer = parseFloat(products.productOffer) || 0;
        if (productOffer < 0 || productOffer > 100) {
            return res.status(400).json({ success: false, message: "Product offer must be between 0 and 100" });
        }
        const quantity = parseInt(products.quantity);
        if (isNaN(quantity) || quantity < 0) {
            return res.status(400).json({ success: false, message: "Quantity must be a non-negative integer" });
        }
        if (!products.color || products.color.trim() === "") {
            return res.status(400).json({ success: false, message: "Color is required" });
        }

        // Check for duplicate product
        const existingProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${products.productName.trim()}$`, "i") },
        });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: "A product with this name already exists",
            });
        }

        // Process images
        const images = [];
        if (req.files && req.files.length > 0) {
            if (req.files.length < 3) {
                return res.status(400).json({
                    success: false,
                    message: "At least 3 images are required",
                });
            }
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join("public", "uploads", "resized-" + req.files[i].filename);
                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);
                images.push("resized-" + req.files[i].filename);
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "At least 3 images are required",
            });
        }

        // Find category
        const category = await Category.findOne({ name: products.category });
        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Invalid category name",
            });
        }

        // Calculate sale price based on offers
        const categoryOffer = parseFloat(category.categoryOffer) || 0;
        const effectiveOffer = Math.max(productOffer, categoryOffer);
        const salePrice = regularPrice * (1 - effectiveOffer / 100);

        // Create new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            category: category._id,
            regularPrice: regularPrice,
            salePrice: salePrice,
            productOffer: productOffer,
            createdOn: new Date(),
            quantity: quantity,
            size: products.size || "", // Optional field
            color: products.color,
            productImage: images,
        });

        await newProduct.save();

        res.status(200).json({
            success: true,
            message: "Product added successfully",
        });
    } catch (error) {
        console.error("Error saving product:", error);
        res.status(500).json({
            success: false,
            message: "Server error occurred while adding product",
        });
    }
};

const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 7;

        const productData = await Product.find({
            productName: { $regex: new RegExp(".*" + search + ".*", "i") },
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .populate("category")
            .exec();

        const count = await Product.countDocuments({
            productName: { $regex: new RegExp(".*" + search + ".*", "i") },
        });

        const category = await Category.find({ isListed: true });

        res.render("products", {
            data: productData,
            cat: category,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).render("pageerror");
    }
};

const blockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const updatedProduct = await Product.updateOne(
            { _id: id },
            { $set: { isBlocked: true } }
        );

        if (updatedProduct.n === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (updatedProduct.nModified === 0) {
            return res.status(200).json({ success: true, message: "Product already blocked" });
        }

        res.status(200).json({ success: true, message: "Product blocked successfully" });
    } catch (error) {
        console.error("Error blocking product:", error);
        res.status(500).json({ success: false, message: "Server error while blocking product" });
    }
};

const unblockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const updatedProduct = await Product.updateOne(
            { _id: id },
            { $set: { isBlocked: false } }
        );

        if (updatedProduct.n === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (updatedProduct.nModified === 0) {
            return res.status(200).json({ success: true, message: "Product already unblocked" });
        }

        res.status(200).json({ success: true, message: "Product unblocked successfully" });
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.status(500).json({ success: false, message: "Server error while unblocking product" });
    }
};

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.redirect("/pageerror");
        }
        const product = await Product.findOne({ _id: id });
        const category = await Category.find({ isListed: true });
        res.render("product-edit", {
            product: product,
            cat: category,
        });
    } catch (error) {
        console.error("Error loading edit product page:", error);
        res.redirect("/pageerror");
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        // Backend validation
        if (!data.productName || data.productName.trim() === "") {
            return res.status(400).json({ success: false, message: "Product name is required" });
        }
        if (!data.description || data.description.trim() === "") {
            return res.status(400).json({ success: false, message: "Description is required" });
        }
        if (!data.category) {
            return res.status(400).json({ success: false, message: "Category is required" });
        }
        const regularPrice = parseFloat(data.regularPrice);
        if (isNaN(regularPrice) || regularPrice <= 0) {
            return res.status(400).json({ success: false, message: "Regular price must be a positive number" });
        }
        const productOffer = parseFloat(data.productOffer) || 0;
        if (productOffer < 0 || productOffer > 100) {
            return res.status(400).json({ success: false, message: "Product offer must be between 0 and 100" });
        }
        const quantity = parseInt(data.quantity);
        if (isNaN(quantity) || quantity < 0) {
            return res.status(400).json({ success: false, message: "Quantity must be a non-negative integer" });
        }
        if (!data.color || data.color.trim() === "") {
            return res.status(400).json({ success: false, message: "Color is required" });
        }

        // Check for duplicate product
        const existingProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${data.productName.trim()}$`, "i") },
            _id: { $ne: id },
        });
        if (existingProduct) {
            return res.status(400).json({ success: false, message: "Product name already exists" });
        }

        // Find category
        const category = await Category.findById(data.category);
        if (!category) {
            return res.status(400).json({ success: false, message: "Invalid category" });
        }

        // Process images
        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                images.push(req.files[i].filename);
            }
        }

        if (data.images) {
            let imagesArray = Array.isArray(data.images)
                ? data.images
                : typeof data.images === "object"
                ? Object.values(data.images)
                : typeof data.images === "string"
                ? [data.images]
                : [];
            for (let i = 0; i < imagesArray.length; i++) {
                if (typeof imagesArray[i] === "string" && imagesArray[i].startsWith("data:image")) {
                    const base64Data = imagesArray[i].split(",")[1];
                    const filename = `cropped_${Date.now()}_${i}.jpg`;
                    const filePath = path.join("public", "Uploads", filename);
                    await fs.writeFile(filePath, base64Data, "base64");
                    images.push(filename);
                }
            }
        }

        // Calculate sale price based on offers
        const categoryOffer = parseFloat(category.categoryOffer) || 0;
        const effectiveOffer = Math.max(productOffer, categoryOffer);
        const salePrice = regularPrice * (1 - effectiveOffer / 100);

        // Update product fields
        const updateFields = {
            productName: data.productName,
            description: data.description,
            regularPrice: regularPrice,
            salePrice: salePrice,
            productOffer: productOffer,
            quantity: quantity,
            size: data.size || "",
            color: data.color,
            category: category._id,
        };

        if (images.length > 0) {
            updateFields.$push = { productImage: { $each: images } };
        }

        await Product.findByIdAndUpdate(id, updateFields, { new: true });

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
        });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({
            success: false,
            message: "Server error while updating product",
        });
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, ProductIdToServer } = req.body;

        const product = await Product.findByIdAndUpdate(
            ProductIdToServer,
            { $pull: { productImage: imageNameToServer } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const imagePath = path.join("public", "Uploads", imageNameToServer);
        if (await fs.access(imagePath).then(() => true).catch(() => false)) {
            await fs.unlink(imagePath);
            console.log("Image deleted:", imageNameToServer);
        } else {
            console.log("Image not found:", imageNameToServer);
        }

        res.status(200).json({ success: true, message: "Image deleted successfully" });
    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(500).json({ success: false, message: "Server error while deleting image" });
    }
};

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    editProduct,
    deleteSingleImage,
    getEditProduct,
};