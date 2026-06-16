import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";

export async function PUT(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    const { identityNumber, newPassword } = await request.json();

    if (!identityNumber || !newPassword) {
      return NextResponse.json(
        { message: "ITS number and new password are required." },
        { status: 400 }
      );
    }

    if (String(newPassword).length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: "Password exceeds maximum allowed length." },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { identityNumber } });
    if (!admin) {
      return NextResponse.json(
        { message: "Admin not found." },
        { status: 404 }
      );
    }

    await prisma.admin.update({
      where: { identityNumber },
      data: { password: newPassword },
    });

    // Trigger admin refresh so affected admin gets kicked
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { adminTriggeredAt: now },
      create: { id: 1, adminTriggeredAt: now },
    });

    return NextResponse.json({
      message: "Password changed successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
