"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "cm_dashboard_access_token";

type AnalyzeResponse = {
  status: string;
  submission_id?: string | null;
  problem_slug?: string | null;
  verdict?: string | null;
  overlay_data?: {
    headline: string;
    body: string;
    call_to_action: string;
    badge_label: string;
    error_types: string[];
    concepts: string[];
    is_recurring: boolean;
  } | null;
};

type UserProfile = {
  email: string;
  leetcode_username: string | null;
};

function verdictCopy(verdict?: string | null): string {
  switch (verdict) {
    case "compile_error":
      return "Your code did not compile, so this is a syntax or typing issue rather than a logic issue.";
    case "runtime_error":
      return "The code ran into a runtime problem, so the next step is to check input handling and unsafe operations.";
    case "wrong_answer":
      return "The solution compiled and ran, but the output does not match expected results.";
    case "tle":
      return "The code is functionally close, but it is taking too long on at least one case.";
    case "mle":
      return "The solution is using too much memory for at least one input.";
    default:
      return "The backend identified a failure and generated guidance for the next fix.";
  }
}

function errorTypeCopy(types: string[]): string {
  if (types.includes("compile_error_syntax")) {
    return "Syntax-level issue";
  }
  if (types.includes("runtime_error_index")) {
    return "Index access issue";
  }
  if (types.includes("tle_wrong_complexity")) {
    return "Complexity issue";
  }
  if (types.includes("mle_large_allocation")) {
    return "Memory issue";
  }
  return "General issue";
}

function statusTone(status: string): "good" | "warn" | "neutral" {
  if (status === "processed") return "good";
  if (status.startsWith("no_") || status === "unsupported_verdict") return "warn";
  return "neutral";
}

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [message, setMessage] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY) || "";
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadProfile();
  }, [token]);

  const analysisTone = useMemo(() => {
    if (!analyzeResult) return "neutral";
    return statusTone(analyzeResult.status);
  }, [analyzeResult]);

  async function loadProfile() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Profile load failed");
      setProfile({
        email: String(data.email || ""),
        leetcode_username: data.leetcode_username ?? null,
      });
      setLeetcodeUsername(String(data.leetcode_username || ""));
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function login() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Login failed");
      const access = String(data.access_token || "");
      window.localStorage.setItem(TOKEN_KEY, access);
      setToken(access);
      setMessage("Login successful.");
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function analyzeLatest() {
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    setLoading(true);
    setMessage("");
    setAnalyzeResult(null);
    try {
      const res = await fetch(`${API_BASE}/submissions/leetcode/latest/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.message || "Analyze failed");
      setAnalyzeResult(data as AnalyzeResponse);
      setMessage(`Analyze status: ${String((data as AnalyzeResponse).status)}`);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setProfile(null);
    setLeetcodeUsername("");
    setMessage("Logged out.");
    setAnalyzeResult(null);
  }

  async function saveProfile() {
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leetcode_username: leetcodeUsername || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Profile update failed");
      setProfile({
        email: String(data.email || ""),
        leetcode_username: data.leetcode_username ?? null,
      });
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  const overlay = analyzeResult?.overlay_data ?? null;
  const issueLabel = overlay ? errorTypeCopy(overlay.error_types) : "";

  return (
    <main className="dashboard-shell">
      <div className="dashboard-glow dashboard-glow-left" />
      <div className="dashboard-glow dashboard-glow-right" />

      <section className="hero">
        <div>
          <p className="eyebrow">CodeMirror</p>
          <h1>Fix the next submission with a clear, human explanation.</h1>
          <p className="hero-copy">
            Login once, sync your LeetCode profile, and pull the latest failed submission into a dashboard view that tells you what failed and what to do next.
          </p>
        </div>

        <div className={`status-pill status-${analysisTone}`}>
          <span className="status-dot" />
          <span>{analyzeResult ? analyzeResult.status : token ? "Ready to analyze" : "Not logged in"}</span>
        </div>
      </section>

      <section className="grid-layout">
        <aside className="panel panel-auth">
          <div className="panel-header">
            <h2>Access</h2>
            <span className="panel-subtitle">Store your session once</span>
          </div>

          <div className="form-stack">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="button-row">
              <button onClick={login} disabled={loading} className="primary-btn">
                Login
              </button>
              <button onClick={logout} className="secondary-btn">
                Logout
              </button>
            </div>
          </div>

          <div className="profile-block">
            <div className="profile-meta">
              <p className="profile-label">Current user</p>
              <p className="profile-value">{token ? profile?.email || "Loading profile..." : "Logged out"}</p>
            </div>

            <label className="input-label" htmlFor="leetcode-username">
              LeetCode username
            </label>
            <input
              id="leetcode-username"
              type="text"
              placeholder="your_leetcode_handle"
              value={leetcodeUsername}
              onChange={(e) => setLeetcodeUsername(e.target.value)}
            />
            <button onClick={saveProfile} disabled={loading || !token} className="secondary-btn full-width">
              Save profile
            </button>
          </div>
        </aside>

        <section className="panel panel-result">
          <div className="panel-header">
            <div>
              <h2>Latest analysis</h2>
              <span className="panel-subtitle">Groq output rewritten for the user</span>
            </div>
            <button onClick={analyzeLatest} disabled={loading || !token} className="accent-btn">
              Analyze latest failed submission
            </button>
          </div>

          {analyzeResult ? (
            <div className="result-stack">
              <div className="result-hero">
                <div className={`badge badge-${analysisTone}`}>{analyzeResult.status}</div>
                <h3>{overlay?.headline || "Analysis ready"}</h3>
                <p className="result-copy">
                  {overlay?.body || "The backend found the latest failed submission and processed it."}
                </p>
              </div>

              <div className="insight-grid">
                <article className="insight-card spotlight">
                  <p className="card-label">What this means</p>
                  <p className="card-copy">
                    {verdictCopy(analyzeResult.verdict)}
                  </p>
                </article>

                <article className="insight-card">
                  <p className="card-label">Next move</p>
                  <p className="card-copy">
                    {overlay?.call_to_action || "Review the failed case and re-run with a smaller change."}
                  </p>
                </article>
              </div>

              <div className="detail-grid">
                <article className="detail-card">
                  <p className="card-label">Submission</p>
                  <p className="detail-value">{analyzeResult.problem_slug || "unknown"}</p>
                  <p className="detail-meta">{analyzeResult.verdict || "unknown verdict"}</p>
                </article>

                <article className="detail-card">
                  <p className="card-label">Issue type</p>
                  <p className="detail-value">{issueLabel || "General issue"}</p>
                  <p className="detail-meta">
                    {overlay?.is_recurring ? "Recurring pattern" : "First seen or low-confidence match"}
                  </p>
                </article>

                <article className="detail-card">
                  <p className="card-label">Badge</p>
                  <p className="detail-value">{overlay?.badge_label || "Saved"}</p>
                  <p className="detail-meta">Shown in the extension after analysis</p>
                </article>
              </div>

              <div className="tag-wrap">
                <div className="tag-group">
                  <span className="tag-title">Error types</span>
                  <div className="chips">
                    {(overlay?.error_types || []).length > 0 ? (
                      overlay?.error_types.map((item) => <span className="chip" key={item}>{item}</span>)
                    ) : (
                      <span className="muted-chip">None</span>
                    )}
                  </div>
                </div>

                <div className="tag-group">
                  <span className="tag-title">Concepts</span>
                  <div className="chips">
                    {(overlay?.concepts || []).length > 0 ? (
                      overlay?.concepts.map((item) => <span className="chip chip-alt" key={item}>{item}</span>)
                    ) : (
                      <span className="muted-chip">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-title">No analysis loaded yet.</p>
              <p className="empty-copy">
                Save your LeetCode username, then trigger the latest analysis to see the Groq explanation here.
              </p>
            </div>
          )}
        </section>
      </section>

      {message ? <p className="message-line">{message}</p> : null}
    </main>
  );
}
