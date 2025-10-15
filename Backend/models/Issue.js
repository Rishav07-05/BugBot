import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema({
  issueId: { type: Number, unique: true }, // <-- add this
  title: String,
  html_url: String,
  number: Number,
  repo_name: String,
  user: String,
  created_at: Date,
  updated_at: Date,
});

export default mongoose.model("Issue", IssueSchema);
