import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import LoginAttempt from "@/lib/models/loginAttempt";
import { createJWT } from "@/lib/utils";
import { identityNumberConstant, contactPersonConstant, MAX_IDENTITY_NUMBER_LENGTH } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rateLimit";

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

    // Rate limiting
    const rateLimitResult = await checkRateLimit(`login:${ipAddress}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: rateLimitResult.message },
        { status: 429 }
      );
    }

    let { identityNumber } = await request.json();
    identityNumber = String(identityNumber).trim();

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
          { activeStatus: true, token: adminToken, loggedInToday: true }
        );
      } else {
        await User.create({
          identityNumber,
          activeStatus: true,
          token: adminToken,
          loggedInToday: true,
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
        maxAge: 365 * 24 * 60 * 60,
      });

      return response;
    }

    if (!existingUser) {
      await logLoginAttempt(identityNumber, ipAddress, false, "User not in database");
      return NextResponse.json(
        {
          message:
            "User Is Not In Database Please " + contactPersonConstant + ".",
        },
        { status: 404 }
      );
    }

    if (existingUser.activeStatus) {
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
      { activeStatus: true, token: newToken, loggedInToday: true }
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
      maxAge: 365 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
