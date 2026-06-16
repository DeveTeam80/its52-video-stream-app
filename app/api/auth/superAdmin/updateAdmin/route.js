import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

export async function PUT(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    const { oldIdentityNumber, newIdentityNumber } = await request.json();

    if (!oldIdentityNumber || !newIdentityNumber) {
      return NextResponse.json(
        { message: "Both old and new ITS numbers are required." },
        { status: 400 }
      );
    }

    if (oldIdentityNumber === newIdentityNumber) {
      return NextResponse.json(
        { message: "No changes made." },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { identityNumber: oldIdentityNumber } });
    if (!admin) {
      return NextResponse.json(
        { message: "Admin not found." },
        { status: 404 }
      );
    }

    const isSuperAdminIts = await prisma.superAdmin.findUnique({ where: { identityNumber: newIdentityNumber } });
    if (isSuperAdminIts) {
      return NextResponse.json(
        { message: "This ITS belongs to a super admin and cannot be used for a regular admin." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.admin.findUnique({ where: { identityNumber: newIdentityNumber } });
    if (duplicate) {
      return NextResponse.json(
        { message: "An admin with this ITS already exists." },
        { status: 400 }
      );
    }

    await prisma.admin.update({
      where: { identityNumber: oldIdentityNumber },
      data: { identityNumber: newIdentityNumber, activeStatus: false, token: null },
    });

    // Trigger admin refresh
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { adminTriggeredAt: now },
      create: { id: 1, adminTriggeredAt: now },
    });

    return NextResponse.json({
      message: "Admin updated successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
