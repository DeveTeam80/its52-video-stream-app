import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import RefreshSignal from "@/lib/models/refreshSignal";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function GET(request) {
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

    // Exclude the caller so the admin doesn't log themselves out
    await User.updateMany(
      { identityNumber: { $ne: user.identityNumber } },
      { activeStatus: false, token: null, loggedInToday: false }
    );

    // Also clear Admin collection tokens for consistency (exclude caller)
    await Admin.updateMany(
      { identityNumber: { $ne: user.identityNumber } },
      { activeStatus: false, token: null }
    );

    // Auto-trigger refresh so users get kicked to login page
    await RefreshSignal.findOneAndUpdate(
      {},
      { triggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: "All Users Logged Out Successfully.",
      logoutStatus: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
