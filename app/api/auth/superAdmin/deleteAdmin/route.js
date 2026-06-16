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

    const { identityNumber } = await request.json();

    if (!identityNumber) {
      return NextResponse.json(
        { message: "ITS number is mandatory." },
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

    await prisma.admin.delete({ where: { identityNumber } });

    // Trigger admin refresh
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { adminTriggeredAt: now },
      create: { id: 1, adminTriggeredAt: now },
    });

    return NextResponse.json({
      message: "Admin deleted successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
