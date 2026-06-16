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

    // Exclude the caller so the admin doesn't log themselves out
    await prisma.user.updateMany({
      where: { identityNumber: { not: user.identityNumber } },
      data: { activeStatus: false, token: null, loggedInToday: false },
    });

    // Also clear Admin collection tokens for consistency (exclude caller)
    await prisma.admin.updateMany({
      where: { identityNumber: { not: user.identityNumber } },
      data: { activeStatus: false, token: null },
    });

    // Auto-trigger refresh so users get kicked to login page
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { triggeredAt: now },
      create: { id: 1, triggeredAt: now },
    });

    return NextResponse.json({
      message: "All Users Logged Out Successfully.",
      logoutStatus: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
