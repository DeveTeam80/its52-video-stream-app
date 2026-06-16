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

    const { link } = await request.json();

    if (!link) {
      return NextResponse.json(
        { message: "Video link is mandatory." },
        { status: 400 }
      );
    }

    // Extract video ID from YouTube URL, or use as-is if already an ID
    let videoId = link;
    try {
      const url = new URL(link);
      if (url.hostname.includes("youtube.com")) {
        videoId = url.searchParams.get("v") || videoId;
      } else if (url.hostname === "youtu.be") {
        videoId = url.pathname.slice(1) || videoId;
      }
    } catch {
      // Not a URL — treat as raw video ID
    }

    await prisma.youtube.upsert({
      where: { id: 1 },
      update: { videoId },
      create: { id: 1, videoId },
    });

    // Auto-trigger refresh for all connected users
    const now = new Date();
    await prisma.refreshSignal.upsert({
      where: { id: 1 },
      update: { triggeredAt: now },
      create: { id: 1, triggeredAt: now },
    });

    return NextResponse.json({ message: "Link Added", linkAdded: true });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
