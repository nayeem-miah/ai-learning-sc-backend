/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError } from 'axios';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';
import { TCourseFromAi, TCourseSetupPayload } from './course.types';

const AI_BASE = process.env.AI_BASE_API || 'http://206.162.244.135:8000';

const aiClient = axios.create({
  baseURL: AI_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 100000,
});

// ── Error helper
const getAIError = (err: unknown, fallback: string): string => {
  if (err instanceof AxiosError) {
    return (
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      fallback
    );
  }
  return fallback;
};

// STEP 1 — Generate User ID from AI
const generateUserIdFromAI = async (): Promise<{
  user_id: string;
  created_at: string;
  is_active: boolean;
}> => {
  const response = await aiClient.post('/api/v1/user-id/generate');

  const data = response.data?.data;
  if (!data?.user_id) {
    throw new ApiError(502, 'AI did not return a valid user_id');
  }

  return {
    user_id: data.user_id,
    created_at: data.created_at,
    is_active: data.is_active ?? true,
  };
};

// STEP 2 — Generate Course from AI
const generateCourseFromAI = async (
  payload: TCourseFromAi,
): Promise<{
  unique_session_id: string;
  name_of_the_course: string;
  unique_id: string;
  data: any;
}> => {
  const response = await aiClient.post('/api/v1/course/generate', payload);

  const result = response.data;
  if (!result?.unique_session_id) {
    throw new ApiError(
      502,
      'AI did not return a valid unique_session_id from course generate',
    );
  }

  return {
    unique_session_id: result.unique_session_id,
    name_of_the_course: result.name_of_the_course,
    unique_id: result.unique_id,
    data: result.data ?? null,
  };
};

// STEP 3 — Generate Single Module from AI (called in loop)
const generateModuleFromAI = async (payload: {
  unique_session_id: string;
  module_number: number;
}): Promise<{
  module_number: number;
  title: string;
  introduction: string;
  study_topics: any[];
  voice: any;
  total_modules: number;
}> => {
  const response = await aiClient.post(
    '/api/v1/course-lecture/generate-module',
    payload,
  );

  const result = response.data;
  const module = result?.module;

  return {
    module_number: module?.module_number ?? payload.module_number,
    title: module?.title ?? `Module ${payload.module_number}`,
    introduction: module?.introduction ?? '',
    study_topics: module?.study_topics ?? [],
    voice: module?.voice ?? null,
    total_modules: result?.total_modules ?? 0,
  };
};

// QUIZ GENERATE — Delegate entirely to AI
const generateQuizFromAI = async (payload: {
  unique_session_id: string;
  unique_user_id: string;
}): Promise<{
  success: boolean;
  quiz_questions: {
    question_id: string;
    question_number: number;
    question_text: string;
    options: { option_letter: string; option_text: string }[];
  }[];
  total_questions: number;
}> => {
  const response = await aiClient.post('/api/v1/quiz/generate', payload);

  const result = response.data;
  if (!result?.quiz_questions) {
    throw new ApiError(502, 'AI did not return valid quiz questions');
  }

  return {
    success: result.success ?? true,
    quiz_questions: result.quiz_questions,
    total_questions: result.total_questions ?? result.quiz_questions.length,
  };
};

// SUBMIT ANSWER — Delegate to AI
const submitAnswerToAI = async (payload: {
  unique_user_id: string;
  unique_session_id: string;
  question_id: string;
  selected_answer: string;
}): Promise<{
  success: boolean;
  is_correct: boolean;
  correct_answer: string;
  message: string;
}> => {
  const response = await aiClient.post('/api/v1/quiz/submit-answer', payload);

  const result = response.data;
  return {
    success: result.success ?? true,
    is_correct: result.is_correct,
    correct_answer: result.correct_answer,
    message: result.message ?? 'Answer submitted',
  };
};

// GET RESULTS FROM AI
const getQuizResultsFromAI = async (payload: {
  unique_session_id: string;
  unique_user_id: string;
}): Promise<{
  success: boolean;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score_percentage: number;
}> => {
  const response = await aiClient.get(
    `/api/v1/quiz/results/${payload.unique_session_id}/${payload.unique_user_id}`,
  );
  return response.data;
};

// COURSE SETUP
const courseSetup = async (body: TCourseSetupPayload) => {
  const totalModules = body.total_modules;

  // ── AI Step 1: Generate User ID
  let userResult: { user_id: string; created_at: string; is_active: boolean };
  try {
    userResult = await generateUserIdFromAI();
  } catch (err) {
    throw new ApiError(
      502,
      `[Step 1] Failed to generate User ID from AI: ${getAIError(err, 'Unknown error')}`,
    );
  }
  const uniqueUserId = userResult.user_id;

  // ── AI Step 2: Generate Course
  let courseResult: {
    unique_session_id: string;
    name_of_the_course: string;
    unique_id: string;
    data: any;
  };
  try {
    courseResult = await generateCourseFromAI({
      unique_user_id: uniqueUserId,
      ...body,
    });
  } catch (err) {
    throw new ApiError(
      502,
      `[Step 2] Failed to generate Course from AI: ${getAIError(err, 'Unknown error')}`,
    );
  }
  const uniqueSessionId = courseResult.unique_session_id;
  const courseName = courseResult.name_of_the_course;

  // PHASE 1 — Generate all modules + their quizzes in memory
  // If ANY module OR its quiz fails → throw immediately, DB stays clean
  const generatedPairs: {
    module: {
      module_number: number;
      title: string;
      introduction: string;
      study_topics: any[];
      voice: any;
    };
    quizQuestions: {
      question_id: string;
      question_number: number;
      question_text: string;
      options: { option_letter: string; option_text: string }[];
    }[];
  }[] = [];

  for (let i = 1; i <= totalModules; i++) {
    // Step 3a: Generate module content
    let moduleData: {
      module_number: number;
      title: string;
      introduction: string;
      study_topics: any[];
      voice: any;
      total_modules: number;
    };
    try {
      moduleData = await generateModuleFromAI({
        unique_session_id: uniqueSessionId,
        module_number: i,
      });

      console.log('generate course ----------------------', i);
    } catch (err) {
      throw new ApiError(
        502,
        `[Step 3] Module ${i}/${totalModules} generation failed: ${getAIError(err, 'Unknown error')}. No data was saved to the database. Please retry.`,
      );
    }

    // Step 3b: Generate quiz for this module using same session_id
    let quizResult: {
      success: boolean;
      quiz_questions: {
        question_id: string;
        question_number: number;
        question_text: string;
        options: { option_letter: string; option_text: string }[];
      }[];
      total_questions: number;
    };
    try {
      quizResult = await generateQuizFromAI({
        unique_session_id: uniqueSessionId,
        unique_user_id: uniqueUserId,
      });
    } catch (err) {
      throw new ApiError(
        502,
        `[Step 3] Quiz generation for Module ${i}/${totalModules} failed: ${getAIError(err, 'Unknown error')}. No data was saved to the database. Please retry.`,
      );
    }

    generatedPairs.push({
      module: moduleData,
      quizQuestions: quizResult.quiz_questions,
    });
  }

  // Sanity check
  if (generatedPairs.length !== totalModules) {
    throw new ApiError(
      422,
      `[Step 3] Expected ${totalModules} modules but only got ${generatedPairs.length}. No data was saved to the database. Please retry.`,
    );
  }

  // PHASE 2 — DB SAVE (only runs if ALL AI steps succeeded)

  // DB SAVE 1: UserId
  await prisma.userId.upsert({
    where: { userId: uniqueUserId },
    update: { isActive: userResult.is_active },
    create: {
      userId: uniqueUserId,
      isActive: userResult.is_active,
    },
  });

  // DB SAVE 2: CourseNameGenerator
  await prisma.courseNameGenerator.upsert({
    where: { uniqueSessionId },
    update: {
      generatedCourseName: courseName,
      courseName: body.course_name,
    },
    create: {
      uniqueSessionId,
      uniqueUserId,
      courseName: body.course_name,
      generatedCourseName: courseName,
      subject: body.subject,
      targetGradeLevel: body.target_grade_level,
      courseLength: body.course_length,
      semesterCount: body.semester_count,
      diagnosticTestBeforeCourse: body.diagnostic_test_before_course,
      retestingAllowed: body.retesting_allowed,
      retestingCount: body.retesting_count,
      quizzesPerModule: body.quizzes_per_module,
      midtermExamination: body.midterm_examination,
      finalExamination: body.final_examination,
      totalQuizQuestions: body.total_quiz_questions,
      masteryRequirement: body.mastery_requirement,
      totalModules: body.total_modules,
      estimatedDurationMinPerClass: body.estimated_duration_min_per_class,
    },
  });

  // DB SAVE 3: CourseLectureGenerator + QuizQuestion per module
  for (const pair of generatedPairs) {
    const mod = pair.module;

    // Save module (skip if already exists)
    let savedModule = await prisma.courseLectureGenerator.findFirst({
      where: { uniqueSessionId, moduleNumber: mod.module_number },
    });

    if (!savedModule) {
      savedModule = await prisma.courseLectureGenerator.create({
        data: {
          uniqueSessionId,
          moduleNumber: mod.module_number,
          moduleTitle: mod.title,
          introduction: mod.introduction,
          studyTopics: mod.study_topics as any,
          voiceData: mod.voice as any,
        },
      });
    }

    // Save quiz questions linked to this module
    await Promise.all(
      pair.quizQuestions.map((q) => {
        const getOpt = (letter: string) =>
          q.options.find((o) => o.option_letter === letter)?.option_text ||
          `Option ${letter}`;
        return prisma.quizQuestion.upsert({
          where: { questionId: q.question_id },
          update: { questionText: q.question_text },
          create: {
            questionId: q.question_id,
            uniqueSessionId,
            moduleId: savedModule.id,
            questionNumber: q.question_number,
            questionText: q.question_text,
            optionA: getOpt('A'),
            optionB: getOpt('B'),
            optionC: getOpt('C'),
            optionD: getOpt('D'),
            correctAnswer: 'PENDING',
          },
        });
      }),
    );
  }

  return {
    success: true,
    unique_user_id: uniqueUserId,
    unique_session_id: uniqueSessionId,
    course_title: courseName,
    total_modules: totalModules,
    modules_generated: generatedPairs.length,
    total_quiz_questions_generated: generatedPairs.reduce(
      (sum, p) => sum + p.quizQuestions.length,
      0,
    ),
    user_data: {
      user_id: userResult.user_id,
      created_at: userResult.created_at,
      is_active: userResult.is_active,
    },
    course_data: courseResult.data,
  };
};

const generateQuiz = async (body: {
  unique_user_id: string;
  unique_session_id: string;
}) => {
  try {
    const result = await generateQuizFromAI(body);
    const formattedQuestions = result.quiz_questions.map((q) => ({
      question_id: q.question_id,
      question_number: q.question_number,
      question_text: q.question_text,
      options: q.options.map((opt) => ({
        option_letter: opt.option_letter,
        text: opt.option_text,
      })),
    }));

    await Promise.all(
      result.quiz_questions.map((q) => {
        const getOpt = (letter: string) =>
          q.options.find((o) => o.option_letter === letter)?.option_text ||
          `Option ${letter}`;
        const qData = {
          questionId: q.question_id,
          uniqueSessionId: body.unique_session_id,
          questionNumber: q.question_number,
          questionText: q.question_text,
          optionA: getOpt('A'),
          optionB: getOpt('B'),
          optionC: getOpt('C'),
          optionD: getOpt('D'),
          correctAnswer: 'PENDING',
        };
        return prisma.quizQuestion.upsert({
          where: { questionId: q.question_id },
          update: { questionText: q.question_text },
          create: qData,
        });
      }),
    );
    return {
      success: true,
      quiz_questions: formattedQuestions,
      total_questions: result.total_questions,
    };
  } catch (err) {
    throw new ApiError(
      502,
      `Failed to generate quiz from AI: ${getAIError(err, 'Unknown error')}`,
    );
  }
};

const submitQuizAnswer = async (body: {
  unique_user_id: string;
  unique_session_id: string;
  question_id: string;
  selected_answer: string;
}) => {
  try {
    const result = await submitAnswerToAI(body);

    //  DB SAVE: QuizAnswer collection
    await prisma.quizAnswer.create({
      data: {
        uniqueUserId: body.unique_user_id,
        uniqueSessionId: body.unique_session_id,
        questionId: body.question_id,
        selectedAnswer: body.selected_answer.toUpperCase(),
        correctAnswer: result.correct_answer,
        isCorrect: result.is_correct,
      },
    });

    //  DB UPDATE: Update correctAnswer in QuizQuestion (now we know)
    await prisma.quizQuestion.updateMany({
      where: { questionId: body.question_id },
      data: { correctAnswer: result.correct_answer },
    });

    return {
      success: result.success,
      is_correct: result.is_correct,
      correct_answer: result.correct_answer,
    };
  } catch (err) {
    throw new ApiError(
      502,
      `Failed to submit answer to AI: ${getAIError(err, 'Unknown error')}`,
    );
  }
};

const getQuizResults = async (body: {
  unique_session_id: string;
  unique_user_id: string;
}) => {
  try {
    return await getQuizResultsFromAI(body);
  } catch (err) {
    throw new ApiError(
      502,
      `Failed to get quiz results from AI: ${getAIError(err, 'Unknown error')}`,
    );
  }
};

// GET ALL COURSES — modules with their quiz questions nested inside
const getAllCourses = async () => {
  const courses = await prisma.courseNameGenerator.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { userId: true, isActive: true },
      },
      modules: {
        orderBy: { moduleNumber: 'asc' },
        select: {
          id: true,
          moduleNumber: true,
          moduleTitle: true,
          introduction: true,
          studyTopics: true,
          voiceData: true,
          createdAt: true,
          // Quiz questions linked to THIS module via moduleId
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
            select: {
              id: true,
              questionId: true,
              questionNumber: true,
              questionText: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
              correctAnswer: true,
            },
          },
        },
      },
    },
  });

  return courses;
};

// GET SINGLE COURSE BY SESSION ID
const getCourseBySession = async (uniqueSessionId: string) => {
  const course = await prisma.courseNameGenerator.findUnique({
    where: { uniqueSessionId },
    include: {
      user: {
        select: { userId: true, isActive: true },
      },
      modules: {
        orderBy: { moduleNumber: 'asc' },
        select: {
          id: true,
          moduleNumber: true,
          moduleTitle: true,
          introduction: true,
          studyTopics: true,
          voiceData: true,
          createdAt: true,
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
            select: {
              id: true,
              questionId: true,
              questionNumber: true,
              questionText: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
              correctAnswer: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, `Course not found for session: ${uniqueSessionId}`);
  }

  return course;
};

export const CourseSetupService = {
  courseSetup,
  generateQuiz,
  submitQuizAnswer,
  getQuizResults,
  getAllCourses,
  getCourseBySession,
};

