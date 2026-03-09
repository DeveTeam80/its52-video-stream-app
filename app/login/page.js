"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [identityNumber, setIdentityNumber] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function login(e) {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        router.push("/");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
  }

  return (
    <form name="Form1" onSubmit={login}>
      <section className="wrapper">
        <img
          id="mobile-bg"
          src="https://www.its52.com/imgs/1443/bg_Login_Jamea.jpg?v1"
          alt=""
        />
        <div className="content">
          <header>
            <img
              className="logo-image"
              src="https://www.its52.com/imgs/1443/ITS_Logo_Golden.png?v1"
              alt="ITS Logo"
            />
            <div className="heading-title">
              <h1>IDARATUT TA&apos;REEF AL SHAKHSI</h1>
            </div>
            <img
              className="motif-login"
              src="https://www.its52.com/imgs/1443/Motif_Login.png?v1"
              alt="Motif"
            />
          </header>
          <div id="divLogin">
            <div className="input-group">
              <span className="lbl-text">ITS ID</span>
              <div className="input-password">
                <input
                  name="txtUserName"
                  maxLength="8"
                  type="number"
                  className="input-control"
                  placeholder="Enter ITS ID"
                  value={identityNumber}
                  onChange={(e) => setIdentityNumber(e.target.value)}
                />
              </div>
            </div>
            <div>
              <input type="submit" value="Login ITS" className="btn-login" />
              <p className="error" id="login-error">
                {error}
              </p>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
