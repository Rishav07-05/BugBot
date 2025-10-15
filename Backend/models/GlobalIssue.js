// models/GlobalIssue.js
import mongoose from "mongoose";

const globalIssueSchema = new mongoose.Schema({
  title: String,
  html_url: String,
  number: Number,
  repo_name: String,
  user: String,
  fetchedAt: { type: Date, default: Date.now },
});

export default mongoose.model("GlobalIssue", globalIssueSchema);
