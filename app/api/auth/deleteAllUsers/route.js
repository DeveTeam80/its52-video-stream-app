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
    const isSuperAdmin = verifySuperAdmin(user);
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    // Get all admin ITS numbers to exclude them
    const admins = await prisma.admin.findMany({ select: { identityNumber: true } });
    const adminIts = admins.map((a) => a.identityNumber);

    // Also exclude ALL super admin ITS numbers
    const superAdmins = await prisma.superAdmin.findMany({ select: { identityNumber: true } });
    superAdmins.forEach((sa) => {
      if (!adminIts.includes(sa.identityNumber)) {
        adminIts.push(sa.identityNumber);
      }
    });

    const result = await prisma.user.deleteMany({
      where: { identityNumber: { notIn: adminIts } },
    });

    // Trigger refresh so deleted users get kicked
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { triggeredAt: now },
      create: { id: 1, triggeredAt: now },
    });

    return NextResponse.json({
      message: `${result.count} users deleted successfully.`,
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
