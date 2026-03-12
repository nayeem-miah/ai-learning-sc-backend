/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AttendanceService } from "./attendance.service";

const startClass = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { courseId, moduleId } = req.body;
  const userId = req.user.userId;
  const data = await AttendanceService.startClass(courseId, moduleId, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class started successfully",
    data: data,
  });
});

const joinClass = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const studentId = req.user.userId;
  const { courseId, moduleId } = req.body;

  const data = await AttendanceService.joinClass(courseId, moduleId, studentId);

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
  const { courseId: paramsCourseId } = req.params;
  const { month, year, courseId: queryCourseId, course } = req.query;

  // Use courseId from params if not 'all', otherwise fallback to query params
  const courseId = paramsCourseId !== "all" ? paramsCourseId : (queryCourseId || course) as string;

  const result = await AttendanceService.getStudentAttendance(
    studentId, 
    courseId, 
    month ? Number(month) : undefined, 
    year ? Number(year) : undefined
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance fetched successfully",
    data: result,
  });
});

const getAllAttendanceRecords = catchAsync(async (req: Request, res: Response) => {
  const { attendanceId } = req.params;
  const result = await AttendanceService.getAllAttendanceRecords(attendanceId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance records fetched successfully",
    data: result,
  });
});

const updateAttendanceRecord = catchAsync(async (req: Request, res: Response) => {
  const { attendanceId, studentId } = req.params;
  const { status } = req.body;

  const result = await AttendanceService.updateAttendanceRecord(attendanceId, studentId, status);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance updated successfully",
    data: result,
  });
});

const markAllAsPresent = catchAsync(async (req: Request, res: Response) => {
  const { attendanceId } = req.params;
  const result = await AttendanceService.markAllAsPresent(attendanceId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All students marked as present",
    data: result,
  });
});

const markJoinedAsPresent = catchAsync(async (req: Request, res: Response) => {
  const { attendanceId } = req.params;
  const result = await AttendanceService.markJoinedAsPresent(attendanceId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Joined students attendance marked successfully",
    data: result,
  });
});

const getJoinedStudents = catchAsync(async (req: Request, res: Response) => {
  const { attendanceId } = req.params;
  const result = await AttendanceService.getJoinedStudents(attendanceId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Joined students fetched successfully",
    data: result,
  });
});

export const AttendanceController = {
  startClass,
  joinClass,
  updateAttendanceRecord,
  markAllAsPresent,
  markJoinedAsPresent,
  getJoinedStudents,
  getAttendanceSummary,
  getStudentAttendance,
  getAllAttendanceRecords,
};