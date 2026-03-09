import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
import RefreshSignal from "@/lib/models/refreshSignal";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

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

    await Admin.updateMany(
      {},
      { activeStatus: false, token: null }
    );

    // Trigger admin refresh so all admins get kicked
    await RefreshSignal.findOneAndUpdate(
      {},
      { adminTriggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: "All admins logged out successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
