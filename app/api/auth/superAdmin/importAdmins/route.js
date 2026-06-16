import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifySuperAdmin } from "@/lib/auth";

export async function POST(request) {
  try {
    const user = await verifyToken(request);
    if (!verifySuperAdmin(user)) {
      return NextResponse.json(
        { message: "Super admin access only" },
        { status: 403 }
      );
    }

    const { admins } = await request.json();

    if (!admins || !Array.isArray(admins) || admins.length === 0) {
      return NextResponse.json(
        { message: "No admins to import." },
        { status: 400 }
      );
    }

    // Batch-fetch all existing admin and super admin ITS numbers upfront
    const existingAdmins = await prisma.admin.findMany({ select: { identityNumber: true } });
    const existingAdminIts = new Set(existingAdmins.map((a) => a.identityNumber));

    const superAdmins = await prisma.superAdmin.findMany({ select: { identityNumber: true } });
    const superAdminIts = new Set(superAdmins.map((sa) => sa.identityNumber));

    let created = 0;
    let skipped = 0;

    for (const admin of admins) {
      const its = String(admin.identityNumber || "").trim();
      const password = String(admin.password || "").trim();

      if (!its) continue;

      // Skip super admin ITS — cannot be a regular admin
      if (superAdminIts.has(its)) {
        skipped++;
        continue;
      }

      if (existingAdminIts.has(its)) {
        skipped++;
        continue;
      }

      if (!password) {
        skipped++;
        continue;
      }

      try {
        await prisma.admin.create({ data: { identityNumber: its, password } });
        existingAdminIts.add(its);
        created++;
      } catch (createError) {
        if (createError.code === "P2002") {
          skipped++;
        } else {
          throw createError;
        }
      }
    }

    return NextResponse.json({
      message: `Imported ${created} admins. ${skipped} skipped (duplicate or missing password).`,
      success: true,
      created,
      skipped,
    });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
