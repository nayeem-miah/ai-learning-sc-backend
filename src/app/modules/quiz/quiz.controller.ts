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

const getQuizzes = catchAsync(async (req: Request, res: Response) => {
  const result = await QuizService.getQuizzes();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Quizzes fetched successfully",
    data: result,
  });
});

export const QuizController = {
  createQuiz,
  getQuizzes
};
