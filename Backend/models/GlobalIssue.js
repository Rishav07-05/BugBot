import mongoose from "mongoose";

const globalIssueSchema = new mongoose.Schema({
  issueId: { type: Number, unique: true },
  title: String,
  html_url: String,
  number: Number,
  repo_name: String,
  user: String,
  created_at: Date,
  updated_at: Date,
  fetchedAt: { type: Date, default: Date.now },
});

export default mongoose.model("GlobalIssue", globalIssueSchema);
