"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "plyr/dist/plyr.css";
import ToastContainer, { showToast } from "./components/Toast";

// Build request headers: include the Bearer token only if localStorage still
// has it; otherwise rely on the durable httpOnly auth-token cookie (sent
// automatically by the browser). iOS can evict localStorage on a phone call,
// but the cookie survives — so the viewer stays logged in either way.
function authHeaders(extra = {}) {
  const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return t ? { ...extra, Authorization: `Bearer ${t}` } : { ...extra };
}

export default function HomeClient() {
  const router = useRouter();
  const bodyRef = useRef(null);
  const playerRef = useRef(null);
  const plyrRef = useRef(null);
  const [videoId, setVideoId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function init() {
      // Don't bail just because localStorage is empty — authCheck also
      // authenticates via the durable httpOnly cookie (sent automatically).
      // Let the server decide; only redirect if it says we're not authorized.
      try {
        const authRes = await fetch("/api/auth/authCheck", {
          headers: authHeaders(),
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
          headers: authHeaders(),
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
      try {
        const res = await fetch("/api/auth/checkRefresh", {
          headers: authHeaders(),
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

  // Initialise the Plyr player once the video id is known.
  // Plyr drives the YouTube player via the IFrame API (postMessage), so the
  // iframe itself stays non-interactive (pointer-events:none in CSS) — users
  // can never click through to YouTube. clickToPlay:false ensures nothing
  // depends on tapping the video surface. fallback:true gives a CSS-based
  // fullscreen that works on iPhone (where the Fullscreen API is unavailable).
  useEffect(() => {
    if (!videoId || !playerRef.current || plyrRef.current) return;

    let cancelled = false;
    // Load Plyr only in the browser — it touches `document` at import time,
    // which would crash during server-side rendering of this client component.
    import("plyr").then(({ default: Plyr }) => {
      if (cancelled || !playerRef.current || plyrRef.current) return;
      plyrRef.current = new Plyr(playerRef.current, {
        controls: ["play-large", "play", "current-time", "mute", "volume", "fullscreen"],
        clickToPlay: false,
        fullscreen: { enabled: true, fallback: true, iosNative: false },
        playsinline: true,
        // No autoplay: the viewer taps the big play button to start. A tap is a
        // "user gesture", so the stream starts WITH sound — autoplay-WITH-sound
        // is blocked by browsers, but tap-to-play is always allowed.
        autoplay: false,
        youtube: { noCookie: true, rel: 0, modestbranding: 1, playsinline: 1 },
      });

      // Hide the contact message while the player is fullscreen. On iPhone,
      // Plyr's CSS-fallback fullscreen is trapped inside an opacity:0.95 stacking
      // context, so the message would otherwise paint over the video. Toggling a
      // class on #home-body (outside that context) reliably hides it. The
      // enterfullscreen/exitfullscreen events fire in both native and iOS-fallback modes.
      plyrRef.current.on("enterfullscreen", () =>
        bodyRef.current?.classList.add("player-fs")
      );
      plyrRef.current.on("exitfullscreen", () =>
        bodyRef.current?.classList.remove("player-fs")
      );
    });

    return () => {
      cancelled = true;
      bodyRef.current?.classList.remove("player-fs");
      try {
        plyrRef.current?.destroy();
      } catch {
        // ignore teardown errors
      }
      plyrRef.current = null;
    };
  }, [videoId]);

  async function logout() {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
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
              <div className="nav-actions">
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
              <div
                id="player"
                ref={playerRef}
                data-plyr-provider="youtube"
                data-plyr-embed-id={videoId}
              ></div>
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
    </>
  );
}
