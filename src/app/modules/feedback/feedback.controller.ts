/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role } from "@prisma/client";
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { FeedbackService } from "./feedback.service";

const createFeedback = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const teacherId = req.user.userId;

    const result = await FeedbackService.createFeedback(teacherId, req.body);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Feedback submitted successfully",
      data: result,
    });
  },
);

const getMyFeedbacks = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const role = req.user.role;

    let result;
    if (role === Role.TEACHER) {
      result = await FeedbackService.getTeacherFeedbacks(decodedUser.UserId);
    } else {
      // For Student and Admin
      result = await FeedbackService.getStudentFeedbacks(decodedUser.UserId);
    }

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Feedbacks fetched successfully",
      data: result,
    });
  },
);

const getStudentFeedbacks = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const { studentId } = req.params;

    const result = await FeedbackService.getStudentFeedbacks(studentId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Feedbacks fetched successfully",
      data: result,
    });
  },
);

export const FeedbackController = {
  createFeedback,
  getMyFeedbacks,
  getStudentFeedbacks,
};
