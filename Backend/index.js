// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import githubRoutes from "./routes/github.js";
import { fetchAndStoreGlobalIssues } from "./controllers/githubController.js";

dotenv.config();
const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB error:", err));

// Routes
app.use("/api/github", githubRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// 🔁 Start recurring fetch every 50 seconds
setInterval(() => {
  fetchAndStoreGlobalIssues();
}, 50 * 1000);

// Initial fetch
fetchAndStoreGlobalIssues();
