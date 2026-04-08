
import React, { useState, useEffect } from 'react';
import { 
  AppStep, 
  AppState, 
  Country, 
  Grade, 
  Stream, 
  Subject, 
  Lesson, 
  Exam,
  AssessmentType,
  AssessmentNumber
} from './types';
import { COUNTRIES, TRANSLATIONS } from './constants';
import Layout from './components/Layout';
import PdfViewer from './components/PdfViewer';
import * as gemini from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentStep: AppStep.LANGUAGE_SELECTION,
    language: 'ar',
    verifiedLessons: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dynamicGrades, setDynamicGrades] = useState<Grade[]>([]);
  const [dynamicStreams, setDynamicStreams] = useState<Stream[]>([]);
  const [dynamicSubjects, setDynamicSubjects] = useState<Subject[]>([]);
  const [dynamicAssessments, setDynamicAssessments] = useState<AssessmentType[]>([]);
  const [dynamicNumbers, setDynamicNumbers] = useState<AssessmentNumber[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    // إعدادات تجربة التطبيق (APK Experience)
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.style.overscrollBehavior = 'none';

    // Preload PDF worker
    const preloadWorker = () => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
      document.head.appendChild(link);
    };
    preloadWorker();

    // Check for API key
    const checkApiKey = async () => {
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (envKey && envKey !== 'undefined') {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(false);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success as per guidance
    }
  };

  const t = TRANSLATIONS[state.language];

  const handleLanguageSelect = (lang: 'ar' | 'fr' | 'en') => {
    setState(prev => ({ ...prev, language: lang, currentStep: AppStep.COUNTRY_SELECTION }));
  };

  const handleCountrySelect = async (country: Country) => {
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, country }));
    try {
      const grades = await gemini.fetchGrades(country, state.language);
      setDynamicGrades(grades);
      setState(prev => ({ ...prev, currentStep: AppStep.GRADE_SELECTION }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (err: any) => {
    const msg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
    const lowerMsg = msg.toLowerCase();
    
    if (lowerMsg.includes('429') || lowerMsg.includes('resource_exhausted')) {
      setError(t.error429);
    } else if (lowerMsg.includes('api key') || lowerMsg.includes('api_key') || lowerMsg.includes('unauthorized') || lowerMsg.includes('401') || lowerMsg.includes('403')) {
      setError(t.errorApiKey);
    } else if (lowerMsg.includes('500') || lowerMsg.includes('rpc failed') || lowerMsg.includes('xhr error') || lowerMsg.includes('fetch') || lowerMsg.includes('failed to fetch')) {
      setError(t.error500);
    } else {
      setError(t.errorUnexpected);
    }
    console.error('App Error:', err);
  };

  const handleGradeSelect = async (grade: Grade) => {
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, grade }));
    try {
      const streams = await gemini.fetchStreams(state.country!, grade, state.language);
      setDynamicStreams(streams);
      setState(prev => ({ ...prev, currentStep: AppStep.STREAM_SELECTION }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamSelect = async (stream: Stream) => {
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, stream }));
    try {
      const subjects = await gemini.fetchSubjects(state.country!, state.grade!, stream, state.language);
      setDynamicSubjects(subjects);
      setState(prev => ({ ...prev, currentStep: AppStep.SUBJECT_SELECTION }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subject: Subject) => {
    setState(prev => ({ ...prev, subject, currentStep: AppStep.ACTION_CHOICE }));
  };

  const handleActionSelect = async (mode: 'lessons' | 'generate' | 'official') => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'lessons') {
        setState(prev => ({ ...prev, mode: 'lessons' }));
        const list = await gemini.fetchLessonList(state.country!, state.grade!, state.stream!, state.subject!);
        setLessons(list);
        setState(prev => ({ ...prev, currentStep: AppStep.LESSON_LIST }));
      } else if (mode === 'generate') {
        setState(prev => ({ ...prev, mode: 'exams' }));
        setState(prev => ({ ...prev, currentStep: AppStep.ASSESSMENT_LESSON_INPUT, lessonInputText: '' }));
      } else {
        setState(prev => ({ ...prev, mode: 'exams' }));
        const types = await gemini.fetchAssessmentTypes(state.country!, state.grade!, state.stream!, state.subject!, state.language);
        setDynamicAssessments(types);
        setState(prev => ({ ...prev, currentStep: AppStep.ASSESSMENT_TYPE_SELECTION }));
      }
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndGenerateAssessment = async (inputText: string) => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, validationError: undefined }));
    try {
      const { verified, invalid } = await gemini.verifyLessonsInCurriculum(
        state.country!,
        state.grade!,
        state.stream!,
        state.subject!,
        inputText
      );

      if (invalid.length > 0) {
        setState(prev => ({ 
          ...prev, 
          validationError: `${t.invalidLessons} \n${invalid.join("، ")}\n\n${t.correctLessonNames}` 
        }));
        return;
      }

      if (verified.length === 0) {
        setState(prev => ({ ...prev, validationError: t.writeCorrectLessons }));
        return;
      }

      const result = await gemini.fetchGeneratedAssessment(
        state.country!,
        state.grade!,
        state.stream!,
        state.subject!,
        verified
      );
      setState(prev => ({ 
        ...prev, 
        verifiedLessons: verified,
        generatedAssessment: result, 
        currentStep: AppStep.ASSESSMENT_GENERATION_RESULT 
      }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowCorrection = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gemini.fetchAssessmentCorrection(
        state.country!,
        state.grade!,
        state.stream!,
        state.subject!,
        state.generatedAssessment!
      );
      setState(prev => ({ ...prev, generatedCorrection: result, currentStep: AppStep.ASSESSMENT_CORRECTION_RESULT }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLessonSelect = (lesson: Lesson) => {
    setState(prev => ({ ...prev, selectedLesson: lesson, currentStep: AppStep.LESSON_EXPLANATION_INPUT }));
  };

  const handleExplanationSubmit = async (query: string) => {
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, explanationQuery: query }));
    try {
      const result = await gemini.fetchLessonExplanation(
        state.country!,
        state.grade!,
        state.stream!,
        state.subject!,
        state.selectedLesson!,
        query,
        state.language
      );
      setState(prev => ({ ...prev, explanationResult: result, currentStep: AppStep.LESSON_EXPLANATION_RESULT }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentTypeSelect = async (type: AssessmentType) => {
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, assessmentType: type }));
    try {
      const numbers = await gemini.fetchAssessmentNumbers(state.country!, state.grade!, state.stream!, state.subject!, type, state.language);
      setDynamicNumbers(numbers);
      setState(prev => ({ ...prev, currentStep: AppStep.ASSESSMENT_NUMBER_SELECTION }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentNumberSelect = async (num: AssessmentNumber) => {
    setLoading(true);
    setError(null);
    setState(prev => ({ ...prev, assessmentNumber: num }));
    try {
      const results = await gemini.fetchExamsByFullCriteria(
        state.country!, 
        state.grade!, 
        state.stream!, 
        state.subject!, 
        state.assessmentType!, 
        num
      );
      setExams(results);
      setState(prev => ({ ...prev, currentStep: AppStep.EXAM_LIST }));
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const openPdf = (url: string) => {
    setState(prev => ({ ...prev, currentPdfUrl: url, currentStep: AppStep.PDF_VIEW }));
  };

  const goBack = () => {
    const prevStepMap: Record<AppStep, AppStep> = {
      [AppStep.LANGUAGE_SELECTION]: AppStep.LANGUAGE_SELECTION,
      [AppStep.COUNTRY_SELECTION]: AppStep.LANGUAGE_SELECTION,
      [AppStep.GRADE_SELECTION]: AppStep.COUNTRY_SELECTION,
      [AppStep.STREAM_SELECTION]: AppStep.GRADE_SELECTION,
      [AppStep.SUBJECT_SELECTION]: AppStep.STREAM_SELECTION,
      [AppStep.ACTION_CHOICE]: AppStep.SUBJECT_SELECTION,
      [AppStep.LESSON_LIST]: AppStep.ACTION_CHOICE,
      [AppStep.LESSON_EXPLANATION_INPUT]: AppStep.LESSON_LIST,
      [AppStep.LESSON_EXPLANATION_RESULT]: AppStep.LESSON_EXPLANATION_INPUT,
      [AppStep.ASSESSMENT_TYPE_SELECTION]: AppStep.ACTION_CHOICE,
      [AppStep.ASSESSMENT_NUMBER_SELECTION]: AppStep.ASSESSMENT_TYPE_SELECTION,
      [AppStep.EXAM_LIST]: AppStep.ASSESSMENT_NUMBER_SELECTION,
      [AppStep.PDF_VIEW]: state.mode === 'lessons' ? AppStep.LESSON_LIST : AppStep.EXAM_LIST,
      [AppStep.ASSESSMENT_LESSON_INPUT]: AppStep.ACTION_CHOICE,
      [AppStep.ASSESSMENT_GENERATION_RESULT]: AppStep.ASSESSMENT_LESSON_INPUT,
      [AppStep.ASSESSMENT_CORRECTION_RESULT]: AppStep.ASSESSMENT_GENERATION_RESULT,
    };
    setState(prev => ({ ...prev, currentStep: prevStepMap[prev.currentStep] }));
  };

  const cleanTitle = (title: string) => {
    return title
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses
      .replace(/^(الدرس|الوحدة|المجال|الفصل|Lesson|Unit|Chapter|Part)\s*(\d+|[IVX]+)?[:.-]?\s*/i, '') // Remove common prefixes
      .replace(/^\d+[\s.-]+/, '') // Remove leading numbers like "1. " or "1-"
      .trim();
  };

  const renderStep = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-bold text-slate-800 animate-pulse text-center">{t.loading}</p>
        </div>
      );
    }

    switch (state.currentStep) {
      case AppStep.LANGUAGE_SELECTION:
        return (
          <div className="flex flex-col items-center justify-center space-y-8 py-10">
            <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-5xl shadow-xl animate-bounce">🎓</div>
            <h2 className="text-3xl font-bold text-slate-800 text-center">{t.chooseLanguage}</h2>
            <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
              <button onClick={() => handleLanguageSelect('ar')} className="p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-blue-500 transition-all font-bold text-xl flex items-center justify-between">
                <span>العربية</span>
                <span className="text-2xl">🇸🇦</span>
              </button>
              <button onClick={() => handleLanguageSelect('fr')} className="p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-blue-500 transition-all font-bold text-xl flex items-center justify-between">
                <span>Français</span>
                <span className="text-2xl">🇫🇷</span>
              </button>
              <button onClick={() => handleLanguageSelect('en')} className="p-5 bg-white rounded-2xl border-2 border-slate-100 hover:border-blue-500 transition-all font-bold text-xl flex items-center justify-between">
                <span>English</span>
                <span className="text-2xl">🇺🇸</span>
              </button>
            </div>
          </div>
        );

      case AppStep.COUNTRY_SELECTION:
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {COUNTRIES.map(c => (
              <button key={c.id} onClick={() => handleCountrySelect(c)} className="glass p-6 rounded-2xl border border-slate-200 hover:border-blue-500 hover:scale-105 transition-all flex flex-col items-center gap-3">
                <span className="text-4xl">{c.flag}</span>
                <span className="font-bold text-slate-700">{c.names[state.language]}</span>
              </button>
            ))}
          </div>
        );

      case AppStep.GRADE_SELECTION:
        return (
          <div className="space-y-4 max-w-lg mx-auto">
            {dynamicGrades.map(g => (
              <button key={g.id} onClick={() => handleGradeSelect(g)} className="w-full text-right p-6 bg-white rounded-2xl border border-slate-200 hover:bg-blue-50 transition-all flex items-center justify-between shadow-sm">
                <span className="text-lg font-bold text-slate-700">{g.name}</span>
                <span className="text-blue-500 font-bold">←</span>
              </button>
            ))}
          </div>
        );

      case AppStep.STREAM_SELECTION:
        return (
          <div className="space-y-4 max-w-lg mx-auto">
            {dynamicStreams.length > 0 ? dynamicStreams.map(s => (
              <button key={s.id} onClick={() => handleStreamSelect(s)} className="w-full text-right p-6 bg-white rounded-2xl border border-slate-200 hover:bg-blue-50 transition-all flex items-center justify-between shadow-sm">
                <span className="text-lg font-bold text-slate-700">{s.name}</span>
                <span className="text-blue-500 font-bold">←</span>
              </button>
            )) : <button onClick={() => handleStreamSelect({id: 'gen', name: t.generalStream})} className="w-full p-4 bg-blue-600 text-white rounded-xl">{t.followGeneralStream}</button>}
          </div>
        );

      case AppStep.SUBJECT_SELECTION:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dynamicSubjects.map(subj => (
              <button key={subj.id} onClick={() => handleSubjectSelect(subj)} className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-blue-500 transition-all flex items-center justify-center text-center">
                <span className="font-bold text-slate-700 text-xl">{subj.name}</span>
              </button>
            ))}
          </div>
        );

      case AppStep.ACTION_CHOICE:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <button onClick={() => handleActionSelect('lessons')} className="p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-blue-500 hover:shadow-2xl transition-all flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl">📖</div>
              <h3 className="text-xl font-bold text-slate-800">{t.lessonsAndBooks}</h3>
              <p className="text-slate-500 text-center text-sm">{t.officialCurriculum}</p>
            </button>
            <button onClick={() => handleActionSelect('generate')} className="p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-emerald-500 hover:shadow-2xl transition-all flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl">✨</div>
              <h3 className="text-xl font-bold text-slate-800">{t.generateAssessment}</h3>
              <p className="text-slate-500 text-center text-sm">{t.generateAssessmentDesc}</p>
            </button>
            <button onClick={() => handleActionSelect('official')} className="p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-orange-500 hover:shadow-2xl transition-all flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl">📝</div>
              <h3 className="text-xl font-bold text-slate-800">{t.officialExams}</h3>
              <p className="text-slate-500 text-center text-sm">{t.officialExamsDesc}</p>
            </button>
          </div>
        );

      case AppStep.ASSESSMENT_LESSON_INPUT:
        return (
          <div className="max-w-2xl mx-auto space-y-6 py-10 animate-in slide-in-from-bottom duration-500">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-slate-800">{t.writeLessons}</h3>
                <p className="text-slate-500">{t.lessonsPlaceholder}</p>
                <p className="text-xs text-blue-500 font-medium">{t.exampleLessons}</p>
              </div>
              
              {state.validationError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 whitespace-pre-wrap">
                  ⚠️ {state.validationError}
                </div>
              )}

              <textarea 
                className={`w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all min-h-[120px] text-lg ${state.language === 'ar' ? 'text-right' : 'text-left'}`}
                placeholder={t.textareaPlaceholder}
                id="assessment-lessons-input"
                defaultValue={state.lessonInputText || ''}
                onChange={(e) => setState(prev => ({ ...prev, lessonInputText: e.target.value, validationError: undefined }))}
              />
              <button 
                onClick={() => {
                  const text = (document.getElementById('assessment-lessons-input') as HTMLTextAreaElement).value;
                  handleVerifyAndGenerateAssessment(text);
                }}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <span>{t.verifyAndGenerate}</span>
              </button>
            </div>
          </div>
        );

      case AppStep.ASSESSMENT_GENERATION_RESULT:
        const isRtl = state.subject?.name.match(/[\u0600-\u06FF]/);
        return (
          <div className="space-y-10 max-w-5xl mx-auto py-8 animate-in fade-in zoom-in duration-500">
            <div className="flex justify-between items-center px-6 print:hidden">
              <button 
                onClick={() => setState(prev => ({ ...prev, currentStep: AppStep.ASSESSMENT_LESSON_INPUT }))}
                className="px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <span>⬅️ {t.back}</span>
              </button>
              <h2 className="text-2xl font-black text-slate-800">{t.generatedAssessment}</h2>
              <button 
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2"
              >
                <span>🖨️ {t.print}</span>
              </button>
            </div>
            <div id="assessment-content" className="bg-white p-16 sm:p-32 rounded-sm shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-300 min-h-[1400px] font-serif print:shadow-none print:border-none print:p-0 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-black print:hidden"></div>
              <div className={`prose prose-slate max-w-none prose-xl leading-relaxed ${isRtl ? 'text-right' : 'text-left'} 
                prose-h1:text-center prose-h1:text-3xl prose-h1:font-black prose-h1:mb-12 prose-h1:uppercase prose-h1:tracking-widest prose-h1:border-double prose-h1:border-b-4 prose-h1:border-black prose-h1:pb-6
                prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-16 prose-h2:mb-8 prose-h2:border-b-2 prose-h2:border-black prose-h2:pb-2 prose-h2:inline-block
                prose-p:mb-10 prose-p:text-black prose-p:whitespace-pre-wrap prose-p:text-justify prose-p:text-xl prose-p:leading-relaxed prose-p:break-words prose-p:[hyphens:none]
                prose-li:mb-8 prose-li:text-black prose-li:text-xl prose-li:leading-relaxed
                prose-hr:my-16 prose-hr:border-black prose-hr:border-t-2
                prose-strong:text-black prose-strong:font-extrabold
                prose-table:border-collapse prose-table:border-4 prose-table:border-black prose-table:w-full prose-table:mb-16
                prose-td:border-2 prose-td:border-black prose-td:p-4 prose-td:text-center prose-td:align-middle prose-td:font-bold
                prose-th:border-2 prose-th:border-black prose-th:p-4 prose-th:text-center prose-th:bg-slate-50
                prose-pre:bg-transparent prose-pre:p-0 prose-pre:text-black prose-pre:font-serif prose-pre:whitespace-pre-wrap
                prose-code:text-black prose-code:font-serif prose-code:before:content-none prose-code:after:content-none
              `} dir={isRtl ? 'rtl' : 'ltr'}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.generatedAssessment || ""}</ReactMarkdown>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 print:hidden px-6">
              <button 
                onClick={handleShowCorrection}
                className="flex-1 py-7 bg-emerald-700 text-white rounded-2xl font-black text-xl flex items-center justify-center gap-4 hover:bg-emerald-800 shadow-2xl active:scale-95 transition-all"
              >
                {t.showCorrection}
              </button>
            </div>
          </div>
        );

      case AppStep.ASSESSMENT_CORRECTION_RESULT:
        const isCorrRtl = state.subject?.name.match(/[\u0600-\u06FF]/);
        return (
          <div className="space-y-10 max-w-5xl mx-auto py-8 animate-in fade-in zoom-in duration-500">
            <div className="flex justify-between items-center px-6 print:hidden">
              <button 
                onClick={() => setState(prev => ({ ...prev, currentStep: AppStep.ASSESSMENT_GENERATION_RESULT }))}
                className="px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <span>⬅️ {t.backToAssessment}</span>
              </button>
              <h2 className="text-2xl font-black text-emerald-800">{t.modelCorrection}</h2>
              <button 
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2"
              >
                <span>🖨️ {t.print}</span>
              </button>
            </div>
            <div id="correction-content" className="bg-white p-16 sm:p-32 rounded-sm shadow-[0_35px_60px_-15px_rgba(16,185,129,0.2)] border border-emerald-200 min-h-[1400px] font-serif print:shadow-none print:border-none print:p-0 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-600 print:hidden"></div>
              <div className={`prose prose-emerald max-w-none prose-xl leading-relaxed ${isCorrRtl ? 'text-right' : 'text-left'}
                prose-h1:text-center prose-h1:text-3xl prose-h1:font-black prose-h1:mb-12 prose-h1:text-emerald-900 prose-h1:uppercase prose-h1:tracking-widest prose-h1:border-double prose-h1:border-b-4 prose-h1:border-emerald-800 prose-h1:pb-6
                prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-16 prose-h2:mb-8 prose-h2:border-b-2 prose-h2:border-emerald-800 prose-h2:pb-2 prose-h2:inline-block
                prose-p:mb-10 prose-p:text-black prose-p:whitespace-pre-wrap prose-p:text-justify prose-p:text-xl prose-p:leading-relaxed prose-p:break-words prose-p:[hyphens:none]
                prose-li:mb-8 prose-li:text-black prose-li:text-xl prose-li:leading-relaxed
                prose-hr:my-16 prose-hr:border-emerald-400 prose-hr:border-t-2
                prose-strong:text-emerald-900 prose-strong:font-extrabold
                prose-pre:bg-transparent prose-pre:p-0 prose-pre:text-black prose-pre:font-serif prose-pre:whitespace-pre-wrap
                prose-code:text-emerald-900 prose-code:font-serif prose-code:before:content-none prose-code:after:content-none
              `} dir={isCorrRtl ? 'rtl' : 'ltr'}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.generatedCorrection || ""}</ReactMarkdown>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 print:hidden px-6">
            </div>
          </div>
        );

      case AppStep.ASSESSMENT_TYPE_SELECTION:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
            {dynamicAssessments.map(type => (
              <button key={type.id} onClick={() => handleAssessmentTypeSelect(type)} className="p-6 bg-white rounded-2xl border-2 border-slate-100 hover:border-orange-500 transition-all text-center text-lg font-bold text-slate-700 shadow-sm">
                {type.name}
              </button>
            ))}
          </div>
        );

      case AppStep.ASSESSMENT_NUMBER_SELECTION:
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
            {dynamicNumbers.map(num => (
              <button key={num.id} onClick={() => handleAssessmentNumberSelect(num)} className="p-6 bg-white rounded-2xl border-2 border-slate-100 hover:border-orange-500 transition-all text-center text-lg font-bold text-slate-700 shadow-sm">
                {num.name}
              </button>
            ))}
          </div>
        );

      case AppStep.EXAM_LIST:
        return (
          <div className="space-y-4">
            {exams.length > 0 && exams.length < 10 && (
              <div className="bg-blue-50 border-r-4 border-blue-500 p-4 mb-4 rounded-lg">
                <p className="text-blue-800 font-bold text-sm">⚠️ {t.availableExams.replace('{count}', exams.length.toString())}</p>
              </div>
            )}
            {exams.length > 0 ? exams.map((exam, idx) => (
              <button key={idx} onClick={() => openPdf(exam.pdfUrl)} className="w-full bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow active:scale-95">
                <div className={state.language === 'ar' ? 'text-right' : 'text-left'}>
                  <h4 className="font-bold text-lg text-slate-800">{cleanTitle(exam.title)}</h4>
                  <span className="text-sm text-slate-500">{state.language === 'ar' ? 'الإصدار الرسمي' : 'Official version'}: {exam.year}</span>
                </div>
                <div className="bg-orange-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg text-sm shrink-0">{t.openPdf}</div>
              </button>
            )) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <p className="text-slate-500 font-bold">{t.noPdf}</p>
              </div>
            )}
          </div>
        );

      case AppStep.LESSON_LIST:
        return (
          <div className="space-y-3">
            {lessons.map((lesson, idx) => (
              <div key={idx} className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 flex items-center gap-4">
                  <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{idx + 1}</span>
                  <span className="font-bold text-slate-700 flex-1 truncate">{cleanTitle(lesson.title)}</span>
                </div>
                <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
                  <button onClick={() => openPdf(lesson.pdfUrl)} className="p-4 text-blue-600 font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                    {t.viewLesson}
                  </button>
                  <button onClick={() => handleLessonSelect(lesson)} className="p-4 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                    {t.askExplanation}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );

      case AppStep.LESSON_EXPLANATION_INPUT:
        return (
          <div className="max-w-2xl mx-auto space-y-6 py-10 animate-in slide-in-from-bottom duration-500">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-slate-800">{t.lessonTitle}{cleanTitle(state.selectedLesson?.title || "")}</h3>
                <p className="text-slate-500">{t.whatToKnow}</p>
              </div>
              <textarea 
                className={`w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 transition-all min-h-[150px] ${state.language === 'ar' ? 'text-right' : 'text-left'}`}
                placeholder={t.queryPlaceholder}
                id="explanation-query"
              />
              <button 
                onClick={() => {
                  const query = (document.getElementById('explanation-query') as HTMLTextAreaElement).value;
                  if (query.trim()) handleExplanationSubmit(query);
                }}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
              >
                {t.startInteractiveExplanation}
              </button>
            </div>
          </div>
        );

      case AppStep.LESSON_EXPLANATION_RESULT:
        return (
          <div className="w-full max-w-3xl mx-auto space-y-6 py-4 sm:py-6 px-2 sm:px-0 animate-in fade-in duration-700">
            <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6 overflow-hidden">
              <div className="flex justify-center items-center border-b pb-4">
                <h3 className="text-xl font-bold text-slate-800">{t.lessonExplanation}{cleanTitle(state.selectedLesson?.title || "")}</h3>
              </div>
              <div className={`prose prose-slate w-full max-w-full ${state.language === 'ar' ? 'text-right' : 'text-left'} prose-lg leading-loose break-words overflow-x-hidden px-2 sm:px-4`} dir={state.language === 'ar' ? 'rtl' : 'ltr'}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.explanationResult || ""}</ReactMarkdown>
              </div>
              <div className="pt-6 border-t flex justify-center">
                <button onClick={() => setState(prev => ({ ...prev, currentStep: AppStep.LESSON_EXPLANATION_INPUT }))} className="text-blue-600 font-bold hover:underline">
                  {t.askAnotherQuestion}
                </button>
              </div>
            </div>
          </div>
        );

      case AppStep.PDF_VIEW:
        const pdfTitle = state.mode === 'lessons' 
          ? state.selectedLesson?.title || '' 
          : `${state.assessmentType?.name} ${state.assessmentNumber?.name}`;
        return (
          <PdfViewer 
            url={state.currentPdfUrl || ''} 
            title={pdfTitle}
            onClose={goBack}
            language={state.language}
          />
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (state.currentStep) {
      case AppStep.LANGUAGE_SELECTION: return "فهمني - اللغة / Language";
      case AppStep.COUNTRY_SELECTION: return t.chooseCountry;
      case AppStep.GRADE_SELECTION: return t.chooseGrade;
      case AppStep.STREAM_SELECTION: return t.chooseStream;
      case AppStep.SUBJECT_SELECTION: return t.chooseSubject;
      case AppStep.ACTION_CHOICE: return state.subject?.name;
      case AppStep.ASSESSMENT_TYPE_SELECTION: return t.assessmentType;
      case AppStep.ASSESSMENT_NUMBER_SELECTION: return t.assessmentNumber;
      case AppStep.EXAM_LIST: return `${t.examsTitle} ${state.assessmentType?.name} ${state.assessmentNumber?.name}`;
      case AppStep.LESSON_LIST: return t.lessonList;
      case AppStep.LESSON_EXPLANATION_INPUT: return t.askExplanation;
      case AppStep.LESSON_EXPLANATION_RESULT: return t.lessonExplanation;
      case AppStep.ASSESSMENT_LESSON_INPUT: return t.writeLessons;
      case AppStep.ASSESSMENT_GENERATION_RESULT: return t.generatedAssessment;
      case AppStep.ASSESSMENT_CORRECTION_RESULT: return t.modelCorrection;
      default: return "";
    }
  };

  return (
    <Layout step={state.currentStep} onBack={state.currentStep === AppStep.PDF_VIEW ? undefined : goBack} title={getStepTitle()}>
      <div className="animate-in fade-in duration-700">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 animate-in fade-in slide-in-from-top duration-500">
            <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl flex items-center gap-4 shadow-sm">
              <div className="bg-red-100 p-3 rounded-2xl">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-800 font-medium">{error}</p>
                {error.includes('fetch') && (
                  <button 
                    onClick={handleOpenKeySelection}
                    className="mt-2 text-sm text-red-600 font-bold hover:underline"
                  >
                    {state.language === 'ar' ? 'هل تواجه مشكلة في الاتصال؟ جرب تغيير مفتاح API' : 'Connection issue? Try changing API key'}
                  </button>
                )}
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {renderStep()}
      </div>
    </Layout>
  );
};

export default App;
