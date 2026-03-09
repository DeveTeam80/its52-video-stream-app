import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/lib/models/user";
import { verifyToken } from "@/lib/auth";
import { identityNumberConstant } from "@/lib/constants";

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

    const { identityNumber } = user;

    if (!identityNumber) {
      return NextResponse.json(
        { message: identityNumberConstant + " Is Mandatory." },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ identityNumber });

    if (!existingUser) {
      const response = NextResponse.json({
        message: "User Doesn't Exist.",
        logoutStatus: true,
      });
      response.cookies.set("auth-token", "", { maxAge: 0, path: "/" });
      return response;
    }

    if (!existingUser.activeStatus) {
      const response = NextResponse.json(
        { message: "User Is Currently Not Active.", logoutStatus: true },
        { status: 403 }
      );
      response.cookies.set("auth-token", "", { maxAge: 0, path: "/" });
      return response;
    }

    await User.findOneAndUpdate(
      { identityNumber },
      { activeStatus: false, token: null }
    );

    const response = NextResponse.json({
      message: "Logged Out Successfully.",
      logoutStatus: true,
    });

    // Clear auth cookie
    response.cookies.set("auth-token", "", { maxAge: 0, path: "/" });

    return response;
  } catch (error) {
    console.error(error.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
