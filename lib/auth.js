import jwt from "jsonwebtoken";
import dbConnect from "./dbConnect";
import Admin from "./models/admin";
import User from "./models/user";

export async function verifyToken(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return null;
  }
  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Validate token is still active in the User document
    await dbConnect();
    const existingUser = await User.findOne({ identityNumber: payload.identityNumber });
    if (!existingUser || existingUser.token !== token) {
      return null;
    }

    return { identityNumber: payload.identityNumber, token, adminAuth: !!payload.adminAuth, superAdmin: !!payload.superAdmin };
  } catch (error) {
    return null;
  }
}

export async function verifyAdmin(identityNumber) {
  await dbConnect();
  const adminUser = await Admin.findOne({ identityNumber });
  return !!adminUser;
}

export function verifySuperAdmin(user) {
  return user && user.superAdmin && user.adminAuth;
}

export function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}
