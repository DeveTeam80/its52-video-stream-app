import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function PUT(request) {
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

    let { oldIdentityNumber, newIdentityNumber } = await request.json();
    oldIdentityNumber = String(oldIdentityNumber).trim();
    newIdentityNumber = String(newIdentityNumber).trim();

    if (!oldIdentityNumber || !newIdentityNumber) {
      return NextResponse.json(
        { message: "Both old and new identity numbers are required." },
        { status: 400 }
      );
    }

    if (oldIdentityNumber === newIdentityNumber) {
      return NextResponse.json(
        { message: "New identity number must be different." },
        { status: 400 }
      );
    }

    // Block editing admin or super admin ITS from the user management page
    const isTargetAdmin = await prisma.admin.findUnique({ where: { identityNumber: oldIdentityNumber } });
    if (isTargetAdmin) {
      return NextResponse.json(
        { message: "This ITS belongs to an admin. Use the super admin panel to manage admins." },
        { status: 400 }
      );
    }

    const isTargetSuperAdmin = await prisma.superAdmin.findUnique({ where: { identityNumber: oldIdentityNumber } });
    if (isTargetSuperAdmin) {
      return NextResponse.json(
        { message: "This ITS belongs to a super admin and cannot be edited here." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { identityNumber: oldIdentityNumber } });

    if (!targetUser) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    const duplicate = await prisma.user.findUnique({ where: { identityNumber: newIdentityNumber } });

    if (duplicate) {
      return NextResponse.json(
        { message: "A user with this identity number already exists." },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { identityNumber: oldIdentityNumber },
      data: { identityNumber: newIdentityNumber, activeStatus: false, token: null },
    });

    return NextResponse.json({
      message: "User updated successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
