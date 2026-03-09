import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import RefreshSignal from "@/lib/models/refreshSignal";
import { verifyToken } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user || !user.adminAuth) {
      return NextResponse.json(
        { message: "Authentication invalid" },
        { status: 401 }
      );
    }

    await dbConnect();

    const signal = await RefreshSignal.findOne({});
    const adminTriggeredAt = signal?.adminTriggeredAt?.toISOString() || null;

    return NextResponse.json({ adminTriggeredAt });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
