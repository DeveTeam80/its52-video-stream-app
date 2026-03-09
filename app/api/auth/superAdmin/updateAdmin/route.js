import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
import SuperAdmin from "@/lib/models/superAdmin";
import RefreshSignal from "@/lib/models/refreshSignal";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

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

    const { oldIdentityNumber, newIdentityNumber } = await request.json();

    if (!oldIdentityNumber || !newIdentityNumber) {
      return NextResponse.json(
        { message: "Both old and new ITS numbers are required." },
        { status: 400 }
      );
    }

    if (oldIdentityNumber === newIdentityNumber) {
      return NextResponse.json(
        { message: "No changes made." },
        { status: 400 }
      );
    }

    const admin = await Admin.findOne({ identityNumber: oldIdentityNumber });
    if (!admin) {
      return NextResponse.json(
        { message: "Admin not found." },
        { status: 404 }
      );
    }

    const isSuperAdminIts = await SuperAdmin.findOne({ identityNumber: newIdentityNumber });
    if (isSuperAdminIts) {
      return NextResponse.json(
        { message: "This ITS belongs to a super admin and cannot be used for a regular admin." },
        { status: 400 }
      );
    }

    const duplicate = await Admin.findOne({ identityNumber: newIdentityNumber });
    if (duplicate) {
      return NextResponse.json(
        { message: "An admin with this ITS already exists." },
        { status: 400 }
      );
    }

    await Admin.findOneAndUpdate(
      { identityNumber: oldIdentityNumber },
      { identityNumber: newIdentityNumber, activeStatus: false, token: null }
    );

    // Trigger admin refresh
    await RefreshSignal.findOneAndUpdate(
      {},
      { adminTriggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: "Admin updated successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
