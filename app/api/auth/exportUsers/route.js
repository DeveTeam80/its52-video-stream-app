import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { message: "Authentication invalid" },
        { status: 401 }
      );
    }

    const isAdmin = await verifyAdmin(user.identityNumber);
    if (!isAdmin && !verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

    // Build CSV
    const header = "Sr No,ITS Number,Status,Logged In Today";
    const rows = users.map((u, i) =>
      `${i + 1},${u.identityNumber},${u.activeStatus ? "Active" : "Inactive"},${u.loggedInToday ? "Yes" : "No"}`
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
