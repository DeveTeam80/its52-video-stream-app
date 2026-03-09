"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ToastContainer, { showToast } from "../components/Toast";
import ConfirmDialogContainer, { confirmAction } from "../components/ConfirmDialog";

export default function SuperAdminPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newAdminIts, setNewAdminIts] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [changingPassword, setChangingPassword] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [loading, setLoading] = useState(null);
  // Change own password
  const [currentPassword, setCurrentPassword] = useState("");
  const [ownNewPassword, setOwnNewPassword] = useState("");
  // Add super admin
  const [newSuperAdminIts, setNewSuperAdminIts] = useState("");
  const [newSuperAdminPassword, setNewSuperAdminPassword] = useState("");
  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);

  function getToken() {
    return localStorage.getItem("token");
  }

  async function fetchAdmins() {
    try {
      const res = await fetch("/api/auth/superAdmin/listAdmins", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.admins) {
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchSuperAdmins() {
    try {
      const res = await fetch("/api/auth/superAdmin/listSuperAdmins", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.superAdmins) {
        setSuperAdmins(data.superAdmins);
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

        if (!data.authState || !data.superAdmin) {
          router.push("/admin/login");
          return;
        }

        if (bodyRef.current) {
          bodyRef.current.style.display = "block";
        }

        await Promise.all([fetchAdmins(), fetchSuperAdmins()]);
      } catch (err) {
        console.error(err);
        router.push("/admin/login");
      }
    }

    checkAuth();
  }, [router]);

  async function createAdmin() {
    if (!newAdminIts) {
      showToast("Please enter an ITS ID", "error");
      return;
    }
    if (!newAdminPassword) {
      showToast("Please enter a password", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/superAdmin/createAdmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          identityNumber: newAdminIts,
          password: newAdminPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        setNewAdminIts("");
        setNewAdminPassword("");
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error creating admin", "error");
    }
  }

  async function deleteAdmin(identityNumber) {
    const confirmed = await confirmAction(
      `Are you sure you want to delete admin ${identityNumber}?`,
      { title: "Delete Admin", confirmText: "Delete", danger: true }
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/auth/superAdmin/deleteAdmin", {
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
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error deleting admin", "error");
    }
  }

  async function logoutAdmin(identityNumber) {
    try {
      const res = await fetch("/api/auth/superAdmin/logoutAdmin", {
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
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error logging out admin", "error");
    }
  }

  async function logoutAllAdmins() {
    try {
      const res = await fetch("/api/auth/superAdmin/logoutAllAdmins", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error logging out admins", "error");
    }
  }

  function startEdit(admin) {
    setEditingAdmin(admin.identityNumber);
    setEditValue(admin.identityNumber);
  }

  function cancelEdit() {
    setEditingAdmin(null);
    setEditValue("");
  }

  async function saveEdit(oldIdentityNumber) {
    if (!editValue || editValue === oldIdentityNumber) {
      cancelEdit();
      return;
    }

    try {
      const res = await fetch("/api/auth/superAdmin/updateAdmin", {
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
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error updating admin", "error");
    }
  }

  function startChangePassword(identityNumber) {
    setChangingPassword(identityNumber);
    setNewPasswordValue("");
  }

  function cancelChangePassword() {
    setChangingPassword(null);
    setNewPasswordValue("");
  }

  async function savePassword(identityNumber) {
    if (!newPasswordValue) {
      showToast("Please enter a new password", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/superAdmin/changePassword", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          identityNumber,
          newPassword: newPasswordValue,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        cancelChangePassword();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error changing password", "error");
    }
  }

  async function changeOwnPassword() {
    if (!currentPassword) {
      showToast("Please enter your current password", "error");
      return;
    }
    if (!ownNewPassword) {
      showToast("Please enter a new password", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/superAdmin/changeOwnPassword", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword: ownNewPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        setCurrentPassword("");
        setOwnNewPassword("");
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error changing password", "error");
    }
  }

  async function addSuperAdmin() {
    if (!newSuperAdminIts) {
      showToast("Please enter an ITS ID", "error");
      return;
    }
    if (!newSuperAdminPassword) {
      showToast("Please enter a password", "error");
      return;
    }

    try {
      const res = await fetch("/api/auth/superAdmin/addSuperAdmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          identityNumber: newSuperAdminIts,
          password: newSuperAdminPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        setNewSuperAdminIts("");
        setNewSuperAdminPassword("");
        await fetchSuperAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error adding super admin", "error");
    }
  }

  async function superAdminLogout() {
    const token = getToken();
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  async function exportAdmins() {
    setLoading("export");
    try {
      const res = await fetch("/api/auth/superAdmin/exportAdmins", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        showToast("Error exporting admins", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "admins.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Admins exported successfully", "success");
    } catch (err) {
      showToast("Error exporting admins", "error");
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

    setLoading("import");
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      // Skip header if first column is non-numeric
      const startIndex = lines.length > 0 && !/^\d{5,}/.test(lines[0].split(",")[0].trim()) ? 1 : 0;

      const adminEntries = [];
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(",");
        let its, password;

        // Handle: ITS,Password or SrNo,ITS,Password
        if (cols.length >= 3 && /^\d{1,4}$/.test(cols[0].trim())) {
          its = cols[1].trim();
          password = cols[2].trim();
        } else if (cols.length >= 2) {
          its = cols[0].trim();
          password = cols[1].trim();
        }

        if (its && /^\d{5,}$/.test(its) && password) {
          adminEntries.push({ identityNumber: its, password });
        }
      }

      e.target.value = "";

      if (adminEntries.length === 0) {
        showToast("No valid admin entries found in file. Format: ITS,Password", "error");
        return;
      }

      const res = await fetch("/api/auth/superAdmin/importAdmins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ admins: adminEntries }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error importing admins", "error");
    } finally {
      setLoading(null);
    }
  }

  async function deleteAllAdmins() {
    const confirmed = await confirmAction(
      "Are you sure you want to delete ALL admins?",
      { title: "Delete All Admins", confirmText: "Delete All", danger: true }
    );
    if (!confirmed) return;

    setLoading("deleteAll");
    try {
      const res = await fetch("/api/auth/superAdmin/deleteAllAdmins", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message, "success");
        await fetchAdmins();
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      showToast("Error deleting admins", "error");
    } finally {
      setLoading(null);
    }
  }

  const filteredAdmins = admins.filter((admin) =>
    admin.identityNumber.includes(searchQuery)
  );

  return (
    <div id="home-body" className="admin-page" style={{ display: "none" }} ref={bodyRef}>
      <ToastContainer />
      <ConfirmDialogContainer />
      <section className="wrapper" style={{ height: "auto", minHeight: "100vh" }}>
        {/* Row 1: Logo + Actions */}
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
              <input
                className="btn-login btn"
                type="button"
                value="Admin Panel"
                onClick={() => router.push("/admin")}
              />
              <input
                className="btn-login btn"
                type="button"
                value="Logout All Admins"
                onClick={logoutAllAdmins}
              />
              <input
                className="btn-login btn btn-danger"
                type="button"
                value="Logout"
                onClick={superAdminLogout}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Change My Password */}
        <div className="content admin-actions-row">
          <div className="admin-action-col">
            <div className="nav">
              <div className="input-group">
                <div className="input-password">
                  <input
                    type="password"
                    className="input-control"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group" style={{ marginLeft: "0.5rem" }}>
                <div className="input-password">
                  <input
                    type="text"
                    className="input-control"
                    placeholder="New Password"
                    value={ownNewPassword}
                    onChange={(e) => setOwnNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <input
                className="btn-login btn"
                type="button"
                value="Change Password"
                onClick={changeOwnPassword}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Add Super Admin */}
        <div className="content admin-actions-row">
          <div className="admin-action-col">
            <div className="nav">
              <div className="input-group">
                <div className="input-password">
                  <input
                    maxLength="8"
                    type="number"
                    className="input-control"
                    placeholder="Super Admin ITS"
                    value={newSuperAdminIts}
                    onChange={(e) => setNewSuperAdminIts(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group" style={{ marginLeft: "0.5rem" }}>
                <div className="input-password">
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Password"
                    value={newSuperAdminPassword}
                    onChange={(e) => setNewSuperAdminPassword(e.target.value)}
                  />
                </div>
              </div>
              <input
                className="btn-login btn"
                type="button"
                value="Add Super Admin"
                onClick={addSuperAdmin}
              />
            </div>
            {superAdmins.length > 0 && (
              <div className="current-video-info" style={{ flexWrap: "wrap" }}>
                <span className="current-video-label">Super Admins:</span>
                {superAdmins.map((sa) => (
                  <span
                    key={sa._id}
                    className="status-badge status-active"
                    style={{ marginRight: "0.3rem" }}
                  >
                    {sa.identityNumber}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Create Admin */}
        <div className="content admin-actions-row">
          <div className="admin-action-col">
            <div className="nav">
              <div className="input-group">
                <div className="input-password">
                  <input
                    maxLength="8"
                    type="number"
                    className="input-control"
                    placeholder="Admin ITS ID"
                    value={newAdminIts}
                    onChange={(e) => setNewAdminIts(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group" style={{ marginLeft: "0.5rem" }}>
                <div className="input-password">
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Admin Password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                  />
                </div>
              </div>
              <input
                className="btn-login btn"
                type="button"
                value="Create Admin"
                onClick={createAdmin}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Import / Export / Delete All */}
        <div className="content admin-actions-row">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              className="btn-login btn"
              type="button"
              value={loading === "export" ? "Exporting..." : "Export CSV"}
              onClick={exportAdmins}
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
              value={loading === "deleteAll" ? "Deleting..." : "Delete All Admins"}
              onClick={deleteAllAdmins}
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

        {/* Search + Admin Table */}
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
              {filteredAdmins.length} of {admins.length} admins
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
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin, index) => (
                  <tr key={admin._id} className={admin.activeStatus ? "row-active" : "row-inactive"}>
                    <td>{index + 1}</td>
                    <td>
                      {editingAdmin === admin.identityNumber ? (
                        <input
                          type="number"
                          maxLength="8"
                          className="input-control admin-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(admin.identityNumber);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        admin.identityNumber
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${admin.activeStatus ? "status-active" : "status-inactive"}`}>
                        {admin.activeStatus ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${admin.loggedInToday ? "status-active" : "status-inactive"}`}>
                        {admin.loggedInToday ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      {changingPassword === admin.identityNumber ? (
                        <input
                          type="text"
                          className="input-control admin-edit-input"
                          placeholder="New password"
                          value={newPasswordValue}
                          onChange={(e) => setNewPasswordValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePassword(admin.identityNumber);
                            if (e.key === "Escape") cancelChangePassword();
                          }}
                          autoFocus
                        />
                      ) : (
                        <span style={{ color: "#888" }}>
                          {admin.password ? "Set" : "Not set"}
                        </span>
                      )}
                    </td>
                    <td className="action-cell">
                      {editingAdmin === admin.identityNumber ? (
                        <>
                          <button className="btn-action btn-save" onClick={() => saveEdit(admin.identityNumber)}>Save</button>
                          <button className="btn-action btn-cancel" onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : changingPassword === admin.identityNumber ? (
                        <>
                          <button className="btn-action btn-save" onClick={() => savePassword(admin.identityNumber)}>Save</button>
                          <button className="btn-action btn-cancel" onClick={cancelChangePassword}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-action btn-edit" onClick={() => startEdit(admin)}>Edit</button>
                          <button className="btn-action btn-edit" onClick={() => startChangePassword(admin.identityNumber)}>Password</button>
                          {admin.activeStatus && (
                            <button className="btn-action btn-logout-user" onClick={() => logoutAdmin(admin.identityNumber)}>Logout</button>
                          )}
                          <button className="btn-action btn-delete" onClick={() => deleteAdmin(admin.identityNumber)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAdmins.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                      {searchQuery ? "No admins match your search." : "No admins found."}
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
