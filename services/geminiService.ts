
import { GoogleGenAI, Type } from "@google/genai";
import { Country, Grade, Stream, Subject, Lesson, Exam, AssessmentType, AssessmentNumber } from "../types";

const getAI = () => {
  let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  // Handle cases where the key might be the string "undefined" or "null"
  if (apiKey === 'undefined' || apiKey === 'null') {
    apiKey = '';
  }

  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing or empty. Please ensure it is set in your environment variables or select a key via the settings.");
  } else {
    // Only log the first few characters for security
    console.log("GEMINI_API_KEY found, prefix:", apiKey.substring(0, 4) + "...");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 4, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorMessage = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    const isTransient = isRateLimit || 
                        errorMessage.includes('500') || 
                        errorMessage.includes('Rpc failed') || 
                        errorMessage.includes('xhr error') ||
                        errorMessage.includes('fetch') ||
                        errorMessage.includes('Failed to fetch') ||
                        errorMessage.includes('UNKNOWN');
    
    if (isTransient && retries > 0) {
      // For rate limits or server errors, use a longer delay
      const nextDelay = (isRateLimit || errorMessage.includes('500')) ? delay * 2.5 : delay * 2;
      console.warn(`Transient error detected: "${errorMessage}". Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, nextDelay);
    }
    console.error("Non-transient or final error in withRetry:", errorMessage);
    throw error;
  }
};

export const fetchGrades = async (country: Country, language: string = 'ar'): Promise<Grade[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      MANDATORY GRADE EXTRACTION RULES for ${country.names[language] || country.names.ar}:
      1. Extract official secondary education grades ONLY.
      2. Source: Use ONLY ${country.ministryUrl} and official curriculum documentation.
      3. Verification: Only include grades that are officially recognized by the Ministry of Education.
      4. Naming: The "name" field MUST contain ONLY the official grade name. No extra text.
      5. Language: Display names strictly in ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English'}.
      
      Return as JSON array of {id, name}.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, name: { type: Type.STRING } },
            required: ["id", "name"]
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : [];
  });
};

export const fetchStreams = async (country: Country, grade: Grade, language: string = 'ar'): Promise<Stream[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      MANDATORY STREAM EXTRACTION RULES for ${grade.name} in ${country.names[language] || country.names.ar}:
      1. Extract official study streams (الشعب) ONLY.
      2. Source: Use ONLY ${country.ministryUrl} and official curriculum programs.
      3. Verification: Only include streams that are officially recognized for this grade.
      4. Naming: The "name" field MUST contain ONLY the official stream name. No extra text.
      5. Language: Display names strictly in ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English'}.
      
      Return as JSON array of {id, name}.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, name: { type: Type.STRING } },
            required: ["id", "name"]
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : [];
  });
};

export const fetchSubjects = async (country: Country, grade: Grade, stream: Stream, language: string = 'ar'): Promise<Subject[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      MANDATORY SUBJECT EXTRACTION RULES for ${country.names[language] || country.names.ar}:
      1. Extract official secondary education subjects for ${grade.name} (${stream.name}) ONLY.
      2. Source: Use ONLY ${country.ministryUrl}, official curriculum programs, and approved textbooks.
      3. Verification: Only include subjects that can be verified via official government sources.
      4. Naming: The "name" field MUST contain ONLY the official subject name (e.g., "الرياضيات"). 
         - STRICTLY PROHIBITED: No emojis, no icons, no codes, no descriptions, no grade levels, no stream names, and no extra text of any kind inside the "name" string.
      5. Language: Display names strictly in ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English'}. 
         - Use a reliable educational translation dictionary for the chosen language.
      6. Prohibitions: 
         - DO NOT create subjects that do not officially exist.
         - DO NOT merge subjects from different streams.
         - DO NOT generalize subjects from other countries.
         - DO NOT include the subject's language of instruction as an option.
      7. Linking: Ensure each subject is strictly linked to this specific country, grade, and stream.
      
      GOLDEN RULE: The Subject = What the Ministry decides, not what the system expects.
      
      Return the list as JSON with fields: id, name, icon. (Keep the icon field separate).
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, icon: { type: Type.STRING } },
            required: ["id", "name", "icon"]
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : [];
  });
};

export const fetchAssessmentTypes = async (country: Country, grade: Grade, stream: Stream, subject: Subject, language: string = 'ar'): Promise<AssessmentType[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      MANDATORY ASSESSMENT TYPE EXTRACTION RULES for ${country.names[language] || country.names.ar}:
      1. Source: Use ONLY ${country.ministryUrl}, official curriculum documentation, and approved national pedagogical guides.
      2. Task: Return ONLY the official assessment types (تصنيفات الفروض/الامتحانات) used for ${subject.name} in ${grade.name} (${stream.name}).
      3. Verification: The types MUST match the official nomenclature of the Ministry of Education.
      4. Language: Display names strictly in ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English'}.
      5. Constraint: For Tunisia (تونس), return ONLY "فرض مراقبة" and "فرض تأليفي" (or their translations).
      
      Return as JSON array of {id, name}.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, name: { type: Type.STRING } },
            required: ["id", "name"]
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : [];
  });
};

export const fetchAssessmentNumbers = async (country: Country, grade: Grade, stream: Stream, subject: Subject, type: AssessmentType, language: string = 'ar'): Promise<AssessmentNumber[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      MANDATORY ASSESSMENT NUMBER EXTRACTION RULES for ${country.names[language] || country.names.ar}:
      1. Context: Subject: ${subject.name}, Grade: ${grade.name}, Type: ${type.name}.
      2. Task: List the official sequence and CORRECT COUNT of assessments as defined by the Ministry of Education (${country.ministryUrl}).
      3. Naming: Use the EXACT official naming format (e.g., "عدد 1", "عدد 2", "N°1", "N°2").
      4. Verification: The number of assessments MUST strictly match the official school system for this specific grade and subject.
      5. Language: Display names strictly in ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English'}.
      
      Return as JSON array of {id, name}.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3-1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, name: { type: Type.STRING } },
            required: ["id", "name"]
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : [];
  });
};

export const fetchLessonList = async (country: Country, grade: Grade, stream: Stream, subject: Subject): Promise<Lesson[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `List the EXACT official lesson titles for the ${subject.name} curriculum in ${country.names.ar} for ${grade.name} (${stream.name}).
    
    CRITICAL INSTRUCTIONS:
    1. Use the OFFICIAL names as they appear in the Ministry of Education documents.
    2. Language: Use the language in which this subject is taught in ${country.names.ar}. For example, if the subject is "Français", use French. If it's "اللغة العربية", use Arabic. If it's a science subject in a French-speaking stream, use French.
    3. Formatting: Remove ALL prefixes like "Lesson:", "Unit:", "Chapter:", or numbers like "1.", "2-".
    4. Parentheses: Remove ALL text inside parentheses and the parentheses themselves.
    5. Search: Use Google Search to verify the current official curriculum for the year 2025/2026.
    6. PDF: Find a DIRECT PDF link to the official textbook or a high-quality pedagogical resource for each lesson.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, pdfUrl: { type: Type.STRING } },
            required: ["title", "pdfUrl"]
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : [];
  });
};

export const fetchExamsByFullCriteria = async (
  country: Country, 
  grade: Grade, 
  stream: Stream, 
  subject: Subject, 
  type: AssessmentType, 
  number: AssessmentNumber
): Promise<Exam[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `SEARCH REQUIREMENT: Find exactly 10 (if available) DIRECT PDF links for real past exams from ${country.names.ar}: ${grade.name} (${stream.name}), ${subject.name}, ${type.name} ${number.name}. 
    Rules: 
    1. Language: Use the language of the subject (e.g., French for French exams, Arabic for Arabic exams).
    2. Direct PDF only. 
    3. No commercial site names in titles. 
    4. Sort by most recent years.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { 
              id: { type: Type.STRING }, 
              title: { type: Type.STRING }, 
              year: { type: Type.STRING }, 
              pdfUrl: { type: Type.STRING } 
            },
            required: ["id", "title", "year", "pdfUrl"]
          }
        }
      }
    });
    const results: Exam[] = response.text ? JSON.parse(response.text.trim()) : [];
    return results.slice(0, 10);
  });
};

export const fetchLessonExplanation = async (
  country: Country,
  grade: Grade,
  stream: Stream,
  subject: Subject,
  lesson: Lesson,
  query: string,
  language: string
): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      INTERACTIVE LESSON EXPLANATION & AUDITING SYSTEM RULES:
      1. Context: Country: ${country.names[language] || country.names.ar}, Grade: ${grade.name}, Stream: ${stream.name}, Subject: ${subject.name}, Lesson: ${lesson.title}.
      2. User Question: "${query}"
      
      MANDATORY EDUCATIONAL AUDITING RULES:
      - STEP 1: INTERNAL DICTIONARY GENERATION: Before generating the explanation, identify the official educational terms, definitions, and laws for this specific Country/Grade/Stream/Subject based ONLY on official Ministry of Education programs and textbooks.
      - STEP 2: CONTENT GENERATION: Generate the explanation using ONLY the terms identified in Step 1.
      - STEP 3: LINGUISTIC & PEDAGOGICAL AUDIT: Review the generated text. Every single word and term MUST exist in the official curriculum. 
      - REPLACEMENT RULE: If any term is found that is NOT in the official program (e.g., university-level terms, advanced concepts, or non-official synonyms), it MUST be replaced with the official term from the textbook.
      - OUTPUT RESTRICTION: DO NOT include any "Audit Report", "Quick Review", or "Auditing" section in the final output. The user must ONLY see the final audited explanation. Any internal auditing steps must remain hidden.
      
      STRICT PROHIBITIONS:
      - NO university-level terminology.
      - NO concepts or information not explicitly required in the official curriculum.
      - NO advanced scientific terms outside the student's current level.
      
      MANDATORY CODE FORMATTING & ORGANIZATION RULES (STRICT):
      - VISUAL CLARITY: The code/algorithm must be clean, clear, and highly readable.
      - ONE INSTRUCTION PER LINE: Every single step, instruction, or statement MUST be on its own independent line.
      - INDENTATION (MANDATORY): Use consistent indentation (spaces) to organize:
        * Loops (for, while, etc.)
        * Conditions (if, else, switch, etc.)
        * Functions and procedures.
        * Any nested structures.
      - LOGICAL ORDERING: The code must be ordered strictly from top to bottom in a logical, step-by-step sequence.
      - NO MERGING: NEVER combine multiple instructions or statements on a single line.
      - NO OVERLAP: Ensure instructions do not overlap or interweave in an unclear manner.
      - FORMATTING: Display code ONLY inside separate code blocks. Explanatory text MUST be outside.
      - MODERN SYNTAX: NEVER use the keywords "var" or "let". Use "const" instead (or language-appropriate modern keywords that are not "var" or "let").

      3. Sources: Use ONLY official educational sources for ${country.names.ar} (Ministry of Education ${country.ministryUrl}, official textbooks, pedagogical documents).
      4. Content Requirements:
         - All definitions, laws, and terms MUST match official textbook wording.
         - Provide correct scientific/academic interpretation within the official scope.
         - Use simplified examples suitable for high school students.
         - If scientific/mathematical, provide clear steps of understanding.
      5. Language: 
         - The explanation MUST be written in the user's selected language: ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English'}.
         - HOWEVER, all scientific terms, keywords, and lesson-specific concepts MUST remain in the original language of the subject (${subject.name}).
         - Do not translate the core terminology, but explain it clearly in the chosen language.
         - Ensure the explanation is accessible and pedagogically sound.
      6. Prohibitions:
         - DO NOT hallucinate or invent information.
         - DO NOT use unscientific or unreliable sources.
         - DO NOT provide generic answers; link it directly to the official curriculum of ${country.names.ar}.
      
      GOLDEN RULE: Every word in the explanation = A word present in the official curriculum.
      
      Output format: Markdown.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "No explanation available.";
  });
};

export const verifyLessonsInCurriculum = async (
  country: Country,
  grade: Grade,
  stream: Stream,
  subject: Subject,
  lessonNames: string
): Promise<{ verified: string[], invalid: string[] }> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      CURRICULUM VERIFICATION SYSTEM:
      Context: Country: ${country.names.ar}, Grade: ${grade.name}, Stream: ${stream.name}, Subject: ${subject.name}.
      User Input Lessons: ${lessonNames}
      
      TASK:
      1. Analyze the user's input (comma-separated lesson names).
      2. Compare each name against the OFFICIAL Ministry of Education curriculum for this specific context.
      3. Return a JSON object with two arrays:
         - "verified": The official names of the lessons that exist in the curriculum.
         - "invalid": The names that do NOT exist or are not part of this subject/grade/stream.
      
      RULES:
      - Be strict. If a lesson is from a different grade or subject, mark it as invalid.
      - If a name is slightly misspelled but clearly refers to a specific official lesson, return the official name in "verified".
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verified: { type: Type.ARRAY, items: { type: Type.STRING } },
            invalid: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["verified", "invalid"]
        }
      }
    });
    return response.text ? JSON.parse(response.text.trim()) : { verified: [], invalid: [] };
  });
};

export const fetchGeneratedAssessment = async (
  country: Country,
  grade: Grade,
  stream: Stream,
  subject: Subject,
  lessons: string[]
): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const lessonTitles = lessons.join(", ");
    const prompt = `
      MANDATORY ASSESSMENT GENERATION SYSTEM (OFFICIAL EXAM FORMAT):
      1. Context: Country: ${country.names.ar}, Grade: ${grade.name}, Stream: ${stream.name}, Subject: ${subject.name}.
      2. Targeted Lessons: ${lessonTitles}.
      
      PEDAGOGICAL RIGOR & DIFFICULTY RULES (STRICT):
      - DIFFICULTY LEVEL: The assessment MUST be slightly more challenging than a standard classroom exercise.
      - COGNITIVE LEVEL: Focus on thinking, analysis, and synthesis rather than simple memorization. Mimic the complexity of national exams (e.g., Baccalaureate).
      - PROGRESSIVE DIFFICULTY: The assessment MUST be organized with a clear gradient of difficulty:
        * Start with easy/foundational questions.
        * Move to medium-difficulty application questions.
        * End with complex, composite, or analytical questions that require deep understanding.
      - CURRICULUM ADHERENCE: Despite the increased difficulty, you MUST stay strictly within the official ${country.names.ar} curriculum for ${grade.name}.
      - PROHIBITIONS: NEVER include concepts, formulas, or methods not explicitly taught in the selected lessons. Do not use university-level content.
      
      VISUAL STRUCTURE & FORMATTING RULES:
      - LANGUAGE: The ENTIRE document MUST be in the subject's language (${subject.name}).
      - HEADER SECTION:
        - Top Center: Republic Name & Ministry of Education.
        - Middle: A clear, large box or bold section containing:
          - Assessment Title (e.g., "Devoir de contrôle n°1")
          - Subject: ${subject.name}
          - Grade/Stream: ${grade.name} (${stream.name})
          - Date: (Current Date in the subject's language format)
          - Duration: (e.g., 1 Hour / 1 Heure)
        - Horizontal Line: Use a thick horizontal line (---) to separate the header from the content.
      
      - LANGUAGE CONSISTENCY:
        - All labels like "Subject:", "Date:", "Duration:", "Exercise:", "Question:" MUST be in the subject's language.
        - NEVER use Arabic labels for a French or English assessment.
        - Use clear headings for each exercise: **Exercise 1**, **Exercise 2**, etc. (in the subject's language).
        - Sub-headings for parts (e.g., Part A, Part B).
        - Leave significant vertical space between exercises.
      
      - QUESTION FORMATTING:
        - Number every question clearly (1., 2., 3. or a), b), c)).
        - Each question must be in its own paragraph.
        - **SPACING FOR ANSWERS**: After every question that requires a written answer, leave 2-3 empty lines (using multiple newlines) to allow students to write if the exam is printed.
      
      - PEDAGOGICAL RULES:
        - Sourcing: Use ONLY official Ministry of Education (${country.ministryUrl}) question styles.
        - Content: Strictly limited to: ${lessonTitles}.
        - Level: Exactly match the official ${grade.name} level.
      
      TERMINOLOGY VALIDATION (STRICT):
      - ZERO TOLERANCE: DO NOT include any exercise, question, or concept outside the selected lessons: ${lessons.join(", ")}.
      - OFFICIAL TERMINOLOGY: Every single word and term MUST be taken exclusively from the official ${country.names.ar} curriculum and textbooks for ${grade.name}.
      - VALIDATION: Double-check every term against the official program before outputting.
      
      AESTHETICS & STRUCTURE (OFFICIAL EXAM STYLE):
      - LAYOUT: Create a balanced, professional exam paper layout that is easy to read on mobile and perfect for printing.
      - HEADINGS: Use clear, prominent headings for each section (e.g., Exercise 1, Part A).
      - SPACING: Ensure consistent and generous spacing between exercises and questions.
      - NUMBERING: Use a strictly organized and logical numbering system (1., 2., a), b)...).
      
      OFFICIAL EXAM FORMATTING (MANDATORY):
      - START DIRECTLY: The assessment MUST start immediately with the first exercise or section (e.g., "Exercice 1" or "Partie 1").
      - NO ADMINISTRATIVE HEADER: DO NOT include any official headers, republic names, ministry names, or student identification tables (Name, Class, etc.).
      
      - STRUCTURE:
        * Use "Partie / Partie 1 / الجزء الأول" for major sections.
        * Use "Exercice 1 (.. pts)", "Exercice 2 (.. pts)" for exercises, always including the points in parentheses.
        * Each question must be on a new, clear line.
      
      - VISUAL ELEMENTS:
        * For Multiple Choice: Use clear boxes [ ] or ( ) for options.
        * For Written Answers: Use dotted lines (....................) or solid lines (____________________) based on the expected length.
        * Ensure generous vertical space between exercises.
      
      - ORIGINALITY: Create NEW pedagogical questions. DO NOT copy existing official exams, but mimic their EXACT style and difficulty.
      
      - NO CODE BLOCKS: Output the assessment as clean Markdown text. NEVER wrap the entire assessment in a code block.
      
      LINE ORGANIZATION & VISUAL BALANCE (MANDATORY):
      - ONE INSTRUCTION PER LINE: Every single question, instruction, or step MUST start on a new line.
      - NO MULTI-INSTRUCTION LINES: Never combine multiple distinct instructions or sentences on the same line.
      - VERTICAL STRUCTURE: Use a clear, vertical, and step-by-step organization from top to bottom.
      - LOGICAL FLOW: Each step must follow the previous one in a logical, chronological sequence.
      - INDENTATION (STRICT): Use indentation (spaces at the start of the line) to organize nested elements.
      - LINE INTEGRITY: Ensure each line is complete and logically independent.
      - DENSITY: Avoid overcrowding lines. Use generous line spacing and double line breaks (\n\n) between exercises.
      
      ANSWER SPACES (MANDATORY):
      - After EVERY question, you MUST leave a dedicated space for the student to write their answer.
      - The size of the space MUST match the expected answer length (Short, Medium, or Long).
      
      STRICT PROHIBITIONS:
      - NEVER use HTML tags. Use standard Markdown for formatting.
      - NEVER use markdown code blocks (e.g., \` \` \` ) to wrap the assessment.
      - ALGORITHM RULE: If an algorithm or code snippet is included, NEVER use the keywords "var" or "let". Use "const" instead.
      
      Output format: Pure Markdown (NO HTML, NO code blocks). Use bold text for emphasis and clear headings.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "Failed to generate assessment.";
  });
};

export const fetchAssessmentCorrection = async (
  country: Country,
  grade: Grade,
  stream: Stream,
  subject: Subject,
  assessmentContent: string
): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      MANDATORY ASSESSMENT CORRECTION SYSTEM (OFFICIAL METHOD):
      1. Context: Country: ${country.names.ar}, Grade: ${grade.name}, Stream: ${stream.name}, Subject: ${subject.name}.
      2. Assessment to Correct:
      ${assessmentContent}
      
      CORRECTION RULES (MANDATORY):
      - LANGUAGE MATCHING: The correction MUST be written in the same language as the subject (${subject.name}).
        * Subject in French -> Correction in French.
        * Subject in Arabic -> Correction in Arabic.
        * Subject in English -> Correction in English.
      - NATIONAL METHODOLOGY: Use ONLY the official pedagogical methods, solution steps, and rules approved by the Ministry of Education in ${country.names.ar} (as found in textbooks and official exams).
      - CURRICULUM ADHERENCE (STRICT):
        * NO concepts outside the official program.
        * NO advanced methods or shortcuts not taught at the ${grade.name} level.
        * NO extra information or "fun facts" not present in the official curriculum.
        * All terms, rules, and methods must match the official curriculum exactly.
      - STEP-BY-STEP: Provide a clear, logical, and detailed step-by-step correction for every exercise.
      
      LINE ORGANIZATION & VISUAL BALANCE (MANDATORY):
      - ONE INSTRUCTION/STEP PER LINE: Every single step or part of the solution MUST start on a new line.
      - NO MULTI-STEP LINES: Never combine multiple distinct steps or sentences on the same line.
      - VERTICAL STRUCTURE: Use a clear, vertical, and step-by-step organization from top to bottom.
      - INDENTATION (STRICT): Use indentation (spaces at the start of the line) to organize:
        * Loops, conditions, and functions (if applicable).
        * Nested steps or logical blocks.
      - DENSITY: Avoid overcrowding lines. Use generous line spacing and double line breaks (\n\n) between exercises.
      
      STRICT PROHIBITIONS:
      - NEVER use HTML tags like <br>, <p>, or <div>. Use standard Markdown for formatting.
      - NEVER use markdown code blocks (e.g., \` \` \` ) to wrap the correction or any part of it.
      - DO NOT use programming-style formatting or monospaced fonts for the correction text.
      - ALGORITHM RULE: If an algorithm or code snippet is included in the correction, NEVER use the keywords "var" or "let". Use "const" instead.
      
      Output format: Pure Markdown (NO HTML, NO code blocks). Use clear headings for each exercise's correction.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "Failed to generate correction.";
  });
};
