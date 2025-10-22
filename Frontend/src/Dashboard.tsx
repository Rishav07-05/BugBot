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
  const [debugInfo, setDebugInfo] = useState<{
    lastFetch: string;
    issueCount: number;
    connectionStatus: string;
    userId: string;
  }>({
    lastFetch: "Never",
    issueCount: 0,
    connectionStatus: "Unknown",
    userId: "",
  });
  const [showDebug, setShowDebug] = useState(false);

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
        if (res.data.connected) {
          setGithubConnected(true);
          setDebugInfo((prev) => ({ ...prev, connectionStatus: "Connected" }));
        } else {
          setDebugInfo((prev) => ({
            ...prev,
            connectionStatus: "Not Connected",
          }));
        }
        setDebugInfo((prev) => ({ ...prev, userId: user.id }));
      } catch (err) {
        console.error("Error checking GitHub connection:", err);
        setDebugInfo((prev) => ({ ...prev, connectionStatus: "Error" }));
      }
    };

    checkGithubStatus();
  }, [user]);

  // 🟩 Detect OAuth redirect (connected=true in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setGithubConnected(true);
      setDebugInfo((prev) => ({ ...prev, connectionStatus: "Connected" }));
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
        console.log("🔄 Fetching global issues...");
        const res = await axios.get("http://localhost:5000/api/github/global");

        if (res.data && Array.isArray(res.data)) {
          // Sort by updated_at (newest first)
          const sortedIssues = res.data.sort(
            (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
          );

          console.log("📊 First 3 issues:", sortedIssues.slice(0, 3));
          console.log("🔢 Total issues:", sortedIssues.length);

          setLiveIssues(sortedIssues);
          setDebugInfo((prev) => ({
            ...prev,
            issueCount: sortedIssues.length,
            lastFetch: new Date().toLocaleTimeString(),
          }));
          console.log(`✅ Loaded ${sortedIssues.length} issues`);
        } else {
          console.warn("⚠️ No issues data received");
          setLiveIssues([]);
          setDebugInfo((prev) => ({ ...prev, issueCount: 0 }));
        }
      } catch (err) {
        console.error("❌ Error fetching stored global issues:", err);
        showToast("Failed to load issues");
        setLiveIssues([]);
        setDebugInfo((prev) => ({ ...prev, issueCount: 0 }));
      }
    };

    fetchStoredIssues(); // initial fetch

    // Refresh every 60 seconds instead of 50
    const interval = setInterval(fetchStoredIssues, 60 * 1000);
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

  // Manual refresh for debug purposes
  const handleManualRefresh = async () => {
    try {
      showToast("🔄 Manually refreshing issues...");
      const res = await axios.get("http://localhost:5000/api/github/global");
      if (res.data && Array.isArray(res.data)) {
        const sortedIssues = res.data.sort(
          (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
        );
        setLiveIssues(sortedIssues);
        setDebugInfo((prev) => ({
          ...prev,
          issueCount: sortedIssues.length,
          lastFetch: new Date().toLocaleTimeString(),
        }));
        showToast(`✅ Refreshed ${sortedIssues.length} issues`);
      }
    } catch (err) {
      console.error("Manual refresh error:", err);
      showToast("❌ Refresh failed");
    }
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-blue-400">
                GitHub Live Issues
              </h2>
              <button
                onClick={handleManualRefresh}
                className="text-xs bg-blue-500/20 hover:bg-blue-500/30 px-2 py-1 rounded border border-blue-400/50 transition"
              >
                🔄 Refresh
              </button>
            </div>
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

          {/* Assigned Issues Box */}
          <div className="flex-1 bg-black/20 border border-gray-700 rounded-2xl p-6 backdrop-blur-md hover:shadow-lg hover:shadow-green-400/10 transition">
            <h2 className="text-xl font-semibold mb-4 text-green-400">
              Your Assigned Issues
            </h2>
            <div className="h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {assignedIssues.length === 0 ? (
                <p className="text-gray-500">No assigned issues yet</p>
              ) : (
                assignedIssues.map((issue, i) => (
                  <a
                    key={i}
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-b border-gray-800 py-3 text-left hover:bg-gray-800/50 rounded-lg px-2 transition"
                  >
                    <p className="font-medium text-white">{issue.title}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Repo: {issue.repo} | Priority: {issue.priority}
                    </p>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Debug Panel Toggle */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="mt-6 text-xs text-gray-400 hover:text-gray-300 bg-gray-800/30 hover:bg-gray-700/30 px-3 py-1 rounded border border-gray-600 transition"
        >
          {showDebug ? "🔽 Hide Debug" : "▶️ Show Debug"}
        </button>

        {/* Debug Panel */}
        {showDebug && (
          <div className="mt-4 w-full max-w-2xl bg-black/40 border border-yellow-500/30 rounded-xl p-4 backdrop-blur-md">
            <h3 className="text-yellow-400 font-semibold mb-3 text-left">
              Debug Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-left text-sm">
              <div>
                <p>
                  <strong>Last Fetch:</strong> {debugInfo.lastFetch}
                </p>
                <p>
                  <strong>Live Issues:</strong> {debugInfo.issueCount}
                </p>
                <p>
                  <strong>Assigned Issues:</strong> {assignedIssues.length}
                </p>
              </div>
              <div>
                <p>
                  <strong>GitHub Status:</strong> {debugInfo.connectionStatus}
                </p>
                <p>
                  <strong>User ID:</strong> {debugInfo.userId || "Not loaded"}
                </p>
                <p>
                  <strong>Backend:</strong> http://localhost:5000
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleManualRefresh}
                className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 px-2 py-1 rounded border border-yellow-400/50 transition"
              >
                Force Refresh
              </button>
              <button
                onClick={() => console.log("Live Issues:", liveIssues)}
                className="text-xs bg-purple-500/20 hover:bg-purple-500/30 px-2 py-1 rounded border border-purple-400/50 transition"
              >
                Log to Console
              </button>
              <button
                onClick={() => {
                  setDebugInfo((prev) => ({
                    ...prev,
                    lastFetch: new Date().toLocaleTimeString(),
                  }));
                  showToast("Debug timestamp updated");
                }}
                className="text-xs bg-green-500/20 hover:bg-green-500/30 px-2 py-1 rounded border border-green-400/50 transition"
              >
                Update Timestamp
              </button>
            </div>
          </div>
        )}

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
