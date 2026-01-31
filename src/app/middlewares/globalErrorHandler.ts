/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (config.node_env === "development") {
    console.error("💥 SERVER ERROR:", err);
  }

  let statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  let message = err.message || "Something went wrong!";
  let errorDetails: any = null;

  /* -------------------- Prisma Known Errors -------------------- */
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        statusCode = httpStatus.CONFLICT;
        message = "Duplicate value already exists";
        errorDetails = err.meta;
        break;

      case "P2003":
        statusCode = httpStatus.BAD_REQUEST;
        message = "Invalid reference ID";
        errorDetails = err.meta;
        break;

      case "P2025":
        statusCode = httpStatus.NOT_FOUND;
        message = "Record not found";
        errorDetails = err.meta;
        break;

      case "P2032": // 🔥 null → non-null mismatch
        statusCode = httpStatus.INTERNAL_SERVER_ERROR;
        message = "Database schema mismatch detected";
        errorDetails = err.meta;
        break;

      default:
        message = "Database error occurred";
        errorDetails = err.meta;
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    /* -------------------- Prisma Validation Error -------------------- */
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid data format";
    errorDetails = err.message;
  } else if (err?.name === "ZodError") {
    /* -------------------- Zod Validation Error -------------------- */
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation failed";
    errorDetails = err.issues.map((issue: any) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err?.name === "JsonWebTokenError") {
    /* -------------------- JWT Errors -------------------- */
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Invalid authentication token";
  } else if (err?.name === "TokenExpiredError") {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Authentication token has expired";
  } else if (err?.code === "LIMIT_FILE_SIZE") {
    /* -------------------- Multer / File Upload Errors -------------------- */
    statusCode = httpStatus.BAD_REQUEST;
    message = "File size too large";
  } else if (err?.name === "MulterError") {
    statusCode = httpStatus.BAD_REQUEST;
    message = err.message;
  } else if (err instanceof SyntaxError && "body" in err) {
    /* -------------------- Syntax / JSON Errors -------------------- */
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid JSON payload";
  } else if (err?.statusCode && err?.message) {
    /* -------------------- Custom ApiError -------------------- */
    statusCode = err.statusCode;
    message = err.message;
  }

  /* -------------------- Final Response -------------------- */
  res.status(statusCode).json({
    success: false,
    message,
    error:
      config.node_env === "development" ? errorDetails || err : errorDetails,
  });
};

export default globalErrorHandler;
