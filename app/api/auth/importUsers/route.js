import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

    // Batch-fetch existing user ITS numbers upfront for O(1) lookups
    const existingUsers = await prisma.user.findMany({ select: { identityNumber: true } });
    const existingIts = new Set(existingUsers.map((u) => u.identityNumber));

    let created = 0;
    let skipped = 0;

    for (const its of users) {
      const trimmed = String(its).trim();
      if (!trimmed) continue;

      if (existingIts.has(trimmed)) {
        skipped++;
        continue;
      }

      try {
        await prisma.user.create({ data: { identityNumber: trimmed } });
        existingIts.add(trimmed);
        created++;
      } catch (createError) {
        if (createError.code === "P2002") {
          skipped++;
        } else {
          throw createError;
        }
      }
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
