import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifyAdmin } from "@/lib/auth";

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
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    const { identityNumberArr } = await request.json();

    if (!identityNumberArr || !Array.isArray(identityNumberArr) || identityNumberArr.length === 0) {
      return NextResponse.json(
        { message: identityNumberArr + " Is Mandatory." },
        { status: 400 }
      );
    }

    // Normalize entries (accept either strings or { identityNumber } objects)
    const data = identityNumberArr
      .map((entry) =>
        typeof entry === "string"
          ? entry.trim()
          : String(entry?.identityNumber || "").trim()
      )
      .filter(Boolean)
      .map((identityNumber) => ({ identityNumber }));

    const createdUser = await prisma.user.createMany({
      data,
      skipDuplicates: true,
    });

    return NextResponse.json({ message: "All Added", createdUser });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
