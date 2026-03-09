import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
import SuperAdmin from "@/lib/models/superAdmin";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";
import { MAX_IDENTITY_NUMBER_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/constants";

export async function POST(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    await dbConnect();

    let { identityNumber, password } = await request.json();
    identityNumber = String(identityNumber).trim();

    if (!identityNumber) {
      return NextResponse.json(
        { message: "ITS number is mandatory." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { message: "Password is mandatory." },
        { status: 400 }
      );
    }

    if (String(identityNumber).length > MAX_IDENTITY_NUMBER_LENGTH || String(password).length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: "Input exceeds maximum allowed length." },
        { status: 400 }
      );
    }

    const isSuperAdminIts = await SuperAdmin.findOne({ identityNumber });
    if (isSuperAdminIts) {
      return NextResponse.json(
        { message: "This ITS belongs to a super admin and cannot be added as a regular admin." },
        { status: 400 }
      );
    }

    const existing = await Admin.findOne({ identityNumber });
    if (existing) {
      return NextResponse.json(
        { message: "Admin with this ITS already exists." },
        { status: 400 }
      );
    }

    try {
      await Admin.create({ identityNumber, password });
    } catch (createError) {
      if (createError.code === 11000) {
        return NextResponse.json(
          { message: "Admin with this ITS already exists." },
          { status: 400 }
        );
      }
      throw createError;
    }

    return NextResponse.json({
      message: "Admin created successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
