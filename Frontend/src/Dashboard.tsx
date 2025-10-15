import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/clerk-react";
import Aurora from "./components/Aurora";
import axios from "axios";

const Dashboard = () => {
  const { user } = useUser();
  const [assignedIssues, setAssignedIssues] = useState([]);
  const [liveIssues, setLiveIssues] = useState([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });

  // Toast helper
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 3000);
  };

  // 🟩 Check backend for persistent GitHub connection on load
  useEffect(() => {
    const checkGithubStatus = async () => {
      if (!user) return;
      try {
        const res = await axios.get("http://localhost:5000/api/github/status", {
          params: { userId: user.id },
        });
        if (res.data.connected) setGithubConnected(true);
      } catch (err) {
        console.error("Error checking GitHub connection:", err);
      }
    };

    checkGithubStatus();
  }, [user]);

  // 🟩 Detect OAuth redirect (connected=true in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setGithubConnected(true);
      showToast("✅ GitHub connected successfully!");
      params.delete("connected");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch AI-assigned issues
  useEffect(() => {
    const fetchAssignedIssues = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/github/assigned"
        );
        setAssignedIssues(res.data);
      } catch (err) {
        console.error("Error fetching assigned issues:", err);
      }
    };
    fetchAssignedIssues();
  }, []);

  // Fetch stored GitHub issues from DB
  useEffect(() => {
    const fetchStoredIssues = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/github/global");
        setLiveIssues(res.data); // newest first from backend
      } catch (err) {
        console.error("Error fetching stored global issues:", err);
      }
    };

    fetchStoredIssues(); // initial fetch

    // Refresh every 50 seconds
    const interval = setInterval(fetchStoredIssues, 50 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle GitHub connect
  const handleGithubConnect = () => {
    if (githubConnected) {
      showToast("✅ GitHub is already connected!");
      return;
    }
    window.location.href = `http://localhost:5000/api/github/login?userId=${user?.id}`;
  };

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col relative overflow-hidden">
      {/* Aurora background */}
      <div className="absolute top-0 left-0 w-full h-full z-[-2px]">
        <Aurora colorStops={["#0ce6af", "#19def8", "#1967f8"]} speed={1} />
      </div>

      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-6 py-4">
        <div className="p-6 flex gap-10 ml-[640px] border-2 border-gray-500 rounded-4xl bg-gray-500/20 mt-2 z-10">
          <button
            onClick={handleGithubConnect}
            className={`text-sm text-left ${
              githubConnected
                ? "text-gray-500 cursor-not-allowed"
                : "text-gray-300 hover:text-white"
            }`}
          >
            {githubConnected ? "GitHub Connected" : "Connect GitHub"}
          </button>
          <button className="text-gray-300 hover:text-white text-sm text-left">
            Scan Bugs
          </button>
          <button className="text-gray-300 hover:text-white text-sm text-left">
            Assigned Bugs
          </button>
          <button className="text-gray-300 hover:text-white text-sm text-left">
            Leaderboard
          </button>
        </div>

        {/* Clerk Profile */}
        <div className="flex items-center gap-2">
          <UserButton />
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 py-8 text-center relative">
        <h1 className="text-4xl font-bold mb-12 mt-4">
          Welcome,{" "}
          <span className="text-green-400">
            {user?.firstName || "Developer"}
          </span>
        </h1>

        {/* 🟢 Two Issue Boxes Side by Side */}
        <div className="flex flex-col md:flex-row gap-24 w-full max-w-6xl justify-center">

          {/* GitHub Stored Issues */}
          <div className="flex-1 bg-black/20 border border-gray-700 rounded-2xl p-6 backdrop-blur-md hover:shadow-lg hover:shadow-blue-400/10 transition">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">
              GitHub Live Issues
            </h2>
            <div className="h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {liveIssues.length === 0 ? (
                <p className="text-gray-500">No live issues found 🚀</p>
              ) : (
                liveIssues.map((issue, i) => (
                  <a
                    key={i}
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-b border-gray-800 py-3 text-left hover:bg-gray-800/50 rounded-lg px-2 transition"
                  >
                    <p className="font-medium text-white">{issue.title}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Repo: {issue.repo_name} | Created by: {issue.user} |{" "}
                      <span className="text-blue-400">#{issue.number}</span>
                    </p>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>

        <button className="mt-8 bg-green-400 text-black font-medium px-6 py-3 rounded-xl hover:scale-105 transition">
          Start → Make Commits
        </button>
      </main>

      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-6 right-6 bg-green-500 text-black px-4 py-2 rounded shadow-lg z-50 transition-transform">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
