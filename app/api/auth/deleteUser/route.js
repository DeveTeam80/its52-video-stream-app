import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function DELETE(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { message: "Authentication invalid" },
        { status: 401 }
      );
    }

    await dbConnect();

    const isAdmin = await verifyAdmin(user.identityNumber);
    if (!isAdmin && !verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    const { identityNumber } = await request.json();

    if (!identityNumber) {
      return NextResponse.json(
        { message: "Identity number is required." },
        { status: 400 }
      );
    }

    const targetUser = await User.findOne({ identityNumber });

    if (!targetUser) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    await User.deleteOne({ identityNumber });

    return NextResponse.json({
      message: "User deleted successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
