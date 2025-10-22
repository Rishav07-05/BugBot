import express from "express";
import {
  githubLogin,
  githubCallback,
  fetchLiveIssues,
  checkConnection,
  getStoredGlobalIssues,
  getStoredIssues, // Add this import
} from "../controllers/githubController.js";
import { getAssignedIssues } from "../utils/aiProcessor.js";
import { debugGlobalIssues } from "../controllers/githubController.js";
import { fixMissingFields } from "../controllers/githubController.js";

const router = express.Router();

router.get("/login", githubLogin);
router.get("/callback", githubCallback);
router.get("/status", checkConnection);
router.get("/global", getStoredGlobalIssues);
router.get("/debug", debugGlobalIssues);
router.get("/issues", getStoredIssues); // Add this route for user issues
router.get("/fix-fields", fixMissingFields);
router.get("/assigned", async (req, res) => {
  try {
    const assigned = await getAssignedIssues();
    res.json(assigned);
  } catch (err) {
    console.error("Error fetching assigned issues:", err.message);
    res.status(500).json({ error: "Failed to fetch assigned issues" });
  }
});

export default router;
