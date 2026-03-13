/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { DashboardService } from "./dashboard.service";

// get admin dashboard data
const getDashboardData = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const userId = req.user.userId;
    const role = req.user.role;

    const result = await DashboardService.getDashboardData(userId, role);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Dashboard data fetched successfully",
      data: result,
    });
  },
);

// get teacher all summery

const getTeacherDashboardData = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const userId = req.user.userId;

    const result = await DashboardService.getTeacherDashboardData(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Teacher dashboard data fetched successfully",
      data: result,
    });
  },
);

export const DashboardController = {
  getDashboardData,
  getTeacherDashboardData,
};
