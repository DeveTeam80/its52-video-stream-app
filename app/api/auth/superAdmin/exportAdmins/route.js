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

    // Build CSV
    const header = "Sr No,ITS Number,Password,Status,Logged In Today";
    const rows = admins.map((a, i) =>
      `${i + 1},${a.identityNumber},${a.password || ""},${a.activeStatus ? "Active" : "Inactive"},${a.loggedInToday ? "Yes" : "No"}`
    );
    const csv = [header, ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=admins.csv",
      },
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
