const express = require("express");
const app = express();
const path = require("path")
const fs = require("fs")
const env = require("dotenv").config();
const session = require("express-session")
const nocache=require('nocache')
 
const db = require("./config/db");
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter");
const passport = require('passport')
require('./config/passport');
db();


app.use(express.json())
app.use(express.urlencoded({ extended: true }));
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