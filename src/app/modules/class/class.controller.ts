import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ClassService } from "./class.service";

const createClass = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassService.createClass(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Class created successfully",
    data: result,
  });
});

const getAllClasses = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassService.getAllClasses();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Classes retrieved successfully",
    data: result,
  });
});

const deleteClass = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  await ClassService.deleteClass(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Class deleted successfully",
  });
});

export const ClassController = {
  createClass,
  getAllClasses,
  deleteClass,
};
