import User from "../models/User.js";

const DEFAULT_USERS = [
  { username: "superadmin", password: "superadmin123", role: "superadmin" },
  { username: "admin", password: "admin123", role: "admin" },
  { username: "sales", password: "sales123", role: "sales" },
  { username: "stock", password: "stock123", role: "stock" },
  { username: "accounts", password: "accounts123", role: "accountant" }
];

export const ensureDefaultUsers = async () => {
  if (process.env.ALLOW_RUNTIME_BOOTSTRAP_USERS !== "true") {
    return;
  }

  for (const userData of DEFAULT_USERS) {
    const existing = await User.findOne({ username: userData.username });
    if (existing) {
      continue;
    }

    await User.create(userData);
    console.log(`Bootstrapped user: ${userData.username}`);
  }
};
