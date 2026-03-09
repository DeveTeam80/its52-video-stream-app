import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Admin from "@/lib/models/admin";
import { verifyToken } from "@/lib/auth";

export async function GET(request) {
  try {
    // verifyToken now validates JWT + checks token is active in User document
    const user = await verifyToken(request);
    if (!user) {
      const response = NextResponse.json({
        message: "User Is not Authorized",
        authState: false,
      });
      // Clear stale auth cookie when token is invalid/expired
      response.cookies.set("auth-token", "", { maxAge: 0, path: "/" });
      return response;
    }

    await dbConnect();

    const { identityNumber, adminAuth, superAdmin } = user;

    // Super admin check (JWT claims set during DB-verified login)
    if (superAdmin && adminAuth) {
      return NextResponse.json({
        message: "User Is Authorized",
        authState: true,
        admin: true,
        superAdmin: true,
      });
    }

    const adminUser = await Admin.findOne({ identityNumber });
    if (adminUser && adminAuth) {
      return NextResponse.json({
        message: "User Is Authorized",
        authState: true,
        admin: true,
      });
    }

    return NextResponse.json({
      message: "User Is Authorized",
      authState: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
