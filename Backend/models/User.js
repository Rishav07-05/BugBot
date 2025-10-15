import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: false }, // optional if you use Clerk
  githubUsername: String,
  githubToken: String,
});

const User = mongoose.model("User", userSchema);
export default User;
