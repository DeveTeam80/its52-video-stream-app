import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
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

    await dbConnect();

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

    const alreadyExist = await User.findOne({ identityNumber });

    if (alreadyExist) {
      return NextResponse.json(
        { message: "User Already Exists" },
        { status: 404 }
      );
    }

    const createdUser = await User.create({ identityNumber });

    if (!createdUser) {
      return NextResponse.json(
        { message: "User Not Added." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "User Added", createdUser });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
