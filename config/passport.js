const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/userSchema'); // Ensure path is correct
require('dotenv').config();


async function generateUniqueReferralCode() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const existingUser = await User.findOne({ referalCode: code });
        if (!existingUser) {
           
            return code;
        }
        attempts++;
    }
    throw new Error("Unable to generate unique referral code after multiple attempts");
}

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
                    const referralCode = await generateUniqueReferralCode();

                    // Create new user and assign to the same 'user' variable
                    user = new User({
                        name: profile.displayName,
                        email: email, 
                        password: hashPassword,
                        referalCode: referralCode,
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