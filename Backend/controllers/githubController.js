import axios from "axios";
import cron from "node-cron";
import dayjs from "dayjs";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import GlobalIssue from "../models/GlobalIssue.js";

// ---------------- GITHUB OAUTH ----------------
export const githubLogin = (req, res) => {
  const redirect = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=http://localhost:5000/api/github/callback&scope=repo,user`;
  res.redirect(redirect);
};

export const githubCallback = async (req, res) => {
  const code = req.query.code;
  const clerkId = req.query.userId;

  try {
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const access_token = tokenRes.data.access_token;

    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${access_token}` },
    });

    const { login } = userRes.data;

    await User.findOneAndUpdate(
      { clerkId },
      { githubUsername: login, githubToken: access_token },
      { upsert: true }
    );

    res.redirect(`http://localhost:5173/dashboard?connected=true`);
  } catch (err) {
    console.error("GitHub OAuth Error:", err.message);
    res.status(500).json({ error: "GitHub OAuth failed" });
  }
};

// ---------------- CHECK GITHUB CONNECTION ----------------
export const checkConnection = async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "User ID required" });

  try {
    const user = await User.findOne({ clerkId: userId });
    res.json({ connected: !!user?.githubToken });
  } catch (err) {
    console.error("Error checking GitHub connection:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ---------------- FETCH LIVE ISSUES (USER REPOS) ----------------
export const fetchLiveIssues = async (req, res) => {
  try {
    const users = await User.find({ githubToken: { $exists: true } });
    let allIssues = [];

    for (const user of users) {
      const reposRes = await axios.get("https://api.github.com/user/repos", {
        headers: { Authorization: `token ${user.githubToken}` },
      });

      for (const repo of reposRes.data) {
        const issuesRes = await axios.get(
          `https://api.github.com/repos/${repo.full_name}/issues`,
          { headers: { Authorization: `token ${user.githubToken}` } }
        );

        const mappedIssues = issuesRes.data
          .filter((issue) => !issue.pull_request)
          .map((issue) => ({
            title: issue.title,
            html_url: issue.html_url,
            number: issue.number,
            repo_name: repo.full_name,
            user: issue.user.login,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
          }));

        allIssues = allIssues.concat(mappedIssues);

        for (const i of mappedIssues) {
          await Issue.findOneAndUpdate(
            { html_url: i.html_url },
            { $set: i, $currentDate: { fetchedAt: true } },
            { upsert: true, new: true }
          );
        }
      }
    }

    res.json(
      allIssues.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    );
  } catch (err) {
    console.error("Error fetching live issues:", err.message);
    res.status(500).json({ error: "Failed to fetch live issues" });
  }
};

// ---------------- GLOBAL ISSUES (TIME-BASED PAGINATION) ----------------

// Load tokens from .env and rotate when rate limited
const tokens = process.env.GITHUB_TOKENS?.split(",").map((t) => t.trim()) || [];
let tokenIndex = 0;

function getNextToken() {
  if (tokens.length === 0) throw new Error("No GitHub tokens found in .env");
  tokenIndex = (tokenIndex + 1) % tokens.length;
  return tokens[tokenIndex];
}

// Generate quarterly date ranges automatically
function generateDateRanges(start, monthsPerRange = 3) {
  const ranges = [];
  let current = dayjs(start);

  while (current.isBefore(dayjs())) {
    const end = current.add(monthsPerRange, "month").subtract(1, "day");
    ranges.push([current.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")]);
    current = end.add(1, "day");
  }

  return ranges;
}

export const fetchAndStoreGlobalIssues = async () => {
  try {
    console.log("🌍 Fetching global open issues from GitHub...");

    const allIssues = [];
    const perPage = 100;
    const maxPages = 5; // Reduced to avoid rate limits

    for (let page = 1; page <= maxPages; page++) {
      let success = false;
      let retries = 0;

      while (!success && retries < tokens.length) {
        const token = getNextToken();

        try {
          const response = await axios.get(
            "https://api.github.com/search/issues",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
              params: {
                q: "is:issue is:open sort:updated-desc",
                per_page: perPage,
                page,
              },
            }
          );

          const items = response.data.items || [];
          if (items.length === 0) {
            console.log(`📭 No more issues at page ${page}`);
            break;
          }

          const issues = items.map((issue) => ({
            issueId: issue.id,
            title: issue.title,
            html_url: issue.html_url,
            number: issue.number,
            repo_name:
              issue.repository_url?.split("/").slice(-2).join("/") || "Unknown",
            user: issue.user?.login || "Unknown",
            created_at: new Date(issue.created_at),
            updated_at: new Date(issue.updated_at),
          }));

          allIssues.push(...issues);
          console.log(`✅ Page ${page}: fetched ${issues.length} issues`);
          success = true;

          // Respect GitHub API rate limits
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          if (err.response?.status === 403) {
            console.log(
              `⚠️ Rate limit hit with token ${tokenIndex} — switching...`
            );
            retries++;
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            console.error(`❌ API Error:`, err.response?.data || err.message);
            throw err;
          }
        }
      }

      if (!success) {
        console.log("❌ All tokens exhausted, stopping...");
        break;
      }
    }

    if (allIssues.length === 0) {
      console.log("⚠️ No issues fetched — check tokens or rate limits");
      return;
    }

    // 💾 Store in DB with better error handling
    try {
      const bulkOps = allIssues.map((i) => ({
        updateOne: {
          filter: { issueId: i.issueId },
          update: {
            $set: {
              ...i,
              fetchedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      const result = await GlobalIssue.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `✅ Stored ${allIssues.length} global issues (${result.upsertedCount} new, ${result.modifiedCount} updated)`
      );

      // Clean up old issues (older than 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      await GlobalIssue.deleteMany({ updated_at: { $lt: weekAgo } });
    } catch (dbError) {
      console.error("❌ Database error:", dbError.message);
    }
  } catch (err) {
    console.error("❌ Error fetching global issues:", err.message);
  }
};

// ---------------- AUTO REFRESH (EVERY 6 HOURS) ----------------
cron.schedule("0 */6 * * *", async () => {
  console.log("🕒 Auto-refreshing global issues...");
  await fetchAndStoreGlobalIssues();
});

// ---------------- GET STORED ISSUES (FOR FRONTEND) ----------------
export const getStoredGlobalIssues = async (req, res) => {
  try {
    const issues = await GlobalIssue.find().sort({ updated_at: -1 });
    res.json(issues);
  } catch (err) {
    console.error("❌ Error getting stored global issues:", err.message);
    res.status(500).json({ error: "Failed to get stored global issues" });
  }
};

export const getStoredIssues = async (req, res) => {
  try {
    const issues = await Issue.find().sort({ updated_at: -1 });
    res.json(issues);
  } catch (err) {
    console.error("❌ Error getting stored user issues:", err.message);
    res.status(500).json({ error: "Failed to get stored issues" });
  }
};



// Add this to your githubController.js
export const debugGlobalIssues = async (req, res) => {
  try {
    const count = await GlobalIssue.countDocuments();
    const sample = await GlobalIssue.find().limit(5).sort({ updated_at: -1 });
    
    res.json({
      totalInDB: count,
      sampleIssues: sample,
      hasData: count > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



export const fixMissingFields = async (req, res) => {
  try {
    const issues = await GlobalIssue.find({
      $or: [
        { created_at: { $exists: false } },
        { updated_at: { $exists: false } },
      ],
    });

    let updated = 0;

    for (const issue of issues) {
      // Use fetchedAt as fallback for created_at/updated_at
      await GlobalIssue.updateOne(
        { _id: issue._id },
        {
          $set: {
            created_at: issue.fetchedAt,
            updated_at: issue.fetchedAt,
          },
        }
      );
      updated++;
    }

    res.json({
      message: `Updated ${updated} issues with missing date fields`,
      totalIssues: issues.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};