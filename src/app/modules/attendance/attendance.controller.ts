/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AttendanceService } from "./attendance.service";

const startClass = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { courseId } = req.body;
  const userId = req.user.userId;
  const data = await AttendanceService.startClass(courseId, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class started successfully",
    data: data,
  });
});

const joinClass = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const studentId = req.user.userId;
  const { courseId } = req.body;

  const data = await AttendanceService.joinClass(courseId, studentId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class joined successfully",
    data: data,
  });
});


const getAttendanceSummary = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { attendanceId } = req.params;

  const result = await AttendanceService.getAttendanceSummary(attendanceId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Summary fetched successfully",
    data: result,
  });
});


const getStudentAttendance = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const studentId = req.user.userId;
  const { courseId } = req.params;

  const result = await AttendanceService.getStudentAttendance(studentId, courseId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance fetched successfully",
    data: result,
  });
});

export const AttendanceController = {
  startClass,
  joinClass,
  getAttendanceSummary,
  getStudentAttendance
};