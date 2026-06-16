import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function DELETE(request) {
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

    await prisma.youtube.deleteMany({});

    // Auto-trigger refresh for all connected users
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { triggeredAt: now },
      create: { id: 1, triggeredAt: now },
    });

    return NextResponse.json({
      success: true,
      message: "Video link removed",
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
