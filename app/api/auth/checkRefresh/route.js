import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { message: "Authentication invalid" },
        { status: 401 }
      );
    }

    const signal = await prisma.refreshSignal.findUnique({ where: { id: 1 } });
    const triggeredAt = signal?.triggeredAt?.toISOString() || null;

    return NextResponse.json({ triggeredAt });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
