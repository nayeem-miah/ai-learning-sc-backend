export interface TCourseSetupPayload {
  course_name: string;
  subject: string;
  target_grade_level: string;
  course_length: string;
  semester_count: number;
  diagnostic_test_before_course: boolean;
  retesting_allowed: boolean;
  retesting_count: number;
  quizzes_per_module: number;
  midterm_examination: boolean;
  final_examination: boolean;
  total_quiz_questions: number;
  mastery_requirement: number;
  total_modules: number;
  estimated_duration_min_per_class: number;
}

export interface TCourseFromAi {
  unique_user_id: string;
  course_name: string;
  subject: string;
  target_grade_level: string;
  course_length: string;
  semester_count: number;
  diagnostic_test_before_course: boolean;
  retesting_allowed: boolean;
  retesting_count: number;
  quizzes_per_module: number;
  midterm_examination: boolean;
  final_examination: boolean;
  total_quiz_questions: number;
  mastery_requirement: number;
  total_modules: number;
  estimated_duration_min_per_class: number;
}
