import jwt from "jsonwebtoken";
import { SESSION_LIFETIME_SECONDS } from "./constants";

export function createJWT(id, extraClaims = {}, expiresIn = SESSION_LIFETIME_SECONDS) {
  return jwt.sign(
    { identityNumber: id, ...extraClaims },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}
