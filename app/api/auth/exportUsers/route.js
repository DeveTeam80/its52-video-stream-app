import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";
import { csvRow } from "@/lib/csv";
import { isToday } from "@/lib/date";

export async function GET(request) {
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
    if (!isAdmin && !verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    const users = await User.find({}).sort({ createdAt: -1 });

    // Build CSV (escaped to prevent broken columns / spreadsheet formula injection)
    const header = csvRow(["Sr No", "ITS Number", "Status", "Logged In Today"]);
    const rows = users.map((u, i) =>
      csvRow([
        i + 1,
        u.identityNumber,
        u.activeStatus ? "Active" : "Inactive",
        isToday(u.lastLoginAt) ? "Yes" : "No",
      ])
    );
    const csv = [header, ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=users.csv",
      },
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
