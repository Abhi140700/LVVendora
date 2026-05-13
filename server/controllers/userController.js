import User from "../models/User.js";

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });
  }
};

// Create user (Admin)
export const createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required"
      });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const user = await User.create({
      username,
      password,
      role
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Create User Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create user"
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete user"
    });
  }
};