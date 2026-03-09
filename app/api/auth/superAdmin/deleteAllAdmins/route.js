import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
import SuperAdmin from "@/lib/models/superAdmin";
import RefreshSignal from "@/lib/models/refreshSignal";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

export async function DELETE(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    await dbConnect();

    // Exclude ALL super admin ITS numbers from deletion
    const superAdmins = await SuperAdmin.find({}, { identityNumber: 1 });
    const superAdminIts = superAdmins.map((sa) => sa.identityNumber);

    const filter = superAdminIts.length > 0
      ? { identityNumber: { $nin: superAdminIts } }
      : {};
    const result = await Admin.deleteMany(filter);

    // Trigger admin refresh
    await RefreshSignal.findOneAndUpdate(
      {},
      { adminTriggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: `${result.deletedCount} admins deleted successfully.`,
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
