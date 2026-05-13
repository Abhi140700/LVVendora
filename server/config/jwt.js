import jwt from "jsonwebtoken";

const generateToken = (id, role, tokenVersion = 0) => {
    return jwt.sign({ id, role, ver: Number(tokenVersion || 0) }, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
};

export default generateToken;
