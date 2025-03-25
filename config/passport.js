const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/userSchema'); // Ensure path is correct
require('dotenv').config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3001/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log("Google Profile:", profile);

                if (!profile.emails || profile.emails.length === 0) {
                    return done(new Error("No email found in Google profile"), null);
                }

                const email = profile.emails[0].value;
                let user = await User.findOne({ email });
                        console.log("Usessssssssssssssssssssssssssssr:", user);
                        
                if (!user) {
                    const hashPassword = await bcrypt.hash(profile.displayName, 10);

                    let newUser = new User({
                        name: profile.displayName,
                        email: email, 
                        password: hashPassword,
                    });

                    await newUser.save();
                console.log("New Usersssssssssssssssssssssssssssss:", newUser);
                
                   
                }

                return done(null, user);
            } catch (error) {
                console.error("Google Auth Error:", error.message);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});
