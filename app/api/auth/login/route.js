import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import LoginAttempt from "@/lib/models/loginAttempt";
import { createJWT } from "@/lib/utils";
import { verifyJWT } from "@/lib/auth";
import { identityNumberConstant, contactPersonConstant, MAX_IDENTITY_NUMBER_LENGTH, SESSION_LIFETIME_SECONDS } from "@/lib/constants";
import { isRateLimited, recordFailedAttempt } from "@/lib/rateLimit";
import { cleanRequired } from "@/lib/validate";

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

    // Block a second login ONLY while the existing session's token is still
    // valid (someone is actively using it) — this is the anti-prank guard. If
    // the stored token has expired (its 23h is up), the previous session is
    // dead, so we let the user log in again instead of locking them out.
    if (existingUser.activeStatus && existingUser.token && verifyJWT(existingUser.token)) {
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

    await User.findOneAndUpdate(
      { identityNumber },
      { activeStatus: true, token: newToken, loggedInToday: true, lastLoginAt: new Date() }
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

    return response;
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
