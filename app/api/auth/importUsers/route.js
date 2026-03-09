import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function POST(request) {
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

    const { users } = await request.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { message: "No users to import." },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;

    for (const its of users) {
      const trimmed = String(its).trim();
      if (!trimmed) continue;

      const existing = await User.findOne({ identityNumber: trimmed });
      if (existing) {
        skipped++;
        continue;
      }

      await User.create({ identityNumber: trimmed });
      created++;
    }

    return NextResponse.json({
      message: `Imported ${created} users. ${skipped} duplicates skipped.`,
      success: true,
      created,
      skipped,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
