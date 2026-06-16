import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import AdminActionLog from "@/lib/models/adminActionLog";
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

    const logs = await AdminActionLog.find({})
      .sort({ createdAt: -1 })
      .limit(500);

    return NextResponse.json({ logs, success: true });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
