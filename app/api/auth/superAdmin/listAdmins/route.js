import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
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

    const admins = await Admin.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ admins });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
