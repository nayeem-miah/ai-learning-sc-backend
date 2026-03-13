/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CourseSetupService } from './courseSetup.service';

// Create a new course
const courseSetup = catchAsync(async (req: Request, res: Response) => {
  const {
    course_name,
    subject,
    target_grade_level,
    course_length,
    semester_count,
    diagnostic_test_before_course,
    retesting_allowed,
    retesting_count,
    quizzes_per_module,
    midterm_examination,
    final_examination,
    total_quiz_questions,
    mastery_requirement,
    total_modules,
    estimated_duration_min_per_class,
  } = req.body;

  // Validate required fields
  const requiredFields = [
    'course_name',
    'subject',
    'target_grade_level',
    'course_length',
    'semester_count',
    'total_modules',
    'total_quiz_questions',
    'mastery_requirement',
    'estimated_duration_min_per_class',
  ];

  const missing = requiredFields.filter(
    (f) =>
      req.body[f] === undefined || req.body[f] === null || req.body[f] === '',
  );
  if (missing.length > 0) {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}`,
    });
    return;
  }

  const result = await CourseSetupService.courseSetup({
    course_name,
    subject,
    target_grade_level,
    course_length,
    semester_count: Number(semester_count),
    diagnostic_test_before_course: Boolean(
      diagnostic_test_before_course ?? false,
    ),
    retesting_allowed: Boolean(retesting_allowed ?? false),
    retesting_count: Number(retesting_count ?? 0),
    quizzes_per_module: Number(quizzes_per_module ?? 0),
    midterm_examination: Boolean(midterm_examination ?? false),
    final_examination: Boolean(final_examination ?? false),
    total_quiz_questions: Number(total_quiz_questions),
    mastery_requirement: Number(mastery_requirement),
    total_modules: Number(total_modules),
    estimated_duration_min_per_class: Number(estimated_duration_min_per_class),
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Course setup completed successfully',
    data: result,
  });
});

// Generate Quiz
const generateQuiz = catchAsync(async (req: Request, res: Response) => {
  const { unique_user_id, unique_session_id, module_number } = req.body;

  if (!unique_user_id || !unique_session_id || !module_number) {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message:
        'unique_user_id, unique_session_id, and module_number are required',
    });
    return;
  }

  const result = await CourseSetupService.generateQuiz({
    unique_user_id,
    unique_session_id,
    module_number: Number(module_number),
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Quiz questions generated successfully',
    data: result,
  });
});

const submitQuizAnswer = catchAsync(async (req: Request, res: Response) => {
  const { unique_user_id, unique_session_id, question_id, selected_answer } =
    req.body;

  if (
    !unique_user_id ||
    !unique_session_id ||
    !question_id ||
    !selected_answer
  ) {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message:
        'All fields are required: unique_user_id, unique_session_id, question_id, selected_answer',
    });
    return;
  }

  const result = await CourseSetupService.submitQuizAnswer({
    unique_user_id,
    unique_session_id,
    question_id,
    selected_answer,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Answer submitted successfully',
    data: result,
  });
});

const getQuizResults = catchAsync(async (req: Request, res: Response) => {
  const { unique_session_id, unique_user_id } = req.query as {
    unique_session_id?: string;
    unique_user_id?: string;
  };

  if (!unique_session_id || !unique_user_id) {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Query params required: unique_session_id, unique_user_id',
    });
    return;
  }

  const result = await CourseSetupService.getQuizResults({
    unique_session_id,
    unique_user_id,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Quiz results fetched successfully',
    data: result,
  });
});

const getAllCourses = catchAsync(async (req: Request, res: Response) => {
  const result = await CourseSetupService.getAllCourses();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All courses fetched successfully',
    data: result,
  });
});

const getCourseBySession = catchAsync(async (req: Request, res: Response) => {
  const { session_id } = req.params;
  const result = await CourseSetupService.getCourseBySession(session_id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course fetched successfully',
    data: result,
  });
});

// Submit all answers for a single module at once (bulk)
const submitModuleQuiz = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { unique_user_id, unique_session_id, module_id, answers } = req.body;

  if (
    !unique_user_id ||
    !unique_session_id ||
    !module_id ||
    !Array.isArray(answers) ||
    answers.length === 0
  ) {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message:
        'Required: unique_user_id, unique_session_id, module_id, answers (non-empty array of { question_id, selected_answer })',
    });
    return;
  }

  const result = await CourseSetupService.submitModuleQuiz(
    req.user.userId,
    {
      unique_user_id,
      unique_session_id,
      module_id,
      answers,
    }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module quiz submitted successfully',
    data: result,
  });
});

// Get quiz result for a specific user & module (user sees their own result)
const getModuleQuizResult = catchAsync(async (req: Request, res: Response) => {
  const { unique_user_id, unique_session_id, module_id } = req.query as {
    unique_user_id?: string;
    unique_session_id?: string;
    module_id?: string;
  };

  if (!unique_user_id || !unique_session_id || !module_id) {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message:
        'Query params required: unique_user_id, unique_session_id, module_id',
    });
    return;
  }

  const result = await CourseSetupService.getModuleQuizResult({
    unique_user_id,
    unique_session_id,
    module_id,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module quiz result fetched successfully',
    data: result,
  });
});

// Get all users' quiz results for a session/module (public — anyone can see)
const getModuleQuizResultPublic = catchAsync(
  async (req: Request, res: Response) => {
    const { unique_session_id, module_id } = req.query as {
      unique_session_id?: string;
      module_id?: string;
    };

    const result = await CourseSetupService.getModuleQuizResultPublic({
      unique_session_id,
      module_id,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'All module quiz results fetched successfully',
      data: result,
    });
  },
);

const getCourseById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseSetupService.getCourseById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course fetched successfully',
    data: result,
  });
});

const updateCourse = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseSetupService.updateCourse(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course updated successfully',
    data: result,
  });
});

const updateLesson = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseSetupService.updateLesson(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson updated successfully',
    data: result,
  });
});

const updateQuiz = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseSetupService.updateQuiz(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Quiz updated successfully',
    data: result,
  });
});

const deleteQuiz = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseSetupService.deleteQuiz(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Quiz question deleted successfully',
    data: result,
  });
});

const deleteCourse = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CourseSetupService.deleteCourse(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course deleted successfully',
    data: result,
  });
});

const getStudentPublishedCourses = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const studentId = req.user.userId;
    const result =
      await CourseSetupService.getStudentPublishedCourses(studentId);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student published courses fetched successfully',
      data: result,
    });
  },
);

const getTeacherPublishedCourses = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const teacherId = req.user.userId;
    const result =
      await CourseSetupService.getTeacherPublishedCourses(teacherId);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Teacher published courses fetched successfully',
      data: result,
    });
  },
);

const removeTeacherFromCourse = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await CourseSetupService.removeTeacherFromCourse(id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Teacher removed from course successfully',
      data: result,
    });
  },
);

const getStudentProgressSummary = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const { studentId: paramsStudentId } = req.params;
    const studentId = paramsStudentId || req.user.userId;
    const { unique_user_id } = req.query as { unique_user_id?: string };

    const result = await CourseSetupService.getStudentProgressSummary(
      studentId,
      unique_user_id,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student progress summary fetched successfully',
      data: result,
    });
  },
);

const completeLesson = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const { lessonId } = req.body;
    const studentId = req.user.userId;

    if (!lessonId) {
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'lessonId is required',
      });
      return;
    }

    const result = await CourseSetupService.completeLesson(studentId, lessonId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Lesson marked as completed',
      data: result,
    });
  },
);


const getStudentCourseDetails = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const { id } = req.params;
    const studentId = req.user.userId;
    const result = await CourseSetupService.getStudentCourseDetails(
      studentId,
      id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student course details fetched successfully',
      data: result,
    });
  },
);

const getTeacherCourseDetails = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const { id } = req.params;
    const teacherId = req.user.userId;
    const result = await CourseSetupService.getTeacherCourseDetails(
      teacherId,
      id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Teacher course details fetched successfully',
      data: result,
    });
  },
);

export const CourseSetupController = {

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
