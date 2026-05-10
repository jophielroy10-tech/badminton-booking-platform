import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { inspect } from "node:util";
import { env } from "../config/env.js";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;

  if (typeof err === "string") return err;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function getErrorDetails(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      raw: inspect(err, { depth: 6 })
    };
  }

  return {
    name: "UnknownError",
    message: getErrorMessage(err),
    stack: undefined,
    raw: inspect(err, { depth: 10 })
  };
}

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const errorDetails = getErrorDetails(err);

  // This prints the real backend error in Render Logs.
  console.error("GLOBAL_ERROR:", {
    method: req.method,
    path: req.originalUrl,
    body: req.body,
    ...errorDetails,
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
      : getErrorMessage(err) || "Internal server error";

  return res.status(500).json({
    success: false,
    message
  });
};