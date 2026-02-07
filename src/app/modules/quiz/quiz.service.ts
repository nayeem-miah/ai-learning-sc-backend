/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { Request } from "express";
import { prisma } from "../../prisma/prisma";

const createQuiz = async (req: Request) => {
  const payload = req.body;

  // 1️⃣ Call AI API
  const aiResponse = await axios.post(
    "http://206.162.244.134:8750/generate-test",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const aiQuiz = aiResponse.data;

  // 2️⃣ Save quiz using given schema
  const quiz = await prisma.quiz.create({
    data: {
      courseName: aiQuiz.course_name,
      subject: aiQuiz.subject,
      targetGradeLevel: aiQuiz.target_grade_level,

      title: `${aiQuiz.subject} Diagnostic Quiz`,
      isAdaptive: false,

      questions: {
        create: aiQuiz.questions.map((q: any) => ({
          questionNumber: q.question_number,
          questionText: q.question,
          correctAnswer: q.correct_answer,
          explanation: q.explanation ?? null,

          // schema অনুযায়ী options = String[]
          options: q.options.map((opt: any) => opt.text),
        })),
      },
    },
    include: {
      questions: true,
    },
  });

  return quiz;
};

const getQuizzes = async () => {
  return prisma.quiz.findMany({
    include: {
      questions: true,
    },
  });
};

export const QuizService = {
  createQuiz,
  getQuizzes
};
