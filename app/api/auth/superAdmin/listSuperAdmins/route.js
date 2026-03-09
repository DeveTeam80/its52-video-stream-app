import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import SuperAdmin from "@/lib/models/superAdmin";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    await dbConnect();

    const superAdmins = await SuperAdmin.find(
      {},
      { identityNumber: 1, createdAt: 1 }
    ).sort({ createdAt: 1 });

    return NextResponse.json({
      superAdmins,
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
