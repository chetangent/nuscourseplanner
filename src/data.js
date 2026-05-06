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
  { year: "Year 1", semester: "Semester 1" },
  { year: "Year 1", semester: "Semester 2" },
  { year: "Year 2", semester: "Semester 1" },
  { year: "Year 2", semester: "Semester 2" },
  { year: "Year 3", semester: "Semester 1" },
  { year: "Year 3", semester: "Semester 2" },
  { year: "Year 4", semester: "Semester 1" },
  { year: "Year 4", semester: "Semester 2" },
];

export const STORAGE_KEY = "nus-course-planner-state-v1";

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
    requirements: DEFAULT_REQUIREMENTS.map((item) => ({ ...item })),
    semesters: SEMESTER_LABELS.map((label, index) => ({
      id: `sem-${index + 1}`,
      index,
      year: label.year,
      semester: label.semester,
      modules: [],
    })),
  };
}

export function getDefaultAcademicYear(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
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
