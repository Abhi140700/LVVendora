import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const DEFAULT_USERS = [
  { username: "superadmin", password: "superadmin123", role: "superadmin" },
  { username: "admin", password: "admin123", role: "admin" },
  { username: "sales", password: "sales123", role: "sales" },
  { username: "stock", password: "stock123", role: "stock" },
  { username: "accounts", password: "accounts123", role: "accountant" }
];

const seedUsers = async () => {
  await connectDB();

  for (const userData of DEFAULT_USERS) {
    const existing = await User.findOne({ username: userData.username });
    if (existing) {
      console.log(`Skipping existing user: ${userData.username}`);
      continue;
    }

    await User.create(userData);
    console.log(`Created user: ${userData.username}`);
  }

  process.exit(0);
};

seedUsers().catch((error) => {
  console.error("Failed to seed users", error);
  process.exit(1);
});
