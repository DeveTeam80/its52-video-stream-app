import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

export async function DELETE(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    // Exclude ALL super admin ITS numbers from deletion
    const superAdmins = await prisma.superAdmin.findMany({ select: { identityNumber: true } });
    const superAdminIts = superAdmins.map((sa) => sa.identityNumber);

    const where = superAdminIts.length > 0
      ? { identityNumber: { notIn: superAdminIts } }
      : {};
    const result = await prisma.admin.deleteMany({ where });

    // Trigger admin refresh
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { adminTriggeredAt: now },
      create: { id: 1, adminTriggeredAt: now },
    });

    return NextResponse.json({
      message: `${result.count} admins deleted successfully.`,
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
