import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";

export type TokenPayload = {
  userId: string;
  role: Role;
};

export const signJwt = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);

export const verifyJwt = (token: string) => jwt.verify(token, env.JWT_SECRET) as TokenPayload;
