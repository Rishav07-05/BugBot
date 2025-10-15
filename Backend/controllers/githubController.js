import axios from "axios";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import GlobalIssue from "../models/GlobalIssue.js";

// ---------------- GitHub OAuth ----------------
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

// ---------------- Check GitHub Connection ----------------
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

// ---------------- Fetch Live Issues for All Users ----------------
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

        // Store issues in DB for future scanning
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

// ---------------- Fetch & Store Global GitHub Issues ----------------
export const fetchAndStoreGlobalIssues = async () => {
  try {
    const token = process.env.GITHUB_PERSONAL_TOKEN;

    const resSearch = await axios.get("https://api.github.com/search/issues", {
      headers: { Authorization: `token ${token}` },
      params: { q: "is:issue is:open sort:updated-desc", per_page: 30 },
    });

    const issues = resSearch.data.items.map((issue) => ({
      issueId: issue.id,
      title: issue.title,
      html_url: issue.html_url,
      number: issue.number,
      repo_name: issue.repository_url.split("/").slice(-2).join("/"),
      user: issue.user.login,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }));

    for (const i of issues) {
      await GlobalIssue.findOneAndUpdate(
        { issueId: i.issueId },
        { $set: i, $currentDate: { fetchedAt: true } },
        { upsert: true, new: true }
      );
    }

    console.log(`✅ Fetched & stored ${issues.length} global issues`);
    return issues;
  } catch (err) {
    console.error("❌ Error fetching global issues:", err.message);
    return [];
  }
};

// ---------------- Get Stored Issues for Frontend ----------------
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
