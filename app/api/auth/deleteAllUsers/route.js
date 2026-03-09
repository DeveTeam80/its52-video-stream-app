import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import SuperAdmin from "@/lib/models/superAdmin";
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
    const isSuperAdmin = verifySuperAdmin(user);
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    // Get all admin ITS numbers to exclude them
    const admins = await Admin.find({}, { identityNumber: 1 });
    const adminIts = admins.map((a) => a.identityNumber);

    // Also exclude ALL super admin ITS numbers
    const superAdmins = await SuperAdmin.find({}, { identityNumber: 1 });
    superAdmins.forEach((sa) => {
      if (!adminIts.includes(sa.identityNumber)) {
        adminIts.push(sa.identityNumber);
      }
    });

    const result = await User.deleteMany({
      identityNumber: { $nin: adminIts },
    });

    // Trigger refresh so deleted users get kicked
    await RefreshSignal.findOneAndUpdate(
      {},
      { triggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: `${result.deletedCount} users deleted successfully.`,
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
