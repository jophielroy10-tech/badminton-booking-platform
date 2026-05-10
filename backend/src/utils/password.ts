import bcrypt from "bcryptjs";

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export const comparePassword = (password: string, hashedPassword: string) => bcrypt.compare(password, hashedPassword);
