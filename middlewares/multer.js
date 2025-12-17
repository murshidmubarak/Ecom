const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Added to create directories

// Dynamic storage configuration based on file purpose
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'public/uploads';
        // Determine destination based on route
        if (req.route && req.route.path === '/uploadProfilePhoto') {
            uploadPath = 'public/uploads/profiles';
            // Create directory if it doesn't exist
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
        } else if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const namePrefix = Date.now();
        const ext = path.extname(file.originalname);
        const newName = namePrefix + '-' + file.originalname.replace(/\s/g, '_');
        cb(null, newName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG, GIF) are allowed'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload; // Export a single Multer instance

 