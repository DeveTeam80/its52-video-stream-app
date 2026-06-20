import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import LoginAttempt from "@/lib/models/loginAttempt";
import { createJWT } from "@/lib/utils";
import { verifyJWT } from "@/lib/auth";
import { identityNumberConstant, contactPersonConstant, MAX_IDENTITY_NUMBER_LENGTH, SESSION_LIFETIME_SECONDS, DEVICE_ID_COOKIE_MAX_AGE } from "@/lib/constants";
import { isRateLimited, recordFailedAttempt } from "@/lib/rateLimit";
import { cleanRequired } from "@/lib/validate";
import { randomUUID } from "crypto";

async function logLoginAttempt(identityNumber, ipAddress, success, reason) {
  try {
    await LoginAttempt.create({ identityNumber, ipAddress, success, reason });
  } catch (err) {
    console.error("Failed to log login attempt:", err.message);
  }
}

export async function POST(request) {
  try {
    await dbConnect();

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // The browser's persistent device-id (set on a prior login). Lets the same
    // device reclaim its session without tripping the single-session lock.
    const incomingDeviceId = request.cookies.get("device-id")?.value || null;

    // Rate limiting — only FAILED logins are counted (recorded below), so a
    // venue full of legitimate users sharing one IP is never locked out.
    const rateLimitResult = await isRateLimited(`login:${ipAddress}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: rateLimitResult.message },
        { status: 429 }
      );
    }

    let { identityNumber } = await request.json();
    identityNumber = cleanRequired(identityNumber);

    if (!identityNumber) {
      return NextResponse.json(
        { message: identityNumberConstant + " Is Mandatory." },
        { status: 400 }
      );
    }

    if (String(identityNumber).length > MAX_IDENTITY_NUMBER_LENGTH) {
      return NextResponse.json(
        { message: "Identity number is too long." },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ identityNumber });
    const adminUser = await Admin.findOne({ identityNumber });

    if (adminUser) {
      const adminToken = createJWT(identityNumber);

      if (existingUser) {
        await User.findOneAndUpdate(
          { identityNumber },
          { activeStatus: true, token: adminToken, loggedInToday: true, lastLoginAt: new Date() }
        );
      } else {
        await User.create({
          identityNumber,
          activeStatus: true,
          token: adminToken,
          loggedInToday: true,
          lastLoginAt: new Date(),
        });
      }

      await logLoginAttempt(identityNumber, ipAddress, true, "Admin login");

      const response = NextResponse.json({
        message: "Logged In Successfully.",
        token: adminToken,
      });

      // Set HttpOnly cookie for server-side auth
      response.cookies.set("auth-token", adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_LIFETIME_SECONDS,
      });

      return response;
    }

    if (!existingUser) {
      await logLoginAttempt(identityNumber, ipAddress, false, "User not in database");
      await recordFailedAttempt(`login:${ipAddress}`);
      return NextResponse.json(
        {
          message:
            "User Is Not In Database Please " + contactPersonConstant + ".",
        },
        { status: 404 }
      );
    }

    // Same device coming back? A matching device-id cookie means this is the
    // same browser reclaiming its own session, so we never block it — this is
    // what fixes the false lockout when a user flips WiFi <-> mobile data.
    const sameDevice = !!(
      incomingDeviceId &&
      existingUser.deviceId &&
      incomingDeviceId === existingUser.deviceId
    );

    // Block a second login ONLY from a DIFFERENT device while the existing
    // session's token is still valid (someone is actively using it) — this is
    // the anti-prank guard. Once that token expires (5h), the previous session
    // is dead, so we let the user log in again instead of locking them out.
    if (!sameDevice && existingUser.activeStatus && existingUser.token && verifyJWT(existingUser.token)) {
      await logLoginAttempt(identityNumber, ipAddress, false, "User already active");
      return NextResponse.json(
        {
          message:
            "User Already Logged In And Is Active, Please " +
            contactPersonConstant +
            ".",
        },
        { status: 403 }
      );
    }

    const newToken = createJWT(identityNumber);
    // Reuse the browser's existing device-id if it presented one, else mint a new one.
    const deviceId = incomingDeviceId || randomUUID();

    await User.findOneAndUpdate(
      { identityNumber },
      { activeStatus: true, token: newToken, loggedInToday: true, lastLoginAt: new Date(), deviceId }
    );

    await logLoginAttempt(identityNumber, ipAddress, true, "Login successful");

    const response = NextResponse.json({
      message: "Logged In Successfully.",
      token: newToken,
    });

    // Set HttpOnly cookie for server-side auth
    response.cookies.set("auth-token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_LIFETIME_SECONDS,
    });

    // Long-lived device-id cookie so this browser is recognised on its next
    // login and can silently reclaim its session (refreshed on each login).
    response.cookies.set("device-id", deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_ID_COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
