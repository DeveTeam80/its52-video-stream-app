import jwt from "jsonwebtoken";
import { SESSION_LIFETIME_SECONDS } from "./constants";

export function createJWT(id, extraClaims = {}) {
  return jwt.sign(
    { identityNumber: id, ...extraClaims },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_LIFETIME_SECONDS }
  );
}
