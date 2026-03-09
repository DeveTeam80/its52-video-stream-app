"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ToastContainer, { showToast } from "../components/Toast";
import ConfirmDialogContainer, { confirmAction } from "../components/ConfirmDialog";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newLink, setNewLink] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(null);
  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);

  function getToken() {
    return localStorage.getItem("token");
  }

  async function fetchCurrentVideo() {
    try {
      const res = await fetch("/api/auth/currentVideo", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setCurrentVideoUrl(data.videoUrl || "");
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchUsers() {
    try {
      const usersRes = await fetch("/api/auth/allUser", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const usersData = await usersRes.json();
      if (usersData.allUsers) {
        setUsers(usersData.allUsers);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      const token = getToken();
      if (!token) {
        router.push("/admin/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/authCheck", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!data.authState || !data.admin) {
          router.push("/admin/login");
          return;
        }

        if (data.superAdmin) {
          setIsSuperAdmin(true);
        }

        if (bodyRef.current) {
          bodyRef.current.style.display = "block";
        }

        await Promise.all([fetchUsers(), fetchCurrentVideo()]);
      } catch (err) {
        console.error(err);
        router.push("/admin/login");
      }
    }

    checkAuth();

    // Poll for super admin-triggered refresh every 5 seconds
    let lastAdminRefresh = null;
    const interval = setInterval(async () => {
      const t = getToken();
      if (!t) return;
      try {
        const res = await fetch("/api/auth/superAdmin/checkAdminRefresh", {
          headers: { Authorization: `Bearer ${t}` },
        });
        const data = await res.json();
        if (data.adminTriggeredAt) {
          if (lastAdminRefresh === null) {
            lastAdminRefresh = data.adminTriggeredAt;
          } else if (data.adminTriggeredAt !== lastAdminRefresh) {
            window.location.reload();
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  async function refreshAll() {
    try {
      const res = await fetch("/api/auth/triggerRefresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error sending refresh signal", "error");
    }
  }

  async function adminLogout() {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();
      showToast(data.message || "Logged out successfully", "success");
    } catch (err) {
      showToast("Error during logout", "error");
    }
    localStorage.removeItem("token");
    setTimeout(() => router.push("/admin/login"), 1000);
  }

  async function logoutAll() {
    try {
      const res = await fetch("/api/auth/logoutAllUsers", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.logoutStatus) {
        showToast(data.message, "success");
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error logging out users", "error");
    }
  }

  async function addNew() {
    if (!newUserId) {
      showToast("Please enter an ITS ID", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/addSingleUsers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ identityNumber: newUserId }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        setNewUserId("");
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error adding user", "error");
    }
  }

  async function addLink() {
    if (!newLink) {
      showToast("Please enter a YouTube link", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/updateVideoLink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ link: newLink }),
      });
      const data = await res.json();

      if (data.linkAdded) {
        showToast(data.message, "success");
        setNewLink("");
        await fetchCurrentVideo();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error updating link", "error");
    }
  }

  async function removeLink() {
    const confirmed = await confirmAction(
      "Are you sure you want to remove the current video link? Users will see a 'no video available' message.",
      { title: "Remove Video Link", confirmText: "Remove", danger: true }
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/auth/removeVideoLink", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        setCurrentVideoUrl("");
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error removing video link", "error");
    }
  }

  async function logoutSingleUser(identityNumber) {
    try {
      const res = await fetch("/api/auth/logoutUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ identityNumber }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error logging out user", "error");
    }
  }

  async function deleteUser(identityNumber) {
    const confirmed = await confirmAction(
      `Are you sure you want to delete user ${identityNumber}?`,
      { title: "Delete User", confirmText: "Delete", danger: true }
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/auth/deleteUser", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ identityNumber }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error deleting user", "error");
    }
  }

  function startEdit(user) {
    setEditingUser(user.identityNumber);
    setEditValue(user.identityNumber);
  }

  function cancelEdit() {
    setEditingUser(null);
    setEditValue("");
  }

  async function saveEdit(oldIdentityNumber) {
    if (!editValue || editValue === oldIdentityNumber) {
      cancelEdit();
      return;
    }

    try {
      const res = await fetch("/api/auth/editUser", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          oldIdentityNumber,
          newIdentityNumber: editValue,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        cancelEdit();
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error updating user", "error");
    }
  }

  async function exportUsers() {
    setLoading("export");
    try {
      const res = await fetch("/api/auth/exportUsers", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        showToast("Error exporting users", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Users exported successfully", "success");
    } catch (err) {
      showToast("Error exporting users", "error");
    } finally {
      setLoading(null);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    // Skip header if it contains non-numeric first column
    const startIndex = lines.length > 0 && !/^\d{5,}/.test(lines[0].split(",")[0].trim()) ? 1 : 0;

    const itsNumbers = [];
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(",");
      // Find the ITS number column (first column that looks like an 8-digit number, or second column if first is Sr No)
      let its = cols[0].trim();
      if (/^\d{1,4}$/.test(its) && cols.length > 1) {
        its = cols[1].trim(); // Skip Sr No column
      }
      if (its && /^\d{5,}$/.test(its)) {
        itsNumbers.push(its);
      }
    }

    // Reset file input
    e.target.value = "";

    if (itsNumbers.length === 0) {
      showToast("No valid ITS numbers found in file", "error");
      return;
    }

    setLoading("import");
    try {
      const res = await fetch("/api/auth/importUsers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ users: itsNumbers }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error importing users", "error");
    } finally {
      setLoading(null);
    }
  }

  async function deleteAllUsers() {
    const confirmed = await confirmAction(
      "Are you sure you want to delete ALL users? Admin accounts will be preserved.",
      { title: "Delete All Users", confirmText: "Delete All", danger: true }
    );
    if (!confirmed) return;

    setLoading("deleteAll");
    try {
      const res = await fetch("/api/auth/deleteAllUsers", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchUsers();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error deleting users", "error");
    } finally {
      setLoading(null);
    }
  }

  const filteredUsers = users.filter((user) =>
    user.identityNumber.includes(searchQuery)
  );

  return (
    <div id="home-body" className="admin-page" style={{ display: "none" }} ref={bodyRef}>
      <ToastContainer />
      <ConfirmDialogContainer />
      <section className="wrapper" style={{ height: "auto", minHeight: "100vh" }}>
        {/* Row 1: Logo + Logout All button */}
        <div className="content" style={{ marginTop: "2rem" }}>
          <div className="nav">
            <img
              className="logo-image nav-img"
              src="/taiyebi-mohalla-pune.png"
              alt="Logo"
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="btn-login btn"
                type="button"
                value="Home"
                onClick={() => router.push("/")}
              />
              {isSuperAdmin && (
                <input
                  className="btn-login btn"
                  type="button"
                  value="Super Admin"
                  onClick={() => router.push("/super-admin")}
                />
              )}
              <input
                className="btn-login btn"
                type="button"
                value="Refresh All"
                onClick={refreshAll}
              />
              <input
                className="btn-login btn"
                type="button"
                value="Logout All"
                onClick={logoutAll}
              />
              <input
                className="btn-login btn btn-danger"
                type="button"
                value="Logout"
                onClick={adminLogout}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Add ITS + New Link side by side */}
        <div className="content admin-actions-row">
          <div className="admin-action-col">
            <div className="nav">
              <div className="input-group">
                <div className="input-password">
                  <input
                    maxLength="8"
                    type="number"
                    className="input-control"
                    placeholder="Enter ITS ID"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                  />
                </div>
              </div>
              <input
                className="btn-login btn"
                type="button"
                value="Add New"
                onClick={addNew}
              />
            </div>
          </div>

          <div className="admin-action-col">
            <div className="nav">
              <div className="input-group">
                <div className="input-password">
                  <input
                    className="input-control"
                    placeholder="New Youtube Link"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                  />
                </div>
              </div>
              <input
                className="btn-login btn"
                type="button"
                value="New Link"
                style={{ marginRight: "0.5rem" }}
                onClick={addLink}
              />
              {currentVideoUrl && (
                <input
                  className="btn-login btn btn-danger"
                  type="button"
                  value="Remove Link"
                  onClick={removeLink}
                />
              )}
            </div>
            {currentVideoUrl && (
              <div className="current-video-info">
                <span className="current-video-label">Current:</span>
                <span
                  className="current-video-link"
                  onClick={() => {
                    navigator.clipboard.writeText(currentVideoUrl);
                    showToast("Link copied to clipboard", "success");
                  }}
                  title="Click to copy"
                >
                  {currentVideoUrl}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Import / Export / Delete All */}
        <div className="content admin-actions-row">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              className="btn-login btn"
              type="button"
              value={loading === "export" ? "Exporting..." : "Export CSV"}
              onClick={exportUsers}
              disabled={!!loading}
            />
            <input
              className="btn-login btn"
              type="button"
              value={loading === "import" ? "Importing..." : "Import CSV"}
              onClick={handleImportClick}
              disabled={!!loading}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
            <input
              className="btn-login btn btn-danger"
              type="button"
              value={loading === "deleteAll" ? "Deleting..." : "Delete All Users"}
              onClick={deleteAllUsers}
              disabled={!!loading}
            />
          </div>
        </div>

        {/* Background image */}
        <img
          id="mobile-bg"
          src="https://www.its52.com/imgs/1443/bg_Login_Jamea.jpg?v1"
          alt=""
        />

        {/* Search + User Table */}
        <div className="content user-list-container">
          <div className="admin-search-bar">
            <input
              type="text"
              className="input-control admin-search-input"
              placeholder="Search by ITS number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="admin-search-count">
              {filteredUsers.length} of {users.length} users
            </span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>ITS Number</th>
                  <th>Status</th>
                  <th>Logged In Today</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr key={user._id} className={user.activeStatus ? "row-active" : "row-inactive"}>
                    <td>{index + 1}</td>
                    <td>
                      {editingUser === user.identityNumber ? (
                        <input
                          type="number"
                          maxLength="8"
                          className="input-control admin-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(user.identityNumber);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        user.identityNumber
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${user.activeStatus ? "status-active" : "status-inactive"}`}>
                        {user.activeStatus ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.loggedInToday ? "status-active" : "status-inactive"}`}>
                        {user.loggedInToday ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="action-cell">
                      {editingUser === user.identityNumber ? (
                        <>
                          <button className="btn-action btn-save" onClick={() => saveEdit(user.identityNumber)}>Save</button>
                          <button className="btn-action btn-cancel" onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-action btn-edit" onClick={() => startEdit(user)}>Edit</button>
                          {user.activeStatus && (
                            <button className="btn-action btn-logout-user" onClick={() => logoutSingleUser(user.identityNumber)}>Logout</button>
                          )}
                          <button className="btn-action btn-delete" onClick={() => deleteUser(user.identityNumber)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                      {searchQuery ? "No users match your search." : "No users found."}
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
