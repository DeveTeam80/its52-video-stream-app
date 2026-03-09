import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import SuperAdmin from "@/lib/models/superAdmin";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";

export async function PUT(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    await dbConnect();

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (String(currentPassword).length > MAX_PASSWORD_LENGTH || String(newPassword).length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: "Password exceeds maximum allowed length." },
        { status: 400 }
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      identityNumber: user.identityNumber,
    });

    if (!superAdmin) {
      return NextResponse.json(
        { message: "Super admin record not found." },
        { status: 404 }
      );
    }

    if (superAdmin.password !== currentPassword) {
      return NextResponse.json(
        { message: "Current password is incorrect." },
        { status: 401 }
      );
    }

    superAdmin.password = newPassword;
    await superAdmin.save();

    return NextResponse.json({
      message: "Password changed successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
