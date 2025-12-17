const express = require("express");
const app = express();
const path = require("path")
const fs = require("fs")
const env = require("dotenv").config();
const session = require("express-session")
const nocache=require('nocache')
const csurf = require("csurf");
const cookieParser = require("cookie-parser");
 
const db = require("./config/db");
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter");
const passport = require('passport')
require('./config/passport');
db();


app.use(express.json())
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized : true,
    cookie:{
        secure:false,
        httpOnly:true,
        sameSite:"lax",
        maxAge:72*60*66*1000,
    }
}))



const csrfProtection = csurf({ cookie: true });

// Exclude specific routes from CSRF (like Google OAuth)
const csrfExcludedRoutes = [
  "/auth/google",
  "/auth/google/callback"
];

// Apply CSRF conditionally
app.use((req, res, next) => {
  if (csrfExcludedRoutes.includes(req.path)) {
    return next(); // Skip CSRF for these routes
  }
  csrfProtection(req, res, next); // Apply CSRF to others
});

// Make token available in EJS views
app.use((req, res, next) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});


// Optional: CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    // return res.status(403).render("csrfError", { message: "Invalid CSRF token" });
    // return res.status(403).render("csrfError", { message: "Invalid CSRF token" });
   console.log('req.body._csrf:', res.locals.csrfToken);


    return res.status(403).json({success: false, message: "Invalid CSRF token" });

  }
  next(err);
});

app.use(passport.initialize());
app.use(passport.session());
app.use(nocache())


app.set("view engine","ejs");
//app.set("views", path.join(_dirname, "views/user"),path.join(_dirname, "views/admin"));

app.set("views", [
    path.join(__dirname, "views/user"),
    path.join(__dirname, "views/admin")
]);


const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}



app.use(express.static(path.join(__dirname,"public")))




app.use("/",userRouter);
app.use("/admin",adminRouter);
const PORT = process.env.PORT || 3000

app.use((req,res)=>{
    res.status(404).render('page404')
})


app.listen(process.env.PORT,()=>{
    console.log("server running");
    
})

module.exports = app;