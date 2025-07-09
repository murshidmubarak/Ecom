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
            callbackURL: "https://malefashion.ddns.net/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log("Google Profile:", profile);

                if (!profile.emails || profile.emails.length === 0) {
                    return done(new Error("No email found in Google profile"), null);
                }

                const email = profile.emails[0].value;
                let user = await User.findOne({ email });
                console.log("Existing user:", user);
                
                if (!user) {
                    const hashPassword = await bcrypt.hash(profile.displayName, 10);

                    // Create new user and assign to the same 'user' variable
                    user = new User({
                        name: profile.displayName,
                        email: email, 
                        password: hashPassword,
                    });

                    await user.save();
                    console.log("New user created with ID:", user._id);
                    console.log("User saved to database:", user);
                } else {
                    console.log("Existing user found with ID:", user._id);
                }

                // Return the user (whether existing or newly created)
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