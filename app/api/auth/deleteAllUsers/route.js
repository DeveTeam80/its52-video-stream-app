import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import Admin from "@/lib/models/admin";
import SuperAdmin from "@/lib/models/superAdmin";
import RefreshSignal from "@/lib/models/refreshSignal";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/auditLog";

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

    // Delete-all is super-admin-only — a destructive, irreversible action that
    // a regular admin should not be able to trigger (e.g. wiping every viewer
    // mid-event). Single-user delete remains available to admins.
    const isSuperAdmin = verifySuperAdmin(user);
    if (!isSuperAdmin) {
      return NextResponse.json(
        { message: "Super admin access only" },
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

    await logAdminAction({ actor: user, action: "DELETE_ALL_USERS", details: `${result.deletedCount} users deleted` });

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
