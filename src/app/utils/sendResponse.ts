/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from "express";

type TResponse = {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: any;
  data?: any;
};

const sendResponse = (res: Response, payload: TResponse) => {
  res.status(payload.statusCode).json({
    statusCode: payload.statusCode,
    success: payload.success,
    message: payload.message,
    meta: payload.meta,
    data: payload.data,
  });
};

export default sendResponse;
