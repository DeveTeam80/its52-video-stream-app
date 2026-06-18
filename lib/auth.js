import jwt from "jsonwebtoken";
import dbConnect from "./dbConnect";
import Admin from "./models/admin";
import User from "./models/user";

export async function verifyToken(request) {
  // Accept the token from the Authorization: Bearer header (admin pages /
  // localStorage) OR the durable httpOnly auth-token cookie. The cookie survives
  // iOS evicting localStorage, so viewers stay logged in across calls/refreshes.
  const authHeader = request.headers.get("authorization");
  const headerToken =
    authHeader && authHeader.startsWith("Bearer") ? authHeader.split(" ")[1] : null;
  const cookieToken = request.cookies?.get("auth-token")?.value || null;

  // Try the header token first, then the cookie (de-duplicated). Either must
  // pass the JWT signature AND still match the token stored on the User doc —
  // so single-session enforcement and admin "Logout All" keep working unchanged.
  const candidates = [...new Set([headerToken, cookieToken].filter(Boolean))];

  for (const token of candidates) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      await dbConnect();
      const existingUser = await User.findOne({ identityNumber: payload.identityNumber });
      if (existingUser && existingUser.token === token) {
        return {
          identityNumber: payload.identityNumber,
          token,
          adminAuth: !!payload.adminAuth,
          superAdmin: !!payload.superAdmin,
        };
      }
    } catch {
      // invalid/expired token — try the next candidate
    }
  }

  return null;
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
