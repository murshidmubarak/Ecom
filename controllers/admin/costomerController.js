const { search, render } = require("../../app");
const User = require("../../models/userSchema");



/* const costomerInfo = async(req,res)=>{
          try {
            let serach = ""

            if(req.query.serach){
                search = req.query.search
            }
            let page = 1;

            if(req.query.page){
                page = req.page.query
            }

            const limit = 3

            const userData = await User.find({
                isAdmin:false,
                $or:[
                    {name:{$regex:".*"+search+".*"}},
                    {email:{$regex:".*"+search+".*"}}
                ]
            })
            .limit(limit*1)
            .skip((page-1)*limit)
            .exec();

            const count = await User.find({
                isAdmin:false,
                $or:[
                    {name:{$regex:".*"+search+".*"}},
                    {email:{$regex:".*"+search+".*"}}
                ],
            }).countDocuments();

            res.rende('customers')

          } catch (error) {
            
          }
} */

/*            const costomerInfo = async (req, res) => {
            try {
                let search = "";
        
                if (req.query.search) {
                    search = req.query.search;
                }
        
                let page = 1;
                if (req.query.page) {
                    page = req.query.page;
                }
        
                const limit = 3;
        
                const userData = await User.find({
                    isAdmin: false,
                    $or: [
                        { name: { $regex: ".*" + search + ".*", $options: "i" } },
                        { email: { $regex: ".*" + search + ".*", $options: "i" } }
                    ]
                })
                .limit(limit)
                .skip((page - 1) * limit)
                .exec();
        
                const count = await User.find({
                    isAdmin: false,
                    $or: [
                        { name: { $regex: ".*" + search + ".*", $options: "i" } },
                        { email: { $regex: ".*" + search + ".*", $options: "i" } }
                    ]
                }).countDocuments();
        
                res.render('customers', { userData, totalPages: Math.ceil(count / limit), currentPage: page });
                
            } catch (error) {
                console.error("Error in customer info controller:", error);
                res.status(500).render('pageerror', {
                    errorCode: 500,
                    errorMessage: "Internal Server Error"
                });
            }
        };  
 */


        const costomerInfo = async (req, res) => {
            try {
                let search = "";
        
                // Get the search query from the request
                if (req.query.search) {
                    search = req.query.search;
                }
        
                // Get the page number from the request (default to 1)
                let page = 1;
                if (req.query.page) {
                    page = parseInt(req.query.page);
                }
        
                // Set the limit for pagination
                const limit = 6;
        
                // Fetch users based on search and pagination
                const userData = await User.find({
                    isAdmin: false, // Exclude admin users
                    $or: [
                        { name: { $regex: ".*" + search + ".*", $options: "i" } }, // Case-insensitive search for name
                        { email: { $regex: ".*" + search + ".*", $options: "i" } } // Case-insensitive search for email
                    ]
                })
                .sort({ createdOn: -1 })
                .limit(limit) // Limit the number of results per page
                .skip((page - 1) * limit) // Skip results for pagination
                .exec();
        
                // Count total number of matching users for pagination
                const count = await User.find({
                    isAdmin: false,
                    $or: [
                        { name: { $regex: ".*" + search + ".*", $options: "i" } },
                        { email: { $regex: ".*" + search + ".*", $options: "i" } }
                    ]
                }).countDocuments();
        
                // Render the EJS template with user data and pagination details
                res.render('customers', {
                    users: userData, // Pass user data to the template
                    totalPages: Math.ceil(count / limit), // Calculate total pages
                    currentPage: page, // Pass current page number
                    search: search // Pass search query for the search bar
                });
        
            } catch (error) {
                console.error("Error in customer info controller:", error);
                res.status(500).render('pageerror', {
                    errorCode: 500,
                    errorMessage: "Internal Server Error"
                });
            }
        };
        
        // Block/Unblock user
/*         const toggleBlockUser = async (req, res) => {
            try {
                const userId = req.params.id;
                const { block } = req.body;
        
                // Find the user by ID and update their block status
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
        
                user.isBlocked = block; // Update block status
                await user.save(); // Save the updated user
        
                res.json({ success: true }); // Send success response
        
            } catch (error) {
                console.error("Error in toggleBlockUser controller:", error);
                res.status(500).json({ success: false, message: 'Server Error' });
            }
        }; */


        const toggleBlockUser = async (req, res) => {
            try {
                const userId = req.params.id;
                const { block } = req.body;
        
                // Find the user by ID and update their block status
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
        
                user.isBlocked = block;
                await user.save();
        
                res.json({ success: true });
        
            } catch (error) {
                console.error("Error in toggleBlockUser controller:", error);
                res.status(500).json({ success: false, message: 'Server Error' });
            }
        };
        



    
        
      
        
        





module.exports ={
    costomerInfo,toggleBlockUser
}