import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Youtube from "@/lib/models/youtube";
import RefreshSignal from "@/lib/models/refreshSignal";
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

    await Youtube.deleteMany({});

    // Auto-trigger refresh for all connected users
    await RefreshSignal.findOneAndUpdate(
      {},
      { triggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: "Video link removed",
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
