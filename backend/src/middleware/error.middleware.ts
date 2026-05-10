import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env.js";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const errorInfo =
    err instanceof Error
      ? {
          name: err.name,
          message: err.message,
          stack: err.stack
        }
      : {
          name: "UnknownError",
          message: String(err),
          stack: undefined
        };

  // This will print the real error in Render Logs
  console.error("GLOBAL_ERROR:", {
    method: req.method,
    path: req.originalUrl,
    ...errorInfo,
    prismaCode:
      err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined,
    prismaMeta:
      err instanceof Prisma.PrismaClientKnownRequestError ? err.meta : undefined
  });

  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    return res.status(422).json({
      success: false,
      message: message || "Validation failed"
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      err.meta.target.includes("slotId")
    ) {
      return res.status(409).json({
        success: false,
        message: "This slot already has an active booking. Please choose another slot."
      });
    }

    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A duplicate record already exists."
      });
    }
  }

  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";

  return res.status(500).json({
    success: false,
    message
  });
};