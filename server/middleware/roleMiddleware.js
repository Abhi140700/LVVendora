export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: "Access denied: insufficient permissions" });
        }
        if (req.user.role === "superadmin") {
            return next();
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied: insufficient permissions" });
        }
        next();
    };
};
