import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Youtube from "@/lib/models/youtube";
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

    await dbConnect();

    const youtubeDoc = await Youtube.findOne({});
    const videoId = youtubeDoc?.videoId || null;

    return NextResponse.json({ videoId });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
