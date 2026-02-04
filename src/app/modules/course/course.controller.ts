/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import httpStatus from "http-status";

import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { CourseService } from "./course.service";

const createCourse = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;

    const result = await CourseService.createCourse({
      ...req.body,
      teacherId: decodedUser.userId,
    });

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Course created successfully",
      data: result,
    });
  },
);

const getMyCourses = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;

    const result = await CourseService.getMyCourses(decodedUser.userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Courses retrieved successfully",
      data: result,
    });
  },
);

const getSingleCourse = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const { id } = req.params;

    const result = await CourseService.getSingleCourse(id, decodedUser.userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Course retrieved successfully",
      data: result,
    });
  },
);

const updateCourse = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const { id } = req.params;

    const result = await CourseService.updateCourse(
      id,
      decodedUser.userId,
      req.body,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Course updated successfully",
      data: result,
    });
  },
);

const deleteCourse = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const { id } = req.params;

    await CourseService.deleteCourse(id, decodedUser.userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Course deleted successfully",
    });
  },
);

export const CourseController = {
  createCourse,
  getMyCourses,
  getSingleCourse,
  updateCourse,
  deleteCourse,
};
