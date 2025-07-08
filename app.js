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
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized : true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*66*1000
    }
}))

// const csrfProtection = csurf({ cookie: true });
// app.use((req, res, next) => {
//   csrfProtection(req, res, (err) => {
//     if (err && err.code === "EBADCSRFTOKEN") {
//       return res.status(403).json({ message: "Invalid CSRF token" });
//     }
//     res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
//     next(err);
//   });
// });
// const csrfProtection = csurf({ cookie: true });

// // Apply csrf middleware globally
// app.use(csrfProtection);

// // Make token available in EJS views
// app.use((req, res, next) => {
//   res.locals.csrfToken = req.csrfToken();
//   next();
// });

const csrfProtection = csurf({ cookie: true });

// ⛔ Skip CSRF for Google OAuth routes
app.use((req, res, next) => {
  const csrfExcludedRoutes = [
    "/auth/google",
    "/auth/google/callback"
  ];

  if (csrfExcludedRoutes.includes(req.path)) {
    return next(); // Skip CSRF protection for these routes
  }

  csrfProtection(req, res, next); // Apply CSRF to all other routes
});

// ✅ Attach CSRF token to views
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
//app.set("views", path.join(__dirname, "views/user"),path.join(__dirname, "views/admin"));

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