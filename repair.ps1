$path = "src\app\modules\course-setup\courseSetup.service.ts"
$content = Get-Content $path
$newContent = @()
$skip = false

for ($i = 0; $i -lt $content.Length; $i++) {
    $line = $content[$i]
    
    # We want to find the end of submitModuleQuiz (the upsert block)
    if ($line -like "*lessonId: body.module_id,*") {
         # We are near the end. Let's find the closing of upsert });
         # and the return.
    }
    
    $newContent += $line
}

# Actually, I'll just do a simpler search and replace in the string
$fullText = [IO.File]::ReadAllText($path)

# Pattern to find our mess. 
# It currently has something like:
#     },
#   });
#
#   if (!module) {

$pattern = '    },\r?\n  }\);\r?\n\r?\n\r?\n  if \(!module\) \{'
# (Wait, I don't know the exact count of newlines)

# Better: I'll use a unique enough block from before the mess.
$search = '    data: {
      isCompleted: true,
      completedAt: new Date(),
    },
  });'

$replacement = '    data: {
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
  return await prisma.$transaction(async (tx) => {
    // 1. Mark lesson as completed
    const progress = await tx.lessonProgress.upsert({
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

    // 2. Find the course context to update Enrollment.progressPercentage
    const module = await tx.courseLectureGenerator.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            id: true,
            totalModules: true,
          },
        },
      },
    });

    if (module?.course) {
      const course = module.course;
      const totalModules = course.totalModules;

      // Count completed modules for this student in this course
      const completedModules = await tx.lessonProgress.count({
        where: {
          studentId,
          isCompleted: true,
          aiLesson: {
            uniqueSessionId: module.uniqueSessionId,
          },
        },
      });

      const progressPercentage =
        totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

      // Update the Enrollment record
      await tx.enrollment.updateMany({
        where: {
          studentId,
          aiCourseId: course.id,
        },
        data: {
          progressPercentage,
        },
      });
    }

    return progress;
  });
};

const getModuleQuizResult = async (query: {
  unique_user_id: string;
  unique_session_id: string;
  module_id: string;
}) => {
  // Find the module
  const moduleRes = await prisma.courseLectureGenerator.findFirst({'

# Wait, I'll use a different name for module in the last line to avoid conflict if I re-run
# No, module is what it was.

# Now the part to remove (the broken start of getModuleQuizResult)
# Since I replaced it in Replacement, I need to know what follows in the file.
# The file had:
#   if (!module) {
#     throw new ApiError(
#       404,
#       `Module not found for session: ${query.unique_session_id}`,
#     );
#   }
#
#   const moduleQuestionIds = module.quizQuestions.map((q) => q.questionId);

# I'll just use Regex to find the broken part.
