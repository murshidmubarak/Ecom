const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
   
    
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); 
    },
    filename: (req, file, cb) => {
        const namePrefix = Date.now();
        const ext = path.extname(file.originalname)
        const newName = namePrefix + ext; 
        cb(null, newName);
    }
 });

 const upload = multer({ storage });

    module.exports = upload;


  /*   const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join('public', 'uploads', 're-image');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const namePrefix = Date.now();
        const ext = path.extname(file.originalname) || '.jpg'; // Default to jpg if no extension
        const newName = `${namePrefix}${ext}`; 
        cb(null, newName);
    }
});

// File filter to validate uploads
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

module.exports = upload; */