// server/utils/aiProcessor.js
import axios from "axios";
import User from "../models/User.js";

/**
 * 🧠 Fetch all repositories for a connected GitHub user
 * (includes both public and private, if token has permission)
 */
const fetchUserRepos = async (token) => {
  try {
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: { Authorization: `token ${token}` },
      params: { visibility: "all", per_page: 20 },
    });

    return response.data.map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
    }));
  } catch (error) {
    console.error("❌ Error fetching user repositories:", error.message);
    return [];
  }
};

/**
 * 📦 Fetch issues for a specific repo
 */
const fetchRepoIssues = async (owner, repo, token) => {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        headers: { Authorization: `token ${token}` },
        params: { state: "open", per_page: 20 },
      }
    );

    // filter out pull requests
    return response.data.filter((issue) => !issue.pull_request);
  } catch (error) {
    console.error(
      `❌ Error fetching issues for ${owner}/${repo}:`,
      error.message
    );
    return [];
  }
};

/**
 * 🤖 Use AI (OpenRouter) to classify and assign issues
 */
const classifyIssuesWithAI = async (issues) => {
  if (!issues.length) return [];

  const prompt = `
You are BugBot AI.

You are given a list of GitHub issues.
For each issue, assign:
- a "priority" (high, medium, or low)
- a "developer" (Dev1, Dev2, or Dev3) based on the issue's complexity or title

Return *only* valid JSON in this format:
[
  {
    "issue_title": "...",
    "repo": "...",
    "assigned_dev": "...",
    "priority": "high/medium/low"
  }
]

Here are the issues:
${JSON.stringify(
  issues.slice(0, 5).map((i) => ({
    title: i.title,
    repo: i.repo,
    body: i.body,
  })),
  null,
  2
)}
`;

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const output = res.data.choices[0].message.content;

    try {
      return JSON.parse(output);
    } catch (err) {
      console.warn(
        "⚠️ AI returned non-JSON output. Using fallback classification."
      );
      return issues.map((issue, i) => ({
        issue_title: issue.title,
        repo: issue.repo,
        assigned_dev: `Dev${(i % 3) + 1}`,
        priority: ["high", "medium", "low"][i % 3],
      }));
    }
  } catch (error) {
    console.error("❌ AI classification failed:", error.message);
    return issues.map((issue, i) => ({
      issue_title: issue.title,
      repo: issue.repo,
      assigned_dev: `Dev${(i % 3) + 1}`,
      priority: ["high", "medium", "low"][i % 3],
    }));
  }
};

/**
 * 🚀 Main Function — Fetch all connected users' GitHub issues dynamically
 */
export const getAssignedIssues = async () => {
  try {
    const users = await User.find({ githubConnected: true });
    let allIssues = [];

    for (const user of users) {
      const repos = await fetchUserRepos(user.githubToken);
      console.log(`🔍 Found ${repos.length} repos for ${user.clerkId}`);

      for (const repo of repos) {
        const repoIssues = await fetchRepoIssues(
          repo.owner,
          repo.name,
          user.githubToken
        );

        allIssues = allIssues.concat(
          repoIssues.map((issue) => ({
            title: issue.title,
            body: issue.body || "",
            repo: repo.name,
            html_url: issue.html_url,
          }))
        );
      }
    }

    console.log(`✅ Total fetched issues: ${allIssues.length}`);

    const aiClassified = await classifyIssuesWithAI(allIssues);
    console.log("🤖 AI processed and classified issues successfully.");

    return aiClassified;
  } catch (error) {
    console.error("❌ Error in getAssignedIssues:", error.message);
    return [];
  }
};
