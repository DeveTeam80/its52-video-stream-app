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

    const { identityNumber } = await request.json();

    if (!identityNumber) {
      return NextResponse.json(
        { message: "Identity number is required." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { identityNumber } });

    if (!targetUser) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    if (!targetUser.activeStatus) {
      return NextResponse.json(
        { message: "User is not currently logged in." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { identityNumber },
      data: { activeStatus: false, token: null },
    });

    return NextResponse.json({
      message: "User logged out successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
