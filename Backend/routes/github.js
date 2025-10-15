import express from "express";
import {
  githubLogin,
  githubCallback,
  fetchLiveIssues,
  checkConnection,
  getStoredGlobalIssues, // <-- updated
} from "../controllers/githubController.js";
import { getAssignedIssues } from "../utils/aiProcessor.js";

const router = express.Router();

router.get("/login", githubLogin);
router.get("/callback", githubCallback);
router.get("/status", checkConnection);
router.get("/global", getStoredGlobalIssues); // <-- updated
router.get("/assigned", async (req, res) => {
  try {
    const assigned = await getAssignedIssues();
    res.json(assigned);
  } catch (err) {
    console.error("Error fetching assigned issues:", err.message);
    res.status(500).json({ error: "Failed to fetch assigned issues" });
  }
});
router.get("/issues", fetchLiveIssues);

export default router;
