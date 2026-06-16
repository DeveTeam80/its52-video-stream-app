import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    await prisma.admin.updateMany({
      data: { activeStatus: false, token: null },
    });

    // Trigger admin refresh so all admins get kicked
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { adminTriggeredAt: now },
      create: { id: 1, adminTriggeredAt: now },
    });

    return NextResponse.json({
      message: "All admins logged out successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
