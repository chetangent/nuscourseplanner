export const TOTAL_REQUIRED_MC = 160;

export const GRADE_POINTS = {
  "A+": 5,
  A: 5,
  "A-": 4.5,
  "B+": 4,
  B: 3.5,
  "B-": 3,
  "C+": 2.5,
  C: 2,
  "D+": 1.5,
  D: 1,
  F: 0,
};

export const GRADE_OPTIONS = [
  "",
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "D+",
  "D",
  "F",
  "CS",
  "CU",
  "S",
  "U",
  "IP",
];

export const HONOURS_BANDS = [
  { minimum: 4.5, label: "First Class Honours" },
  { minimum: 4.0, label: "Second Upper Honours" },
  { minimum: 3.5, label: "Second Lower Honours" },
  { minimum: 0, label: "Below honours threshold" },
];

export const DEFAULT_REQUIREMENTS = [
  { id: "common-core", name: "Common Core Curriculum", requiredMc: 40 },
  { id: "cs-foundation", name: "CS Foundation", requiredMc: 36 },
  { id: "cs-breadth-depth", name: "CS Breadth and Depth", requiredMc: 24 },
  { id: "math-sciences", name: "Mathematics & Sciences", requiredMc: 20 },
  { id: "unrestricted-electives", name: "Unrestricted Electives", requiredMc: 40 },
  { id: "custom", name: "Custom / Other", requiredMc: 0 },
];

export const SEMESTER_LABELS = [
  { year: "Year 1", semester: "Semester 1", order: 10, termNumber: 1 },
  { year: "Year 1", semester: "Semester 2", order: 20, termNumber: 2 },
  { year: "Year 2", semester: "Semester 1", order: 30, termNumber: 1 },
  { year: "Year 2", semester: "Semester 2", order: 40, termNumber: 2 },
  { year: "Year 3", semester: "Semester 1", order: 50, termNumber: 1 },
  { year: "Year 3", semester: "Semester 2", order: 60, termNumber: 2 },
  { year: "Year 4", semester: "Semester 1", order: 70, termNumber: 1 },
  { year: "Year 4", semester: "Semester 2", order: 80, termNumber: 2 },
];

export const STORAGE_KEY = "nus-course-planner-state-v1";
export const DEFAULT_SU_BUDGET_MC = 32;

export const SEMESTER_NUMBER_LABELS = {
  1: "Semester 1",
  2: "Semester 2",
  3: "Special Term 1",
  4: "Special Term 2",
};

export const EXTRA_TERM_LOCATIONS = [
  { id: "before-year-1", label: "Before Year 1", year: "Before Year 1", baseOrder: 0 },
  { id: "year-1", label: "After Year 1", year: "Year 1", baseOrder: 20 },
  { id: "year-2", label: "After Year 2", year: "Year 2", baseOrder: 40 },
  { id: "year-3", label: "After Year 3", year: "Year 3", baseOrder: 60 },
  { id: "year-4", label: "After Year 4", year: "Year 4", baseOrder: 80 },
];

export const EXTRA_TERM_TYPES = [
  { id: "special-1", label: "Special Term 1", termNumber: 3 },
  { id: "special-2", label: "Special Term 2", termNumber: 4 },
  { id: "vacation", label: "Vacation / Internship Term", termNumber: null },
];

const FOUNDATION_CODES = new Set([
  "CS1010",
  "CS1010A",
  "CS1010E",
  "CS1010J",
  "CS1010S",
  "CS1010X",
  "CS1101S",
  "CS1231",
  "CS1231S",
  "CS2030",
  "CS2030S",
  "CS2040",
  "CS2040S",
  "CS2100",
  "CS2101",
  "CS2103",
  "CS2103T",
  "CS2106",
  "CS2109S",
  "CS3230",
]);

export function createEmptyPlan() {
  return {
    academicYear: getDefaultAcademicYear(),
    suBudgetMc: DEFAULT_SU_BUDGET_MC,
    requirements: DEFAULT_REQUIREMENTS.map((item) => ({ ...item })),
    semesters: SEMESTER_LABELS.map((label, index) => ({
      id: `sem-${index + 1}`,
      year: label.year,
      semester: label.semester,
      order: label.order,
      termNumber: label.termNumber,
      isCore: true,
      modules: [],
    })),
  };
}

export function formatSemesterNumber(semesterNumber) {
  return SEMESTER_NUMBER_LABELS[semesterNumber] ?? `Semester ${semesterNumber}`;
}

export function getDefaultAcademicYear(date = new Date()) {
  const startYear = getAcademicYearStart(date);
  return `${startYear}-${startYear + 1}`;
}

export function normalizeAcademicYear(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{4})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return getDefaultAcademicYear();
}

export function getAcademicYearOptions(currentAcademicYear) {
  const normalizedYear = normalizeAcademicYear(currentAcademicYear);
  const currentStartYear = Number.parseInt(normalizedYear.slice(0, 4), 10);
  const startYear = Number.isFinite(currentStartYear)
    ? currentStartYear - 3
    : getAcademicYearStart(new Date()) - 3;

  return Array.from({ length: 8 }, (_, index) => {
    const year = startYear + index;
    return `${year}-${year + 1}`;
  });
}

export function getOrderedSemesters(semesters = []) {
  return [...semesters].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

function getAcademicYearStart(date) {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 6 ? year : year - 1;
}

export function guessRequirementId(moduleCode = "", title = "") {
  const code = moduleCode.toUpperCase();
  if (FOUNDATION_CODES.has(code)) {
    return "cs-foundation";
  }
  if (
    code.startsWith("GE") ||
    code.startsWith("IS11") ||
    code.startsWith("ES26") ||
    code.startsWith("DTK")
  ) {
    return "common-core";
  }
  if (code.startsWith("MA") || code.startsWith("ST") || code.startsWith("PC")) {
    return "math-sciences";
  }
  if (code.startsWith("CS")) {
    return "cs-breadth-depth";
  }
  if (title.toLowerCase().includes("career") || title.toLowerCase().includes("intern")) {
    return "unrestricted-electives";
  }
  return "custom";
}
