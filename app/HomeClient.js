"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import ToastContainer, { showToast } from "./components/Toast";

export default function HomeClient() {
  const router = useRouter();
  const bodyRef = useRef(null);
  const playerRef = useRef(null);
  const playerInitialized = useRef(false);
  const [coreLoaded, setCoreLoaded] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Auth check — redirect to login if not authorized
      try {
        const authRes = await fetch("/api/auth/authCheck", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const authData = await authRes.json();

        if (!authData.authState) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }

        if (authData.admin) setIsAdmin(true);
        if (authData.superAdmin) setIsSuperAdmin(true);
      } catch {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      // Auth passed — show the page
      if (bodyRef.current) {
        bodyRef.current.style.display = "block";
      }

      // Fetch video
      try {
        const res = await fetch("/api/auth/videoId", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.videoId) {
          setVideoId(data.videoId);
        }
      } catch (err) {
        console.error(err);
      }
    }

    init();

    // Poll for admin-triggered refresh every 5 seconds
    let lastRefresh = null;
    const interval = setInterval(async () => {
      const t = localStorage.getItem("token");
      if (!t) return;
      try {
        const res = await fetch("/api/auth/checkRefresh", {
          headers: { Authorization: `Bearer ${t}` },
        });
        const data = await res.json();
        if (data.triggeredAt) {
          if (lastRefresh === null) {
            lastRefresh = data.triggeredAt;
          } else if (data.triggeredAt !== lastRefresh) {
            window.location.reload();
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (videoId && playerRef.current) {
      playerRef.current.setAttribute("data-youtube-id", videoId);
      initPlayer();
    }
  }, [videoId, coreLoaded]);

  function initPlayer() {
    if (playerInitialized.current) return;
    if (!videoId) return;
    if (!window.Vlitejs || !window.VlitejsYoutube) return;

    playerInitialized.current = true;
    if (!window.__vliteYoutubeRegistered) {
      window.Vlitejs.registerProvider("youtube", window.VlitejsYoutube);
      window.__vliteYoutubeRegistered = true;
    }
    new window.Vlitejs("#player", {
      options: {
        controls: true,
        autoplay: true,
        playPause: false,
        progressBar: false,
        time: true,
        volume: true,
        fullscreen: true,
        poster: "https://www.its52.com/imgs/1443/bg_Login_Jamea.jpg?v1",
        bigPlay: true,
        playsinline: true,
        loop: false,
        muted: false,
        autoHide: true,
      },
      provider: ["youtube"],
      onReady: function () {},
    });
  }

  async function logout() {
    const token = localStorage.getItem("token");
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
    setTimeout(() => router.push("/login"), 1000);
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/vlitejs@5/dist/vlite.css"
      />
      <ToastContainer />
      <div id="home-body" className="home-body home-page" ref={bodyRef}>
        <section className="wrapper">
          <div className="content">
            <div className="nav">
              <img
                className="logo-image nav-img"
                src="/taiyebi-mohalla-pune.png"
                alt="Logo"
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {isSuperAdmin && (
                  <input
                    className="btn-login btn"
                    type="button"
                    value="Super Admin"
                    onClick={() => router.push("/super-admin")}
                  />
                )}
                {isAdmin && (
                  <input
                    className="btn-login btn"
                    type="button"
                    value="Admin Panel"
                    onClick={() => router.push("/admin")}
                  />
                )}
                <input
                  className="btn-login btn"
                  type="button"
                  value="Logout"
                  onClick={logout}
                />
              </div>
            </div>
          </div>
          <img
            id="mobile-bg"
            src="https://www.its52.com/imgs/1443/bg_Login_Jamea.jpg?v1"
            alt=""
          />
          <div className="content player-content" style={{ marginTop: "1rem" }}>
            {videoId ? (
              <div id="player" ref={playerRef}></div>
            ) : (
              <div className="no-video-message">
                <p>No video is currently available.</p>
                <p>Please check back later or contact your administrator.</p>
              </div>
            )}
          </div>
          <div className="new-container">
            <p className="error">
              In case of any problem occurs please contact administrator (+91
              94230 24252)
            </p>
          </div>
        </section>
      </div>
      {/* Load Vlite core first */}
      <Script
        src="https://cdn.jsdelivr.net/npm/vlitejs@5"
        strategy="afterInteractive"
        onLoad={() => setCoreLoaded(true)}
      />
      {/* Load YouTube provider only after core is ready */}
      {coreLoaded && (
        <Script
          src="https://cdn.jsdelivr.net/npm/vlitejs@5/dist/providers/youtube.js"
          strategy="afterInteractive"
          onLoad={initPlayer}
        />
      )}
    </>
  );
}
