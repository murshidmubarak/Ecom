const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const path = require("path");
const sharp = require("sharp");
const fs = require('fs');

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render("product-add", {
            cat: category
        });
    } catch (error) {
        res.redirect("/pageerror");
    }
}

/* const addProducts = async (req, res) => {
    try {
        console.log(req.body);

        const products = req.body;
        const images = [];

        // Check if files were uploaded
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join('public', 'uploads', 'resized-' + req.files[i].filename);

                // Resize the image and save it
                await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
                images.push('resized-' + req.files[i].filename);
            }
        }

        // Find the category ID based on the category name
        const categoryId = await Category.findOne({ name: products.category });

        if (!categoryId) {
            return res.status(400).json('Invalid category name');
        }

        // Create a new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            createdOn: new Date(),
            quantity: products.quantity,
            size: products.size,
            color: products.color,
            productImage: images,
        });

        // Save the new product to the database
        await newProduct.save();
        console.log("Product Saved");

        res.redirect("/admin/products");

    } catch (error) {
        console.error("Error Saving product", error);
        res.redirect("/admin/pageerror");
    }
} */

    const addProducts = async (req, res) => {
        try {
            console.log(req.body);
    
            const products = req.body;
            
        
            // Check if product with the same name already exists (case-insensitive)
            const existingProduct = await Product.findOne({ 
                productName: { 
                    $regex: new RegExp(`^${products.productName.trim()}$`, 'i') 
                } 
            });
    
            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: 'A product with this name already exists'
                });
            }
            const images = [];
    
            // Check if files were uploaded
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'resized-' + req.files[i].filename);
    
                    // Resize the image and save it
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                    images.push('resized-' + req.files[i].filename);
                }
            }
    
            // Find the category ID based on the category name
            const categoryId = await Category.findOne({ name: products.category });
    
            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category name'
                });
            }
    
            // Create a new product
            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                productImage: images,
            });
    
            // Save the new product to the database
            await newProduct.save();
            console.log("Product Saved");
    
            // Return success response
            res.status(200).json({
                success: true,
                message: 'Product added successfully'
            });
    
        } catch (error) {
            console.error("Error Saving product", error);
            res.status(500).json({
                success: false,
                message: 'Server error occurred while adding product'
            });
        }
    };


const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || ''; // Get search query from request
        const page = parseInt(req.query.page) || 1; // Get page number from request, default to 1
        const limit = 7; // Number of products per page

        // Fetch products with search, pagination, and populate category
        const productData = await Product.find({
            productName: { $regex: new RegExp(".*" + search + ".*", "i") } // Case-insensitive search
        })
        .sort({ createdAt: -1 })
        .limit(limit) 
        .skip((page - 1) * limit) 
        .populate("category") 
        .exec(); 

      
        const count = await Product.countDocuments({
            productName: { $regex: new RegExp(".*" + search + ".*", "i") }
        });

       
        const category = await Category.find({ isListed: true });

        
        res.render("products", {
            data: productData,
            cat: category,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
        });
    } catch (error) {
        console.error(error); 
        res.status(500).render("pageerror"); 
    }
};

/* const blockProduct = async (req, res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/products"); 
    } catch (error) {
        res.redirect("/pageerror");
    }
} */

/* const unblockProduct = async(req,res)=>{
    try {
        let id = req.query.id;
        await  Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products");
        
        
    } catch (error) {


        res.redirect("/pageerror");
        
    }
} */

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

/* const getEditProduct = async (req, res) => {

    try {
        
        const id = req.query.id;
        const product = await Product.findOne({_id:id});
        const category = await Category.find({isListed:true});
        res.render("product-edit",{
            product:product,
            cat:category
        });


    } catch (error) {
     
        res.redirect("/pageerror");
        
    }

} */

/* const editProduct = async (req, res) => {
    
    try {
        
        const id = req.params.id;
        const product = await Product.findOne({_id:id});
        const data = req.body;
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        })

        if (existingProduct) {
            return res.status(400).json('Product name already exists');
        }
        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
               images.push(req.files[i].filename);

            }
        }
        const updateFields = {
            productName: data.productName,
            description: data.description,
            // category: product.category,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            size: data.size,
            color: data.color,
            
        }

        if (images.length > 0) {
            updateFields.$push = { productImage:{$each:images} };
        }

        await Product.findByIdAndUpdate(id, updateFields,{new:true});
        res.redirect("/admin/products");

        
    } catch (error) {

        console.error(error);
        res.redirect("/pageerror");
        
    }
}
 */
/* const deleteSingleImage = async (req, res) => {
    try {
        const {imageNameToServer,ProductIdToServer} = req.body;
        const product = await Product.findByIdAndDelete(ProductIdToServer,{$pull:{productImage:imageNameToServer}});
        const imagePath = path.join('public', 'uploads', "re-image",imageNameToServer);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log("Image Deleted");
        }else{
            console.log("Image Not Found");
        }
        res.send({status:true});
    } catch (error) {

        console.log("an error occured",error);
        res.redirect("/pageerror");
        
        
    }
}
 */

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({_id: id});
        const category = await Category.find({isListed: true});
        res.render("product-edit", {
            product: product,
            cat: category
        });
    } catch (error) {
        console.error("Error loading edit product page:", error);
        res.redirect("/pageerror");
    }
};

const editProduct = async (req, res) => {
    try {
        console.log('sdfsdf');
        const id = req.params.id;
        const product = await Product.findOne({_id: id});
        const data = req.body;
        const categoryId=await Category.findById(data.category);
        // console.log(" id ",categoryId)
        // console.log('data:', data);
        
        // Check for duplicate product name
       /*  const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json('Product name already exists');
        } */

            const existingProduct = await Product.findOne({
                productName: { $regex: new RegExp(`^${data.productName}$`, 'i') },
                _id: { $ne: id }
            });
            
            if (existingProduct) {
                return res.status(400).json('Product name already exists');
            }
        
        // Process regular uploaded files
        const images = [];
        if (req.files && req.files.length > 0) {
            console.log('req.files:', req.files);
            for (let i = 0; i < req.files.length; i++) {
               images.push(req.files[i].filename);
            }
        }

        if (data.images) {
            let imagesArray = [];
            
            // Handle different possible structures of data.images
            if (Array.isArray(data.images)) {
                imagesArray = data.images; // Already an array
            } else if (typeof data.images === 'object') {
                imagesArray = Object.values(data.images); // Convert object values to array
            } else if (typeof data.images === 'string') {
                imagesArray = [data.images]; // Single string
            }
    
            // Process each base64 string
            for (let i = 0; i < imagesArray.length; i++) {
                const imageData = imagesArray[i];
                if (typeof imageData === 'string' && imageData.indexOf('data:image') === 0) {
                    try {
                        const base64Data = imageData.split(',')[1];
                        const filename = `cropped_${Date.now()}_${i}.jpg`;
                        const filePath = path.join('public', 'uploads', filename);
                        await fs.promises.writeFile(filePath, base64Data, 'base64');
                        images.push(filename);
                    } catch (error) {
                        console.error('Error saving cropped image:', error);
                    }
                }
            }
        }
        
        // Update product fields
        const updateFields = {
            productName: data.productName,
            description: data.description,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            size: data.size,
            color: data.color,
            category: categoryId._id,

        };


        // Add new images if any
        if (images.length > 0) {
            console.log('images:', images);
            updateFields.$push = { productImage: {$each: images} };
        }

        // console.log('updateFields:', updateFields);

        await Product.findByIdAndUpdate(id, updateFields, {new: true});
        res.redirect("/admin/products");
    } catch (error) {
        console.error("Error updating product:", error);
        res.redirect("/pageerror");
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const {imageNameToServer, ProductIdToServer} = req.body;
        
        // Use findByIdAndUpdate with $pull instead of findByIdAndDelete
        const product = await Product.findByIdAndUpdate(
            ProductIdToServer,
            {$pull: {productImage: imageNameToServer}},
            {new: true}
        );
        
        if (!product) {
            return res.send({status: false, message: 'Product not found'});
        }
        
        // Delete the image file from the server
        const imagePath = path.join('public', 'uploads', imageNameToServer);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log("Image Deleted");
        } else {
            console.log("Image Not Found");
        }
        
        res.send({status: true, message: 'Image deleted successfully'});
    } catch (error) {
        console.log("An error occurred", error);
        res.status(500).send({status: false, message: 'Server error'});
    }
};






module.exports = {
    getProductAddPage,
    addProducts,getAllProducts,blockProduct,unblockProduct,editProduct,deleteSingleImage,getEditProduct
}
