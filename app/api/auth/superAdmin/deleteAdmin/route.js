import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
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

    const { identityNumber } = await request.json();

    if (!identityNumber) {
      return NextResponse.json(
        { message: "ITS number is mandatory." },
        { status: 400 }
      );
    }

    const admin = await Admin.findOne({ identityNumber });
    if (!admin) {
      return NextResponse.json(
        { message: "Admin not found." },
        { status: 404 }
      );
    }

    await Admin.deleteOne({ identityNumber });

    // Trigger admin refresh
    await RefreshSignal.findOneAndUpdate(
      {},
      { adminTriggeredAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      message: "Admin deleted successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
