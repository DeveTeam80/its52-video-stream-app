import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
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

    await dbConnect();

    const isAdmin = await verifyAdmin(user.identityNumber);
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Admin access only" },
        { status: 403 }
      );
    }

    const { identityNumberArr } = await request.json();

    if (!identityNumberArr) {
      return NextResponse.json(
        { message: identityNumberArr + " Is Mandatory." },
        { status: 400 }
      );
    }

    const createdUser = await User.insertMany(identityNumberArr);

    if (!createdUser) {
      return NextResponse.json({ message: "Not Added." }, { status: 404 });
    }

    return NextResponse.json({ message: "All Added", createdUser });
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
