const Category = require("../../models/categorySchema");
const Product  = require("../../models/productSchema");
const mongoose = require("mongoose");






/*

const categorInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = 4; // Number of categories per page
        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        // Fetch categories with pagination
        const categoryData = await Category.find({})
            .sort({ createdAt: -1 }) // Sort by creation date in descending order
            .skip(skip) // Skip documents for pagination
            .limit(limit); // Limit the number of documents per page

        // Count total number of categories
        const totalCategories = await Category.countDocuments();

        // Calculate total pages
        const totalPages = Math.ceil(totalCategories / limit);

        // Render the category view with data
        res.render("category", {
            cat: categoryData, // Pass category data to the view
            currentPage: page, // Pass current page number
            totalPages: totalPages, // Pass total number of pages
            totalCategories: totalCategories // Pass total number of categories
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageerror"); // Redirect to error page in case of an error
    }
};


const addCategory = async(req,res)=>{
     const {name,description} = req.body;

     try {
        
       const existingCategory = await Category.findOne({name});
       if(existingCategory){
        return res.status(400).json({error:"category aleady exist"});
       }

       const newCategory = new Category({
        name,
        description,
       })

       await newCategory.save();
       return res.json({message:"category added successfully"})

     } catch (error) {
        return res.status(500).json({error:"server error"})
     }
} */


     const categorInfo = async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1; 
            const limit = 4; 
            const skip = (page - 1) * limit; 
    
            // Fetch categories with pagination
            const categoryData = await Category.find({})
                .sort({ createdAt: -1 }) // Sort by creation date in descending order
                .skip(skip) // Skip documents for pagination
                .limit(limit); // Limit the number of documents per page
    
            // Count total number of categories
            const totalCategories = await Category.countDocuments();
    
            // Calculate total pages
            const totalPages = Math.ceil(totalCategories / limit);
    
           const csrfToken = req.csrfToken ? req.csrfToken() : null; // Get CSRF token if available
            res.render("category", {
                csrfToken, // Pass CSRF token to the view
                cat: categoryData, 
                currentPage: page,
                totalPages: totalPages, 
                totalCategories: totalCategories 
            });
    
        } catch (error) {
            console.error(error);
            res.redirect("/pageerror"); 
        }
    };
    
    const addCategory = async (req, res) => {
        const { name, description } = req.body;
    
        try {
            
            
           
            const existingCategory = await Category.findOne({ name: {$regex: `^${name}`, $options:'i'}});
            if (existingCategory) {
                return res.status(400).json({ error: "Category already exists" });
            }
    
            
            const newCategory = new Category({
                name,
                description,
            });
    
        
            await newCategory.save();
    
           
            return res.json({ success: true, message: "Category added successfully" });

    
        } catch (error) {
            console.log('dupli')
            console.error("any error",error);
            return res.status(500).json({ error: "Server error" });
        }
    };



    const searchCategory = async (req, res) => {
        const {search} =req.body; // Corrected search query extraction
       console.log(search)
    
        if (!search) {
            return res.render('category', { 
                categories: [], 
                message: 'Please enter a search term.'
            });
        }
    
        try {
            const categories = await Category.find({
                name: { $regex: search, $options: 'i' } 
            });
    
            console.log(categories);
            const csrfToken = req.csrfToken ? req.csrfToken() : null; // Get CSRF token if available
    
            res.render('category', { 
                csrfToken, // Pass CSRF token to the view 
                cat:categories,  
                message: categories.length ? '' : 'No categories found',
                currentPage: 1,
                totalPages: 1 
            });
    
        } catch (error) {
            console.error('Search Error:', error);
            res.status(500).render('category', { 
                categories: [], 
                message: 'Error fetching categories.' 
            });
        }
    };
    

 /*    const addCategoryOffer = async (req, res) => {
        try {
            const { percentage, categoryId } = req.body;
            console.log("addCategoryOffer - Request Body:", { percentage, categoryId });
    
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                console.log("Invalid category ID:", categoryId);
                return res.status(400).json({ status: false, message: "Invalid category ID" });
            }
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                console.log("Invalid percentage:", percentage);
                return res.status(400).json({ status: false, message: "Percentage must be between 0 and 100" });
            }
    
            const category = await Category.findById(categoryId);
            if (!category) {
                console.log("Category not found for ID:", categoryId);
                return res.status(404).json({ status: false, message: "Category not found" });
            }
    
            const products = await Product.find({ category: category._id });
            console.log("Products found:", products.length);
    
            const hasHigherProductOffer = products.some(
                (product) => parseInt(product.productOffer) > percentage
            );
            if (hasHigherProductOffer) {
                console.log("Higher product offer detected");
                return res.status(400).json({
                    status: false,
                    message: "Some products have a higher individual offer",
                });
            }
    
            await Category.updateOne(
                { _id: categoryId },
                { $set: { categoryOffer: percentage } }
            );
            console.log("Category offer updated to:", percentage);
    
            for (const product of products) {
                product.productOffer = "0";
                product.salePrice = Math.floor(product.regularPrice * (1 - percentage / 100));
                await product.save();
                console.log(`Product ${product._id} updated - salePrice: ${product.salePrice}`);
            }
    
            return res.status(200).json({
                status: true,
                message: `Category offer of ${percentage}% added successfully`,
            });
        } catch (error) {
            console.error("addCategoryOffer - Error:", error.message, error.stack);
            return res.status(500).json({ status: false, message: "Internal server error" });
        }
    }; */


    const addCategoryOffer = async (req, res) => {
        try {
            const { percentage, categoryId } = req.body;
            console.log("addCategoryOffer - Request Body:", { percentage, categoryId });
    
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                console.log("Invalid category ID:", categoryId);
                return res.status(400).json({ status: false, message: "Invalid category ID" });
            }
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                console.log("Invalid percentage:", percentage);
                return res.status(400).json({ status: false, message: "Percentage must be between 0 and 100" });
            }
    
            const category = await Category.findById(categoryId);
            if (!category) {
                console.log("Category not found for ID:", categoryId);
                return res.status(404).json({ status: false, message: "Category not found" });
            }
    
            const products = await Product.find({ category: category._id });
            console.log("Products found:", products.length);
    
            // Update category offer
            await Category.updateOne(
                { _id: categoryId },
                { $set: { categoryOffer: percentage } }
            );
            console.log("Category offer updated to:", percentage);
    
            // Update products: apply category offer only if productOffer is lower
            for (const product of products) {
                const productOffer = parseFloat(product.productOffer) || 0;
                const effectiveOffer = Math.max(productOffer, percentage);
                product.salePrice = Math.floor(product.regularPrice * (1 - effectiveOffer / 100));
                // Do not reset productOffer to preserve higher offers
                await product.save();
                console.log(`Product ${product._id} updated - salePrice: ${product.salePrice}, effectiveOffer: ${effectiveOffer}%`);
            }
    
            return res.status(200).json({
                status: true,
                message: `Category offer of ${percentage}% added successfully`,
            });
        } catch (error) {
            console.error("addCategoryOffer - Error:", error.message, error.stack);
            return res.status(500).json({ status: false, message: "Internal server error" });
        }
    };


/*     const removeCategoryOffer = async (req, res) => {
        try {
            const { categoryId } = req.body;
            console.log("removeCategoryOffer - Request Body:", { categoryId });
    
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                console.log("Invalid category ID:", categoryId);
                return res.status(400).json({ status: false, message: "Invalid category ID" });
            }
    
            const category = await Category.findById(categoryId);
            if (!category) {
                console.log("Category not found for ID:", categoryId);
                return res.status(404).json({ status: false, message: "Category not found" });
            }
    
            if (category.categoryOffer === 0) {
                console.log("No offer to remove for category:", categoryId);
                return res.status(400).json({ status: false, message: "No offer exists for this category" });
            }
    
            const products = await Product.find({ category: category._id });
            console.log("Products found:", products.length);
    
            category.categoryOffer = 0;
            await category.save();
            console.log("Category offer reset to 0");
    
            for (const product of products) {
                product.productOffer = "0";
                product.salePrice = product.regularPrice;
                await product.save();
                console.log(`Product ${product._id} reset - salePrice: ${product.salePrice}`);
            }
    
            return res.status(200).json({
                status: true,
                message: "Category offer removed successfully",
            });
        } catch (error) {
            console.error("removeCategoryOffer - Error:", error.message, error.stack);
            return res.status(500).json({ status: false, message: "Internal server error" });
        }
    }; */


    const removeCategoryOffer = async (req, res) => {
        try {
            const { categoryId } = req.body;
            console.log("removeCategoryOffer - Request Body:", { categoryId });
    
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                console.log("Invalid category ID:", categoryId);
                return res.status(400).json({ status: false, message: "Invalid category ID" });
            }
    
            const category = await Category.findById(categoryId);
            if (!category) {
                console.log("Category not found for ID:", categoryId);
                return res.status(404).json({ status: false, message: "Category not found" });
            }
    
            if (category.categoryOffer === 0) {
                console.log("No offer to remove for category:", categoryId);
                return res.status(400).json({ status: false, message: "No offer exists for this category" });
            }
    
            const products = await Product.find({ category: category._id });
            console.log("Products found:", products.length);
    
            // Reset category offer
            category.categoryOffer = 0;
            await category.save();
            console.log("Category offer reset to 0");
    
            // Update products: use productOffer if it exists, else revert to regularPrice
            for (const product of products) {
                const productOffer = parseFloat(product.productOffer) || 0;
                if (productOffer > 0) {
                    product.salePrice = Math.floor(product.regularPrice * (1 - productOffer / 100));
                } else {
                    product.salePrice = product.regularPrice;
                }
                await product.save();
                console.log(`Product ${product._id} updated - salePrice: ${product.salePrice}`);
            }
    
            return res.status(200).json({
                status: true,
                message: "Category offer removed successfully",
            });
        } catch (error) {
            console.error("removeCategoryOffer - Error:", error.message, error.stack);
            return res.status(500).json({ status: false, message: "Internal server error" });
        }
    };

    
    const getCategoryPage = async (req, res) => {
        try {
            const categories = await Category.find({}); // Fetch all categories
            const csrfToken = req.csrfToken ? req.csrfToken() : null; // Get CSRF token if available
            res.render("admin/category", { categories, csrfToken }); // Render the EJS template
        } catch (error) {
            console.error(error);
            res.redirect("/pageerror");
        }
    };
    
   /*  const getListedCategory = async (req, res) => {
        try {
            let id = req.query.id;
            await Category.updateOne({ _id: id }, { $set: { isListed: true } });
            res.redirect("/admin/categories");
        } catch (error) {
            console.error(error);
            res.redirect("/pageerror");
        }
    }; */
    
    /* const getUnlistedCategory = async (req, res) => {
        try {
            let id = req.query.id;
            await Category.updateOne({ _id: id }, { $set: { isListed: false } });
            res.redirect("/admin/categories");
        } catch (error) {
            console.error(error);
            res.redirect("/pageerror");
        }
    }; */


    const getListedCategory = async (req, res) => {
        try {
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({ success: false, message: "Category ID is required" });
            }
    
            const updatedCategory = await Category.updateOne(
                { _id: id },
                { $set: { isListed: true } }
            );
    
            if (updatedCategory.n === 0) {
                return res.status(404).json({ success: false, message: "Category not found" });
            }
            if (updatedCategory.nModified === 0) {
                return res.status(200).json({ success: true, message: "Category already listed" });
            }
    
            res.status(200).json({ success: true, message: "Category listed successfully" });
        } catch (error) {
            console.error("Error listing category:", error);
            res.status(500).json({ success: false, message: "Server error while listing category" });
        }
    };

    const getUnlistedCategory = async (req, res) => {
        try {
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({ success: false, message: "Category ID is required" });
            }
    
            const updatedCategory = await Category.updateOne(
                { _id: id },
                { $set: { isListed: false } }
            );
    
            if (updatedCategory.n === 0) {
                return res.status(404).json({ success: false, message: "Category not found" });
            }
            if (updatedCategory.nModified === 0) {
                return res.status(200).json({ success: true, message: "Category already unlisted" });
            }
    
            res.status(200).json({ success: true, message: "Category unlisted successfully" });
        } catch (error) {
            console.error("Error unlisting category:", error);
            res.status(500).json({ success: false, message: "Server error while unlisting category" });
        }
    };
/*     const getEditCategory = async(req,res)=>{
        try {
            const id = req.query.id;
            const category = await Category.findOne({_id:id}); 
            res.render("edit-category",{category:category});
            
        } catch (error) {
            console.error(error);
            res.redirect("/pageerror");
        }
    }
 */
/*     const editCategory = async (req, res) => {
        try {
            const id = req.params.id;
            const { categoryName, description } = req.body;
            console.log(req.body)
    
            // Check if a category with the same name already exists (excluding the current category)
            const existingCategory = await Category.findOne({ name: categoryName, _id: { $ne: id } });
    
            if (existingCategory) {
                return res.status(400).json({ error: "Category already exists" });
            }
    
            // Update the category
            const updateCategory = await Category.findByIdAndUpdate(
                id,
                { name: categoryName, description: description },
                { new: true }
            );
    
            if (!updateCategory) {
                return res.status(404).json({ error: "Category not found" });
            }
    
            // Return success response
            res.redirect("/admin/categories");
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Server error" });
        }
    }; */


    const getEditCategory = async (req, res) => {
        try {
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({ success: false, error: "Category ID is required" });
            }
    
            const category = await Category.findOne({ _id: id });
            if (!category) {
                return res.status(404).json({ success: false, error: "Category not found" });
            }
    
            res.status(200).json({ success: true, category });
        } catch (error) {
            console.error("Error fetching category:", error);
            res.status(500).json({ success: false, error: "Server error" });
        }
    };

    const editCategory = async (req, res) => {
        try {
            const id = req.params.id;
            const { categoryName, description } = req.body;
    
            if (!categoryName || !description) {
                return res.status(400).json({ success: false, error: "Name and description are required" });
            }
    
            // Check if a category with the same name already exists (excluding the current category)
            const existingCategory = await Category.findOne({ name: {$regex: `^${categoryName}`, $options:'i'}, _id: { $ne: id } });
            if (existingCategory) {
                return res.status(400).json({ success: false, error: "Category already exists" });
            }
    
            // Update the category
            const updatedCategory = await Category.findByIdAndUpdate(
                id,
                { name: categoryName, description: description },
                { new: true }
            );
    
            if (!updatedCategory) {
                return res.status(404).json({ success: false, error: "Category not found" });
            }
    
            // Return success response
            res.status(200).json({ success: true, message: "Category updated successfully" });
        } catch (error) {
            console.error("Error updating category:", error);
            res.status(500).json({ success: false, error: "Server error" });
        }
    };
    
module.exports ={
    categorInfo,addCategory,searchCategory,addCategoryOffer,removeCategoryOffer,getListedCategory,getUnlistedCategory,
    getCategoryPage,getEditCategory,editCategory
}