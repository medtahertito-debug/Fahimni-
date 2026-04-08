
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface Country {
  id: string;
  names: {
    ar: string;
    fr: string;
    en: string;
  };
  flag: string;
  ministryUrl: string;
}

export interface Grade {
  id: string;
  name: string;
}

export interface Stream {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
}

export interface AssessmentType {
  id: string;
  name: string;
}

export interface AssessmentNumber {
  id: string;
  name: string;
}

export interface Lesson {
  title: string;
  pdfUrl: string;
}

export interface Exam {
  id: string;
  title: string;
  year: string;
  pdfUrl: string;
}

export enum AppStep {
  LANGUAGE_SELECTION,
  COUNTRY_SELECTION,
  GRADE_SELECTION,
  STREAM_SELECTION,
  SUBJECT_SELECTION,
  ACTION_CHOICE,
  LESSON_LIST,
  LESSON_EXPLANATION_INPUT,
  LESSON_EXPLANATION_RESULT,
  ASSESSMENT_TYPE_SELECTION,
  ASSESSMENT_NUMBER_SELECTION,
  EXAM_LIST,
  PDF_VIEW,
  ASSESSMENT_LESSON_INPUT,
  ASSESSMENT_GENERATION_RESULT,
  ASSESSMENT_CORRECTION_RESULT
}

export interface AppState {
  language: 'ar' | 'fr' | 'en';
  country?: Country;
  grade?: Grade;
  stream?: Stream;
  subject?: Subject;
  selectedLesson?: Lesson;
  explanationQuery?: string;
  explanationResult?: string;
  mode?: 'lessons' | 'exams';
  assessmentType?: AssessmentType;
  assessmentNumber?: AssessmentNumber;
  currentPdfUrl?: string;
  lessonInputText?: string;
  verifiedLessons?: string[];
  validationError?: string;
  generatedAssessment?: string;
  generatedCorrection?: string;
  currentStep: AppStep;
}
