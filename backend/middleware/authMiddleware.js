const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(" ")[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from database (excluding password)
            const user = await User.findById(decoded.userId).select("-password");

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Not authorized, user no longer exists",
                });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error("Auth middleware validation error:", error.message);
            return res.status(401).json({
                success: false,
                message: "Not authorized, token failed",
            });
        }
    } else {
        return res.status(401).json({
            success: false,
            message: "Not authorized, no token",
        });
    }
};

module.exports = authMiddleware;
