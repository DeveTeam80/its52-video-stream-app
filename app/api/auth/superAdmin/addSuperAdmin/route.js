import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";
import { MAX_IDENTITY_NUMBER_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/constants";

export async function POST(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    let { identityNumber, password } = await request.json();
    identityNumber = String(identityNumber).trim();

    if (!identityNumber) {
      return NextResponse.json(
        { message: "ITS number is mandatory." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { message: "Password is mandatory." },
        { status: 400 }
      );
    }

    if (String(identityNumber).length > MAX_IDENTITY_NUMBER_LENGTH || String(password).length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: "Input exceeds maximum allowed length." },
        { status: 400 }
      );
    }

    // Check if already a super admin
    const existingSuperAdmin = await prisma.superAdmin.findUnique({ where: { identityNumber } });
    if (existingSuperAdmin) {
      return NextResponse.json(
        { message: "This ITS is already a super admin." },
        { status: 400 }
      );
    }

    // Check if this ITS is a regular admin — block it
    const existingAdmin = await prisma.admin.findUnique({ where: { identityNumber } });
    if (existingAdmin) {
      return NextResponse.json(
        { message: "This ITS is currently a regular admin. Remove them as admin first before adding as super admin." },
        { status: 400 }
      );
    }

    try {
      await prisma.superAdmin.create({
        data: {
          identityNumber,
          password,
          createdBy: user.identityNumber,
        },
      });
    } catch (createError) {
      if (createError.code === "P2002") {
        return NextResponse.json(
          { message: "This ITS is already a super admin." },
          { status: 400 }
        );
      }
      throw createError;
    }

    return NextResponse.json({
      message: "Super admin added successfully.",
      success: true,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
