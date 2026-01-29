const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { encrypt } = require('../utils/crypto');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const registerUser = async (req, res) => {
    const { name, email, password, turfName } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password, turfName });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            turfName: user.turfName,
            address: user.address,
            phone: user.phone,
            token: generateToken(user._id),
            emailConfig: user.emailConfig // Will be empty/default
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            turfName: user.turfName,
            address: user.address,
            phone: user.phone,
            token: generateToken(user._id),
            // Don't send back the encrypted pass for security or if needed, send masked
            emailConfig: {
                user: user.emailConfig?.user,
                // Do not return pass
            }
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.turfName = req.body.turfName || user.turfName;
            user.address = req.body.address || user.address;
            user.phone = req.body.phone || user.phone;

            if (req.body.password) {
                user.password = req.body.password;
            }

            if (req.body.emailConfig) {
                const { user: emailUser, pass: emailPass } = req.body.emailConfig;
                if (!user.emailConfig) user.emailConfig = {};

                if (emailUser) user.emailConfig.user = emailUser;

                // Only encrypt if emailPass is a string (new password)
                if (emailPass && typeof emailPass === 'string') {
                    const encryptedPass = encrypt(emailPass);
                    if (encryptedPass) {
                        user.emailConfig.pass = encryptedPass;
                    }
                }
            }

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                turfName: updatedUser.turfName,
                address: updatedUser.address,
                phone: updatedUser.phone,
                token: generateToken(updatedUser._id),
                emailConfig: {
                    user: updatedUser.emailConfig?.user
                }
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = { registerUser, loginUser, updateProfile };
