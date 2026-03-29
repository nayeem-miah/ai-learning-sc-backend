/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await NotificationService.getMyNotifications(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notifications retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await NotificationService.markAsRead(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification marked as read successfully",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const result = await NotificationService.markAllAsRead(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All notifications marked as read successfully",
    data: result,
  });
});

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
