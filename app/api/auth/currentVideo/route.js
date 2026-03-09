import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Youtube from "@/lib/models/youtube";
import { verifyToken, verifyAdmin, verifySuperAdmin } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { message: "Authentication invalid" },
        { status: 401 }
      );
    }

    await dbConnect();

    const isAdmin = await verifyAdmin(user.identityNumber);
    if (!isAdmin && !verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    const youtubeDoc = await Youtube.findOne({});
    const videoId = youtubeDoc?.videoId || null;

    return NextResponse.json({
      videoId,
      videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
