/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { QuizService } from "./quiz.service";

const createQuiz = catchAsync(async (req: Request, res: Response) => {
  const result = await QuizService.createQuiz(req);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Quiz created successfully",
    data: result,
  });
});

/**
 * ✅ Student quizzes (NO correctAnswer)
 */
const getQuizzesForStudent = catchAsync(async (req: Request, res: Response) => {
  const result = await QuizService.getQuizzesForStudent();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Quizzes fetched successfully",
    data: result,
  });
});

/**
 * ✅ Admin quizzes (includes correctAnswer)
 */
const getQuizzesForAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await QuizService.getQuizzesForAdmin();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Quizzes fetched successfully",
    data: result,
  });
});

const updateQuiz = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body;

  const result = await QuizService.updateQuiz(id, payload);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Quiz updated successfully",
    data: result,
  });
});

const deleteQuiz = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await QuizService.deleteQuiz(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Quiz deleted successfully",
    data: result,
  });
});

// ✅ Submit Quiz
const submitQuiz = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;

    const userId = decodedUser.userId || decodedUser.id; // ✅ safe
    const result = await QuizService.submitQuiz(userId, req.body);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Quiz completed",
      data: result,
    });
  },
);

// ✅ Attempt result fetch
const getAttemptResult = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const userId = decodedUser.userId || decodedUser.id;

    const { attemptId } = req.params;
    const result = await QuizService.getAttemptResult(userId, attemptId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Attempt result fetched successfully",
      data: result,
    });
  },
);

// ✅ Attempt history
const getMyAttempts = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const userId = decodedUser.userId || decodedUser.id;

    const quizId = req.query.quizId as string | undefined;
    const result = await QuizService.getMyAttempts(userId, quizId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Attempts fetched successfully",
      data: result,
    });
  },
);

export const QuizController = {
  createQuiz,
  getQuizzesForStudent,
  getQuizzesForAdmin,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
  getAttemptResult,
  getMyAttempts,
};
