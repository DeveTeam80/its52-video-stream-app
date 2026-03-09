import jwt from "jsonwebtoken";

export function createJWT(id, extraClaims = {}) {
  return jwt.sign(
    { identityNumber: id, ...extraClaims },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_LIFETIME }
  );
}
