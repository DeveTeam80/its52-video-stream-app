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

    let { identityNumber } = await request.json();
    identityNumber = String(identityNumber).trim();

    if (!identityNumber) {
      return NextResponse.json(
        { message: identityNumber + " Is Mandatory." },
        { status: 400 }
      );
    }

    const alreadyExist = await prisma.user.findUnique({ where: { identityNumber } });

    if (alreadyExist) {
      return NextResponse.json(
        { message: "User Already Exists" },
        { status: 404 }
      );
    }

    const createdUser = await prisma.user.create({ data: { identityNumber } });

    return NextResponse.json({ message: "User Added", createdUser });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
