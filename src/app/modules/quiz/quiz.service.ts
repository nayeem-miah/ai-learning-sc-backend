/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { Request } from "express";
import { prisma } from "../../prisma/prisma";

interface SubmitPayload {
  quizId: string;
  answers: { questionId: string; selectedOption: string }[];
}

const createQuiz = async (req: Request) => {
  const payload = req.body;

  const aiResponse = await axios.post(
    "http://206.162.244.134:8750/generate-test",
    payload,
    { headers: { "Content-Type": "application/json" } },
  );

  const aiQuiz = aiResponse.data;

  if (!aiQuiz?.questions?.length) {
    throw new Error("AI did not return valid quiz questions");
  }

  const quiz = await prisma.quiz.create({
    data: {
      courseName: aiQuiz.course_name,
      subject: aiQuiz.subject,
      targetGradeLevel: String(aiQuiz.target_grade_level),
      title: `${aiQuiz.subject} Diagnostic Quiz`,
      isAdaptive: false,
      questions: {
        create: aiQuiz.questions.map((q: any) => ({
          questionNumber: q.question_number,
          questionText: q.question,
          correctAnswer: q.correct_answer,
          explanation: q.explanation ?? null,
          options: q.options.map((opt: any) => opt.text),
        })),
      },
    },
    include: { questions: true },
  });

  return quiz;
};

const getQuizzesForAdmin = async () => {
  return prisma.quiz.findMany({
    include: {
      questions: { orderBy: { questionNumber: "asc" as any } },
    },
  });
};

const getQuizzesForStudent = async () => {
  return prisma.quiz.findMany({
    select: {
      id: true,
      courseName: true,
      subject: true,
      targetGradeLevel: true,
      title: true,
      isAdaptive: true,
      questions: {
        select: {
          id: true,
          quizId: true,
          questionNumber: true,
          questionText: true,
          options: true,
        },
        orderBy: { questionNumber: "asc" as any },
      },
    },
  });
};

const updateQuiz = async (id: string, payload: any) => {
  return prisma.quiz.update({
    where: { id },
    data: {
      courseName: payload.courseName,
      subject: payload.subject,
      targetGradeLevel: payload.targetGradeLevel,
      title: payload.title,
      isAdaptive: payload.isAdaptive,
    },
  });
};

const deleteQuiz = async (quizId: string) => {
  return prisma.quiz.delete({ where: { id: quizId } });
};

const submitQuiz = async (userId: string, payload: SubmitPayload) => {
  if (!userId) throw new Error("Unauthorized: userId missing from token");

  const quiz = await prisma.quiz.findUnique({
    where: { id: payload.quizId },
    include: { questions: true },
  });

  if (!quiz) throw new Error("Quiz not found");

  const questionIds = new Set(quiz.questions.map((q) => q.id));
  for (const ans of payload.answers) {
    if (!questionIds.has(ans.questionId)) {
      throw new Error("Invalid questionId found in answers");
    }
  }

  let correctCount = 0;

  const perQuestion = quiz.questions.map((q) => {
    const userAnswer = payload.answers.find((a) => a.questionId === q.id);
    const selected = userAnswer?.selectedOption ?? null;

    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) correctCount++;

    return {
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      selectedOption: selected,
      correctOption: q.correctAnswer,
      isCorrect,
      explanation: q.explanation ?? null,
    };
  });

  const total = quiz.questions.length;
  const wrong = total - correctCount;
  const accuracy = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  const points = correctCount * 10;
  const passed = accuracy >= 60;

  const attempt = await prisma.quizAttempt.create({
    data: {
      studentId: userId, // ✅ userId stored in studentId field
      quizId: quiz.id,
      total,
      correct: correctCount,
      wrong,
      accuracy,
      points,
      passed,
      answers: {
        create: perQuestion.map((r) => ({
          questionId: r.questionId,
          selectedOption: r.selectedOption,
          correctOption: r.correctOption,
          isCorrect: r.isCorrect,
          explanation: r.explanation,
        })),
      },
    },
    include: { answers: true },
  });

  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    totalQuestions: total,
    correctAnswers: correctCount,
    wrongAnswers: wrong,
    accuracy,
    pointsEarned: points,
    results: perQuestion,
  };
};

const getAttemptResult = async (userId: string, attemptId: string) => {
  if (!userId) throw new Error("Unauthorized: userId missing from token");

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, studentId: userId },
    include: {
      quiz: { select: { id: true, title: true, subject: true } },
      answers: true,
    },
  });

  if (!attempt) throw new Error("Attempt not found");

  const questions = await prisma.question.findMany({
    where: { quizId: attempt.quizId },
    select: {
      id: true,
      questionNumber: true,
      questionText: true,
      options: true,
    },
    orderBy: { questionNumber: "asc" as any },
  });

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const results = questions.map((q) => {
    const a = answerMap.get(q.id);
    return {
      questionId: q.id,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      options: q.options,
      selectedOption: a?.selectedOption ?? null,
      correctOption: a?.correctOption ?? null,
      isCorrect: a?.isCorrect ?? false,
      explanation: a?.explanation ?? null,
    };
  });

  return {
    attemptId: attempt.id,
    quiz: attempt.quiz,
    totalQuestions: attempt.total,
    correctAnswers: attempt.correct,
    wrongAnswers: attempt.wrong,
    accuracy: attempt.accuracy,
    pointsEarned: attempt.points ?? 0,
    attemptedAt: attempt.attemptedAt,
    results,
  };
};

const getMyAttempts = async (userId: string, quizId?: string) => {
  if (!userId) throw new Error("Unauthorized: userId missing from token");

  return prisma.quizAttempt.findMany({
    where: { studentId: userId, ...(quizId ? { quizId } : {}) },
    select: {
      id: true,
      quizId: true,
      total: true,
      correct: true,
      wrong: true,
      accuracy: true,
      points: true,
      passed: true,
      attemptedAt: true,
    },
    orderBy: { attemptedAt: "desc" as any },
  });
};

export const QuizService = {
  createQuiz,
  getQuizzesForAdmin,
  getQuizzesForStudent,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
  getAttemptResult,
  getMyAttempts,
};
