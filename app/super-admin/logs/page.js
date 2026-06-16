"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ToastContainer, { showToast } from "../../components/Toast";

const ACTION_LABELS = {
  CREATE_USER: "Created user",
  CREATE_USERS_BULK: "Bulk-added users",
  IMPORT_USERS: "Imported users",
  EDIT_USER: "Edited user",
  DELETE_USER: "Deleted user",
  DELETE_ALL_USERS: "Deleted all users",
  LOGOUT_USER: "Logged out user",
  LOGOUT_ALL_USERS: "Logged out all users",
  REFRESH_ALL: "Refreshed all users",
};

export default function LogsPage() {
  const router = useRouter();
  const bodyRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/authCheck", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.authState || !data.superAdmin) {
          router.push("/admin/login");
          return;
        }
      } catch {
        router.push("/admin/login");
        return;
      }

      if (bodyRef.current) bodyRef.current.style.display = "block";
      fetchLogs();
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/auth/superAdmin/actionLogs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      } else {
        showToast(data.message || "Failed to load logs", "error");
      }
    } catch {
      showToast("Failed to load logs", "error");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const token = localStorage.getItem("token");
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
    localStorage.removeItem("token");
    router.push("/login");
  }

  const q = search.trim();
  const filtered = logs.filter((log) => {
    if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
    if (!q) return true;
    return (
      (log.actorIts || "").includes(q) || (log.targetIts || "").includes(q)
    );
  });

  return (
    <div
      id="home-body"
      className="admin-page"
      style={{ display: "none" }}
      ref={bodyRef}
    >
      <ToastContainer />
      <section className="wrapper" style={{ height: "auto", minHeight: "100vh" }}>
        {/* Row 1: Logo + nav */}
        <div className="content" style={{ marginTop: "2rem" }}>
          <div className="nav">
            <img
              className="logo-image nav-img"
              src="/taiyebi-mohalla-pune.png"
              alt="Logo"
            />
            <div className="logs-nav-actions">
              <input
                className="btn-login btn"
                type="button"
                value="Super Admin"
                onClick={() => router.push("/super-admin")}
              />
              <input
                className="btn-login btn btn-danger"
                type="button"
                value="Logout"
                onClick={logout}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Title + search + filter */}
        <div className="content" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ textAlign: "center", margin: "0 0 1rem", color: "#0e4653" }}>
            Admin Activity Log
          </h2>
          <div className="admin-search-bar">
            <input
              className="input-control admin-search-input"
              type="text"
              placeholder="Search by ITS (admin or user)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input-control"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="ALL">All actions</option>
              {Object.entries(ACTION_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <span className="admin-search-count">
              {filtered.length} of {logs.length}
            </span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target User</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log._id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {log.actorIts}{" "}
                      <span
                        className={`status-badge ${
                          log.actorRole === "superAdmin"
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {log.actorRole === "superAdmin" ? "Super" : "Admin"}
                      </span>
                    </td>
                    <td>{ACTION_LABELS[log.action] || log.action}</td>
                    <td>{log.targetIts || "—"}</td>
                    <td>{log.details || "—"}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#777" }}>
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
