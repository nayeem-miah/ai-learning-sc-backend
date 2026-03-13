/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError } from 'axios';
import config from '../../config';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';
import { TCourseFromAi, TCourseSetupPayload } from './course.types';

const AI_BASE = config.AI_BASE_API || 'http://206.162.244.135:8000';

const aiClient = axios.create({
  baseURL: AI_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 300000,
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
const generateModuleFromAI = async (
  payload: any,
): Promise<{
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
const generateQuizFromAI = async (
  payload: any,
): Promise<{
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
  console.log('----------------------- calling ai apis', payload);
  const response = await aiClient.post('/api/v1/quiz/submit-answer', payload);
  console.log(response.data);
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

  const existingClass = await prisma.class.findUnique({
    where: {
      id: body.target_grade_level,
    },
  });

  if (!existingClass) {
    throw new ApiError(404, 'Class not found');
  }

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
      ...body,
      unique_user_id: uniqueUserId,
      target_grade_level: existingClass.gradeLevel,
    });
  } catch (err) {
    throw new ApiError(
      502,
      `[Step 2] Failed to generate Course from AI: ${getAIError(err, 'Unknown error')}`,
    );
  }
  const uniqueSessionId = courseResult.unique_session_id;
  const courseName = courseResult.name_of_the_course;

  // ── AI Step 3: Generate Modules
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
        ...body,
        unique_session_id: uniqueSessionId,
        module_number: i,
        target_grade_level: existingClass.gradeLevel,
      });

      console.log('generated module ----------------------', i);
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
        ...body,
        unique_session_id: uniqueSessionId,
        unique_user_id: uniqueUserId,
        module_number: i,
        target_grade_level: existingClass.gradeLevel,
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
  return await prisma.$transaction(
    async (tx) => {
      // DB SAVE 1: UserId
      await tx.userId.upsert({
        where: { userId: uniqueUserId },
        update: { isActive: userResult.is_active },
        create: {
          userId: uniqueUserId,
          isActive: userResult.is_active,
        },
      });

      console.log('data insart start------------------------------');

      // DB SAVE 2: CourseNameGenerator
      const aiCourseRecord = await tx.courseNameGenerator.upsert({
        where: { uniqueSessionId },
        update: {
          generatedCourseName: courseName,
          courseName: body.course_name,
          targetGradeLevel: existingClass.gradeLevel,
          classId: existingClass.id,
          ...(body.description !== undefined && {
            description: body.description,
          }),
          ...(body.is_published !== undefined && {
            isPublished: body.is_published,
          }),
          ...(body.start_date !== undefined && {
            startDate: body.start_date ? new Date(body.start_date) : null,
          }),
          ...(body.start_time !== undefined && { startTime: body.start_time }),
          ...(body.end_time !== undefined && { endTime: body.end_time }),
        },
        create: {
          uniqueSessionId,
          uniqueUserId,
          courseName: body.course_name,
          generatedCourseName: courseName,
          subject: body.subject,
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
          classId: existingClass.id, // Always link to the class found
          targetGradeLevel: existingClass.gradeLevel,
          // Optional Course-mirrored fields
          description: body.description,
          isPublished: body.is_published ?? false,
          startDate: body.start_date ? new Date(body.start_date) : undefined,
          startTime: body.start_time,
          endTime: body.end_time,
        },
      });

      // Auto-Enroll Students with matching Grade Level
      const matchingStudents = await tx.studentProfile.findMany({
        where: {
          gradeLevel: existingClass.gradeLevel,
        },
        select: {
          userId: true,
        },
      });

      if (matchingStudents.length > 0) {
        // 1. Find who is already enrolled in this AI course
        const existingEnrollments = await tx.enrollment.findMany({
          where: {
            aiCourseId: aiCourseRecord.id,
            studentId: { in: matchingStudents.map((s) => s.userId) },
          },
          select: { studentId: true },
        });

        const existingStudentIds = new Set(
          existingEnrollments.map((e) => e.studentId),
        );

        console.log('enrollemnt -----------------------0');
        // 2. Only enroll those who are NOT already enrolled
        const enrollmentData = matchingStudents
          .filter((student) => !existingStudentIds.has(student.userId))
          .map((student) => ({
            studentId: student.userId,
            aiCourseId: aiCourseRecord.id,
            courseId: null,
          }));

        if (enrollmentData.length > 0) {
          await tx.enrollment.createMany({
            data: enrollmentData as any,
          });
        }
      }
      console.log('enrolllmenert ----------------------1');
      // DB SAVE 3: CourseLectureGenerator + QuizQuestion per module
      for (const pair of generatedPairs) {
        const mod = pair.module;

        // Save module (skip if already exists)
        let savedModule = await tx.courseLectureGenerator.findFirst({
          where: { uniqueSessionId, moduleNumber: mod.module_number },
        });

        if (!savedModule) {
          savedModule = await tx.courseLectureGenerator.create({
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
        if (pair.quizQuestions && pair.quizQuestions.length > 0) {
          await Promise.all(
            pair.quizQuestions.map(async (q) => {
              const getOpt = (letter: string) =>
                q.options.find((o) => o.option_letter === letter)
                  ?.option_text || `Option ${letter}`;

              // Construct a highly unique key to prevent cross-module overwriting
              const uniqueQuestionKey = `${uniqueSessionId}_MOD${mod.module_number}_${q.question_id}`;

              return tx.quizQuestion.upsert({
                where: { questionId: uniqueQuestionKey },
                update: {
                  questionText: q.question_text,
                  moduleId: savedModule!.id,
                  correctAnswer: 'PENDING',
                },
                create: {
                  questionId: uniqueQuestionKey,
                  originalQuestionId: q.question_id,
                  uniqueSessionId,
                  moduleId: savedModule!.id,
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
      }

      return {
        success: true,
        unique_user_id: uniqueUserId,
        id: aiCourseRecord.id,
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
    },
    {
      maxWait: 50000,
      timeout: 60000,
    },
  );
};

const generateQuiz = async (body: {
  unique_user_id: string;
  unique_session_id: string;
  module_number: number;
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
          moduleId: null, // General quizzes might not have a module link initially
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
    // 1. Find the question in our DB to get its original AI questionId
    const question = await prisma.quizQuestion.findUnique({
      where: { questionId: body.question_id },
    });

    if (!question) {
      throw new ApiError(
        404,
        `Question not found in database: ${body.question_id}`,
      );
    }

    // 2. Submit the ORIGINAL ID to AI
    const result = await submitAnswerToAI({
      ...body,
      question_id: question.originalQuestionId || question.questionId,
    });

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
      class: true,

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
      class: true, // Added to show class details

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

const submitModuleQuiz = async (
  studentId: string,
  body: {
    unique_user_id: string;
    unique_session_id: string;
    module_id: string; // CourseLectureGenerator.id
    answers: { question_id: string; selected_answer: string }[];
  },
) => {
  // 1. Verify the module belongs to this session
  const module = await prisma.courseLectureGenerator.findFirst({
    where: {
      id: body.module_id,
      uniqueSessionId: body.unique_session_id,
    },
    include: {
      quizQuestions: true,
    },
  });

  if (!module) {
    throw new ApiError(
      404,
      `Module not found for session: ${body.unique_session_id}`,
    );
  }

  // 2. Ensure UserId row exists (upsert-safe)
  await prisma.userId.upsert({
    where: { userId: body.unique_user_id },
    update: {},
    create: { userId: body.unique_user_id, isActive: true },
  });

  // 3. Submit each answer to AI, collect results
  const submissionResults: {
    question_id: string;
    selected_answer: string;
    is_correct: boolean;
    correct_answer: string;
  }[] = [];

  for (const ans of body.answers) {
    let aiResult: {
      success: boolean;
      is_correct: boolean;
      correct_answer: string;
      message: string;
    };
    try {
      aiResult = await submitAnswerToAI({
        unique_user_id: body.unique_user_id,
        unique_session_id: body.unique_session_id,
        question_id: ans.question_id,
        selected_answer: ans.selected_answer,
      });
    } catch (err) {
      throw new ApiError(
        502,
        `Failed to submit answer for question ${ans.question_id}: ${getAIError(err, 'Unknown error')}`,
      );
    }

    submissionResults.push({
      question_id: ans.question_id,
      selected_answer: ans.selected_answer.toUpperCase(),
      is_correct: aiResult.is_correct,
      correct_answer: aiResult.correct_answer,
    });

    // Update correctAnswer in QuizQuestion table
    await prisma.quizQuestion.updateMany({
      where: { questionId: ans.question_id },
      data: { correctAnswer: aiResult.correct_answer },
    });
  }

  // 4. Delete any previous answers by this user for this module's questions
  const moduleQuestionIds = module.quizQuestions.map((q) => q.questionId);
  await prisma.quizAnswer.deleteMany({
    where: {
      uniqueUserId: body.unique_user_id,
      uniqueSessionId: body.unique_session_id,
      questionId: { in: moduleQuestionIds },
    },
  });

  // 5. Bulk-create new answers
  await prisma.quizAnswer.createMany({
    data: submissionResults.map((r) => ({
      uniqueUserId: body.unique_user_id,
      uniqueSessionId: body.unique_session_id,
      questionId: r.question_id,
      selectedAnswer: r.selected_answer,
      correctAnswer: r.correct_answer,
      isCorrect: r.is_correct,
    })),
  });

  // Save aiUserId to StudentProfile using the INTERNAL studentId
  await prisma.studentProfile.update({
    where: { userId: studentId },
    data: { aiUserId: body.unique_user_id } as any,
  });

  // 6. Calculate result summary
  const totalQuestions = submissionResults.length;
  const correctCount = submissionResults.filter((r) => r.is_correct).length;
  const wrongCount = totalQuestions - correctCount;
  const scorePercentage =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // 7. Mark as completed
  await prisma.lessonProgress.upsert({
    where: {
      studentId_lessonId: {
        studentId,
        lessonId: body.module_id,
      },
    },
    update: {
      isCompleted: true,
      completedAt: new Date(),
    },
    create: {
      studentId,
      lessonId: body.module_id,
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  return {
    success: true,
    unique_user_id: body.unique_user_id,
    unique_session_id: body.unique_session_id,
    module_id: body.module_id,
    module_number: module.moduleNumber,
    module_title: module.moduleTitle,
    total_questions: totalQuestions,
    correct_answers: correctCount,
    wrong_answers: wrongCount,
    score_percentage: scorePercentage,
    details: submissionResults,
  };
};

const completeLesson = async (studentId: string, lessonId: string) => {
  return await prisma.lessonProgress.upsert({
    where: {
      studentId_lessonId: {
        studentId,
        lessonId,
      },
    },
    update: {
      isCompleted: true,
      completedAt: new Date(),
    },
    create: {
      studentId,
      lessonId,
      isCompleted: true,
      completedAt: new Date(),
    },
  });
};


const getModuleQuizResult = async (query: {
  unique_user_id: string;
  unique_session_id: string;
  module_id: string;
}) => {
  // Find the module
  const module = await prisma.courseLectureGenerator.findFirst({
    where: {
      id: query.module_id,
      uniqueSessionId: query.unique_session_id,
    },
    include: { quizQuestions: true },
  });

  if (!module) {
    throw new ApiError(
      404,
      `Module not found for session: ${query.unique_session_id}`,
    );
  }

  const moduleQuestionIds = module.quizQuestions.map((q) => q.questionId);

  const answers = await prisma.quizAnswer.findMany({
    where: {
      uniqueUserId: query.unique_user_id,
      uniqueSessionId: query.unique_session_id,
      questionId: { in: moduleQuestionIds },
    },
    orderBy: { submittedAt: 'asc' },
  });

  if (answers.length === 0) {
    throw new ApiError(404, `No quiz submission found for this user & module`);
  }

  const totalQuestions = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongCount = totalQuestions - correctCount;
  const scorePercentage =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    unique_user_id: query.unique_user_id,
    unique_session_id: query.unique_session_id,
    module_id: query.module_id,
    module_number: module.moduleNumber,
    module_title: module.moduleTitle,
    total_questions: totalQuestions,
    correct_answers: correctCount,
    wrong_answers: wrongCount,
    score_percentage: scorePercentage,
    submitted_at: answers[answers.length - 1].submittedAt,
    details: answers.map((a) => ({
      question_id: a.questionId,
      selected_answer: a.selectedAnswer,
      correct_answer: a.correctAnswer,
      is_correct: a.isCorrect,
    })),
  };
};

// ─────────────────────────────────────────────────────────────
// GET ALL MODULE QUIZ RESULTS  — public, everyone can see
// Groups by session → module → all user submissions
// ─────────────────────────────────────────────────────────────
const getModuleQuizResultPublic = async (query: {
  unique_session_id?: string;
  module_id?: string;
}) => {
  const whereClause: Record<string, unknown> = {};
  if (query.unique_session_id) {
    whereClause.uniqueSessionId = query.unique_session_id;
  }

  // Optionally filter to a specific module's questions
  if (query.module_id) {
    const module = await prisma.courseLectureGenerator.findFirst({
      where: { id: query.module_id },
      include: { quizQuestions: { select: { questionId: true } } },
    });
    if (!module) {
      throw new ApiError(404, `Module not found: ${query.module_id}`);
    }
    whereClause.questionId = {
      in: module.quizQuestions.map((q) => q.questionId),
    };
  }

  const allAnswers = await prisma.quizAnswer.findMany({
    where: whereClause,
    orderBy: { submittedAt: 'desc' },
  });

  // Group by uniqueUserId
  const byUser: Record<
    string,
    {
      unique_user_id: string;
      total_questions: number;
      correct_answers: number;
      wrong_answers: number;
      score_percentage: number;
      latest_submitted_at: Date;
    }
  > = {};

  for (const ans of allAnswers) {
    if (!byUser[ans.uniqueUserId]) {
      byUser[ans.uniqueUserId] = {
        unique_user_id: ans.uniqueUserId,
        total_questions: 0,
        correct_answers: 0,
        wrong_answers: 0,
        score_percentage: 0,
        latest_submitted_at: ans.submittedAt,
      };
    }
    const u = byUser[ans.uniqueUserId];
    u.total_questions += 1;
    if (ans.isCorrect) u.correct_answers += 1;
    else u.wrong_answers += 1;
    if (ans.submittedAt > u.latest_submitted_at) {
      u.latest_submitted_at = ans.submittedAt;
    }
  }

  const results = Object.values(byUser).map((u) => ({
    ...u,
    score_percentage:
      u.total_questions > 0
        ? Math.round((u.correct_answers / u.total_questions) * 100)
        : 0,
  }));

  return {
    total_submissions: results.length,
    results,
  };
};

const getCourseById = async (id: string) => {
  const course = await prisma.courseNameGenerator.findUnique({
    where: { id },
    include: {
      user: {
        select: { userId: true, isActive: true },
      },
      class: true,
      modules: {
        orderBy: { moduleNumber: 'asc' },
        include: {
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  return course;
};

const updateCourse = async (id: string, payload: any) => {
  const isExist = await prisma.courseNameGenerator.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(404, 'Course not found');
  }

  // Sanitize payload to only allowed fields
  const updateData: any = {};
  const allowedFields = [
    'courseName',
    'subject',
    'description',
    'isPublished',
    'startDate',
    'startTime',
    'endTime',
    'targetGradeLevel',
    'courseLength',
    'semesterCount',
    'teacherId',
    'masteryRequirement',
    'totalModules',
  ];

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      updateData[field] = payload[field];
    }
  });

  return await prisma.courseNameGenerator.update({
    where: { id },
    data: updateData,
  });
};

const updateLesson = async (id: string, payload: any) => {
  const isExist = await prisma.courseLectureGenerator.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(404, 'Lesson/Module not found');
  }

  return await prisma.courseLectureGenerator.update({
    where: { id },
    data: {
      moduleTitle: payload.moduleTitle,
      introduction: payload.introduction,
      studyTopics: payload.studyTopics,
      voiceData: payload.voiceData,
    },
  });
};

const updateQuiz = async (id: string, payload: any) => {
  const isExist = await prisma.quizQuestion.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(404, 'Quiz question not found');
  }

  return await prisma.quizQuestion.update({
    where: { id },
    data: {
      questionText: payload.questionText,
      optionA: payload.optionA,
      optionB: payload.optionB,
      optionC: payload.optionC,
      optionD: payload.optionD,
      correctAnswer: payload.correctAnswer,
    },
  });
};

const deleteQuiz = async (id: string) => {
  const isExist = await prisma.quizQuestion.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(404, 'Quiz question not found');
  }

  return await prisma.quizQuestion.delete({
    where: { id },
  });
};

const deleteCourse = async (id: string) => {
  const isExist = await prisma.courseNameGenerator.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(404, 'Course not found');
  }

  return await prisma.courseNameGenerator.delete({
    where: { id },
  });
};

const getStudentPublishedCourses = async (studentId: string) => {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });
  const aiUserId = (profile as any)?.aiUserId;

  const courses = await prisma.courseNameGenerator.findMany({
    where: {
      isPublished: true,
      enrollments: {
        some: {
          studentId,
        },
      },
    },
    include: {
      modules: {
        orderBy: { moduleNumber: 'asc' },
        include: {
          lessonProgresses: {
            where: { studentId },
          },
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
      class: true,
    },
  });

  const result = await Promise.all(
    courses.map(async (course) => {
      const totalModules = course.totalModules;
      const completedModules = course.modules.filter(
        (m) =>
          m.lessonProgresses.length > 0 && m.lessonProgresses[0].isCompleted,
      ).length;

      const progressPercentage =
        totalModules > 0
          ? Math.round((completedModules / totalModules) * 100)
          : 0;

      let overallMastery = 0;
      let modulesWithQuizzesCount = 0;
      let totalMasteryScore = 0;

      const mappedModules = await Promise.all(
        course.modules.map(async (mod) => {
          const isCompleted =
            mod.lessonProgresses.length > 0 &&
            mod.lessonProgresses[0].isCompleted;

          let quizScore = null;
          if (aiUserId) {
            const questionIds = mod.quizQuestions.map((q) => q.questionId);
            if (questionIds.length > 0) {
              const answers = await prisma.quizAnswer.findMany({
                where: {
                  uniqueUserId: aiUserId,
                  uniqueSessionId: course.uniqueSessionId,
                  questionId: { in: questionIds },
                },
              });

              if (answers.length > 0) {
                const correct = answers.filter((a) => a.isCorrect).length;
                quizScore = Math.round((correct / answers.length) * 100);
                totalMasteryScore += quizScore;
                modulesWithQuizzesCount++;
              }
            }
          }

          return {
            ...mod,
            isCompleted,
            quizScore,
          };
        }),
      );

      if (modulesWithQuizzesCount > 0) {
        overallMastery = Math.round(
          totalMasteryScore / modulesWithQuizzesCount,
        );
      }

      return {
        ...course,
        modules: mappedModules,
        overallProgress: progressPercentage,
        overallMastery,
      };
    }),
  );

  return result;
};



const getTeacherPublishedCourses = async (teacherId: string) => {
  return await prisma.courseNameGenerator.findMany({
    where: {
      isPublished: true,
      teacherId,
    },
    include: {
      modules: {
        orderBy: { moduleNumber: 'asc' },
        include: {
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
      class: true,
    },
  });
};

const removeTeacherFromCourse = async (courseId: string) => {
  const isExist = await prisma.courseNameGenerator.findUnique({
    where: { id: courseId },
  });

  if (!isExist) {
    throw new ApiError(404, 'Course not found');
  }

  return await prisma.courseNameGenerator.update({
    where: { id: courseId },
    data: {
      teacherId: null,
    },
  });
};

const getStudentProgressSummary = async (
  studentId: string,
  uniqueUserId?: string,
) => {
  // If uniqueUserId (aiUserId) is not provided, try to find it from StudentProfile
  if (!uniqueUserId) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
    });
    uniqueUserId = (profile as any)?.aiUserId || undefined;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      aiCourse: {
        include: {
          modules: {
            orderBy: { moduleNumber: 'asc' },
            include: {
              lessonProgresses: {
                where: { studentId },
              },
              quizQuestions: true,
            },
          },
        },
      },
    },
  });

  const summary = await Promise.all(
    enrollments.map(async (enrollment) => {
      const course = enrollment.aiCourse;
      if (!course) return null;

      const totalModules = course.totalModules;
      const completedModules = course.modules.filter(
        (m) =>
          m.lessonProgresses.length > 0 && m.lessonProgresses[0].isCompleted,
      ).length;

      const progressPercentage =
        totalModules > 0
          ? Math.round((completedModules / totalModules) * 100)
          : 0;

      let overallMastery = 0;
      let modulesWithQuizzes = 0;
      let totalScore = 0;

      const lessons = await Promise.all(
        course.modules.map(async (mod) => {
          const isCompleted =
            mod.lessonProgresses.length > 0 &&
            mod.lessonProgresses[0].isCompleted;

          let quizScore = null;
          if (uniqueUserId) {
            const questionIds = mod.quizQuestions.map((q) => q.questionId);
            const answers = await prisma.quizAnswer.findMany({
              where: {
                uniqueUserId,
                uniqueSessionId: course.uniqueSessionId,
                questionId: { in: questionIds },
              },
            });

            if (answers.length > 0) {
              const correct = answers.filter((a) => a.isCorrect).length;
              quizScore = Math.round((correct / answers.length) * 100);
              totalScore += quizScore;
              modulesWithQuizzes++;
            }
          }

          return {
            lessonId: mod.id,
            lessonTitle: mod.moduleTitle,
            lessonNumber: mod.moduleNumber,
            isCompleted,
            quizScore,
          };
        }),
      );

      if (modulesWithQuizzes > 0) {
        overallMastery = Math.round(totalScore / modulesWithQuizzes);
      }

      return {
        courseId: course.id,
        courseName: course.courseName || course.generatedCourseName,
        overallProgress: progressPercentage,
        overallMastery,
        lessons,
      };
    }),
  );

  return summary.filter((s) => s !== null);
};

const getStudentCourseDetails = async (studentId: string, courseId: string) => {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });
  const aiUserId = (profile as any)?.aiUserId;

  const course = await prisma.courseNameGenerator.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { moduleNumber: 'asc' },
        include: {
          lessonProgresses: {
            where: { studentId },
          },
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
      class: true,
    },
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const totalModulesCount = course.totalModules;
  const completedModulesCount = course.modules.filter(
    (m) => m.lessonProgresses.length > 0 && m.lessonProgresses[0].isCompleted,
  ).length;

  const progressPercentage =
    totalModulesCount > 0
      ? Math.round((completedModulesCount / totalModulesCount) * 100)
      : 0;

  let totalMasteryScore = 0;
  let modulesWithQuizzesCount = 0;
  let totalLessonsCount = 0;
  let completedLessonsCount = 0;
  let totalAssessmentsCount = 0;
  let completedAssessmentsCount = 0;

  const mappedModules = await Promise.all(
    course.modules.map(async (mod) => {
      const isCompleted =
        mod.lessonProgresses.length > 0 && mod.lessonProgresses[0].isCompleted;

      // Lessons count from studyTopics
      const lessons = (mod.studyTopics as any[]) || [];
      totalLessonsCount += lessons.length;
      if (isCompleted) {
        completedLessonsCount += lessons.length;
      }

      // Assessments (Quizzes) - Treat each module's quiz set as one assessment
      const hasQuiz = mod.quizQuestions.length > 0;
      if (hasQuiz) {
        totalAssessmentsCount++;
      }

      let quizScore = null;
      if (aiUserId && hasQuiz) {
        const questionIds = mod.quizQuestions.map((q) => q.questionId);
        const answers = await prisma.quizAnswer.findMany({
          where: {
            uniqueUserId: aiUserId,
            uniqueSessionId: course.uniqueSessionId,
            questionId: { in: questionIds },
          },
        });

        if (answers.length > 0) {
          const correct = answers.filter((a) => a.isCorrect).length;
          quizScore = Math.round((correct / answers.length) * 100);
          totalMasteryScore += quizScore;
          modulesWithQuizzesCount++;
          completedAssessmentsCount++;
        }
      }

      return {
        ...mod,
        isCompleted,
        quizScore,
      };
    }),
  );

  const overallMastery =
    modulesWithQuizzesCount > 0
      ? Math.round(totalMasteryScore / modulesWithQuizzesCount)
      : 0;

  // Find next module/lesson
  const nextModule = mappedModules.find((m) => !m.isCompleted);

  return {
    ...course,
    modules: mappedModules,
    overallProgress: progressPercentage,
    overallMastery,
    stats: {
      masteryRequirement: course.masteryRequirement,
      averageMastery: overallMastery,
      modulesTotal: totalModulesCount,
      modulesCompleted: completedModulesCount,
      lessonsTotal: totalLessonsCount,
      lessonsCompleted: completedLessonsCount,
      assessmentsTotal: totalAssessmentsCount,
      assessmentsCompleted: completedAssessmentsCount,
      courseLength: course.courseLength,
    },
    nextModule: nextModule
      ? {
          id: nextModule.id,
          title: nextModule.moduleTitle,
          moduleNumber: nextModule.moduleNumber,
        }
      : null,
  };
};

const getTeacherCourseDetails = async (teacherId: string, courseId: string) => {
  const course = await prisma.courseNameGenerator.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { moduleNumber: 'asc' },
        include: {
          quizQuestions: {
            orderBy: { questionNumber: 'asc' },
          },
        },
      },
      class: true,
      enrollments: {
        select: {
          studentId: true,
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  // Ensure this course belongs to the teacher
  if (course.teacherId !== teacherId) {
    throw new ApiError(403, 'You do not have permission to view this course');
  }

  const enrolledStudentIds = course.enrollments.map((e) => e.studentId);
  const totalStudents = enrolledStudentIds.length;

  // Calculate global average progress and mastery for this course
  let totalProgress = 0;
  let totalMastery = 0;
  let studentsWithMastery = 0;

  if (totalStudents > 0) {
    // Progress is based on LessonProgress count vs total modules
    const totalModules = course.totalModules;
    
    for (const studentId of enrolledStudentIds) {
      const completedModules = await prisma.lessonProgress.count({
        where: {
          studentId,
          lessonId: { in: course.modules.map((m) => m.id) },
          isCompleted: true,
        },
      });
      
      const studentProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
      totalProgress += studentProgress;

      // Mastery is based on QuizAnswer scores
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { aiUserId: true }
      });
      const aiUserId = (profile as any)?.aiUserId;

      if (aiUserId) {
        let studentTotalScore = 0;
        let modWithQuizCount = 0;

        for (const mod of course.modules) {
          const questionIds = mod.quizQuestions.map(q => q.questionId);
          if (questionIds.length > 0) {
            const answers = await prisma.quizAnswer.findMany({
              where: {
                uniqueUserId: aiUserId,
                uniqueSessionId: course.uniqueSessionId,
                questionId: { in: questionIds }
              }
            });

            if (answers.length > 0) {
              const correct = answers.filter(a => a.isCorrect).length;
              studentTotalScore += (correct / answers.length) * 100;
              modWithQuizCount++;
            }
          }
        }

        if (modWithQuizCount > 0) {
          totalMastery += (studentTotalScore / modWithQuizCount);
          studentsWithMastery++;
        }
      }
    }
  }

  const averageProgress = totalStudents > 0 ? Math.round(totalProgress / totalStudents) : 0;
  const averageMastery = studentsWithMastery > 0 ? Math.round(totalMastery / studentsWithMastery) : 0;

  // Course structure stats
  let totalLessonsCount = 0;
  let totalAssessmentsCount = 0;

  course.modules.forEach((mod) => {
    totalLessonsCount += ((mod.studyTopics as any[]) || []).length;
    if (mod.quizQuestions.length > 0) {
      totalAssessmentsCount++;
    }
  });

  return {
    ...course,
    overallProgress: averageProgress,
    overallMastery: averageMastery,
    stats: {
      masteryRequirement: course.masteryRequirement,
      averageMastery: averageMastery,
      totalStudents: totalStudents,
      modulesTotal: course.totalModules,
      lessonsTotal: totalLessonsCount,
      assessmentsTotal: totalAssessmentsCount,
      courseLength: course.courseLength,
    },
  };
};

export const CourseSetupService = {
  courseSetup,
  generateQuiz,
  submitQuizAnswer,
  getQuizResults,
  getAllCourses,
  getCourseBySession,
  getCourseById,
  updateCourse,
  updateLesson,
  updateQuiz,
  deleteQuiz,
  submitModuleQuiz,
  getModuleQuizResult,
  getModuleQuizResultPublic,
  deleteCourse,
  getStudentPublishedCourses,
  getTeacherPublishedCourses,
  removeTeacherFromCourse,
  getStudentProgressSummary,
  completeLesson,
  getStudentCourseDetails,
  getTeacherCourseDetails,
};




