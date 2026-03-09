import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import SuperAdmin from "@/lib/models/superAdmin";
import LoginAttempt from "@/lib/models/loginAttempt";
import { createJWT } from "@/lib/utils";
import { identityNumberConstant, contactPersonConstant, MAX_IDENTITY_NUMBER_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/constants";
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

    const rateLimitResult = await checkRateLimit(`adminLogin:${ipAddress}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: rateLimitResult.message },
        { status: 429 }
      );
    }

    let { identityNumber, password } = await request.json();
    identityNumber = String(identityNumber).trim();

    if (!identityNumber) {
      return NextResponse.json(
        { message: identityNumberConstant + " Is Mandatory." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { message: "Password is mandatory." },
        { status: 400 }
      );
    }

    if (String(identityNumber).length > MAX_IDENTITY_NUMBER_LENGTH) {
      return NextResponse.json(
        { message: "Identity number is too long." },
        { status: 400 }
      );
    }

    if (String(password).length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: "Password is too long." },
        { status: 400 }
      );
    }

    // Check SuperAdmin collection (auto-seed from env vars if collection is empty)
    let superAdminRecord = await SuperAdmin.findOne({ identityNumber });
    if (!superAdminRecord) {
      const superAdminCount = await SuperAdmin.countDocuments();
      if (
        superAdminCount === 0 &&
        identityNumber === process.env.SUPER_ADMIN_ITS &&
        process.env.ADMIN_PASSWORD
      ) {
        try {
          superAdminRecord = await SuperAdmin.create({
            identityNumber,
            password: process.env.ADMIN_PASSWORD,
            createdBy: "system",
          });
        } catch (seedError) {
          // Race condition: another request already seeded — fetch the existing record
          if (seedError.code === 11000) {
            superAdminRecord = await SuperAdmin.findOne({ identityNumber });
          } else {
            throw seedError;
          }
        }
      }
    }

    if (superAdminRecord) {
      if (password !== superAdminRecord.password) {
        await logLoginAttempt(identityNumber, ipAddress, false, "Invalid super admin password");
        return NextResponse.json(
          { message: "Invalid password." },
          { status: 401 }
        );
      }

      const adminToken = createJWT(identityNumber, { adminAuth: true, superAdmin: true });

      // Update or create user record
      const existingUser = await User.findOne({ identityNumber });
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

      await logLoginAttempt(identityNumber, ipAddress, true, "Super admin login");

      const response = NextResponse.json({
        message: "Super admin logged in successfully.",
        token: adminToken,
        superAdmin: true,
      });

      response.cookies.set("auth-token", adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
      });

      return response;
    }

    // Regular admin login - check Admin collection
    const adminUser = await Admin.findOne({ identityNumber });

    if (!adminUser) {
      await logLoginAttempt(identityNumber, ipAddress, false, "Not an admin");
      return NextResponse.json(
        {
          message: "Access denied. Please " + contactPersonConstant + ".",
        },
        { status: 403 }
      );
    }

    // Verify individual admin password
    if (!adminUser.password) {
      await logLoginAttempt(identityNumber, ipAddress, false, "Admin password not set");
      return NextResponse.json(
        { message: "Password not set. Please contact super admin." },
        { status: 401 }
      );
    }

    if (password !== adminUser.password) {
      await logLoginAttempt(identityNumber, ipAddress, false, "Invalid admin password");
      return NextResponse.json(
        { message: "Invalid password." },
        { status: 401 }
      );
    }

    const adminToken = createJWT(identityNumber, { adminAuth: true });

    // Update admin record
    await Admin.findOneAndUpdate(
      { identityNumber },
      { activeStatus: true, token: adminToken, loggedInToday: true }
    );

    // Update or create user record
    const existingUser = await User.findOne({ identityNumber });
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

    await logLoginAttempt(identityNumber, ipAddress, true, "Admin login with password");

    const response = NextResponse.json({
      message: "Admin logged in successfully.",
      token: adminToken,
    });

    response.cookies.set("auth-token", adminToken, {
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
