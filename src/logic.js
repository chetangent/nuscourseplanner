import {
  GRADE_POINTS,
  HONOURS_BANDS,
  TOTAL_REQUIRED_MC,
  DEFAULT_SU_BUDGET_MC,
} from "./data.js";

export function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

export function formatCap(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return value.toFixed(2);
}

export function formatMc(value) {
  return Number.isFinite(value) ? `${value} MC` : "0 MC";
}

export function getGradePoint(grade) {
  if (!grade) {
    return null;
  }
  return Object.hasOwn(GRADE_POINTS, grade) ? GRADE_POINTS[grade] : null;
}

export function getHonoursLabel(cap) {
  if (!Number.isFinite(cap)) {
    return "Not enough graded MCs";
  }
  const match = HONOURS_BANDS.find((band) => cap >= band.minimum);
  return match ? match.label : "Not enough graded MCs";
}

export function calculatePlan(plan) {
  const semesterResults = plan.semesters.map((semester, semesterIndex) =>
    calculateSemester(semester, plan.requirements, plan.semesters, semesterIndex),
  );

  const yearlyResults = [];
  for (let yearIndex = 0; yearIndex < plan.semesters.length; yearIndex += 2) {
    const semOne = semesterResults[yearIndex];
    const semTwo = semesterResults[yearIndex + 1];
    yearlyResults.push({
      year: plan.semesters[yearIndex].year,
      preSuCap: weightedAverage(
        [semOne?.preSuGradePoints, semTwo?.preSuGradePoints],
        [semOne?.gradedMc, semTwo?.gradedMc],
      ),
      postSuCap: weightedAverage(
        [semOne?.postSuGradePoints, semTwo?.postSuGradePoints],
        [semOne?.postSuMc, semTwo?.postSuMc],
      ),
      totalMc: (semOne?.totalMc ?? 0) + (semTwo?.totalMc ?? 0),
    });
  }

  const totalMc = semesterResults.reduce((sum, item) => sum + item.totalMc, 0);
  const gradedMc = semesterResults.reduce((sum, item) => sum + item.gradedMc, 0);
  const postSuMc = semesterResults.reduce((sum, item) => sum + item.postSuMc, 0);
  const suUsedMc = Math.max(gradedMc - postSuMc, 0);
  const suBudgetMc = Number.isFinite(Number(plan.suBudgetMc))
    ? Number(plan.suBudgetMc)
    : DEFAULT_SU_BUDGET_MC;
  const preSuGradePoints = semesterResults.reduce(
    (sum, item) => sum + item.preSuGradePoints,
    0,
  );
  const postSuGradePoints = semesterResults.reduce(
    (sum, item) => sum + item.postSuGradePoints,
    0,
  );

  const requirementProgress = plan.requirements.map((requirement) => {
    const completedMc = plan.semesters.reduce(
      (sum, semester) =>
        sum +
        semester.modules
          .filter((module) => module.requirementId === requirement.id)
          .reduce((moduleSum, module) => moduleSum + toNumber(module.moduleCredit), 0),
      0,
    );
    return {
      ...requirement,
      completedMc,
      remainingMc: Math.max((requirement.requiredMc ?? 0) - completedMc, 0),
      percentage:
        requirement.requiredMc > 0
          ? Math.min((completedMc / requirement.requiredMc) * 100, 100)
          : completedMc > 0
            ? 100
            : 0,
    };
  });

  const overallPreSuCap = gradedMc > 0 ? preSuGradePoints / gradedMc : null;
  const overallPostSuCap = postSuMc > 0 ? postSuGradePoints / postSuMc : null;

  return {
    semesterResults,
    yearlyResults,
    requirementProgress,
    totalMc,
    remainingMc: Math.max(TOTAL_REQUIRED_MC - totalMc, 0),
    gradedMc,
    postSuMc,
    suUsedMc,
    suBudgetMc,
    suRemainingMc: Math.max(suBudgetMc - suUsedMc, 0),
    overallPreSuCap,
    overallPostSuCap,
    honoursClassification: getHonoursLabel(overallPostSuCap),
    courseProgress:
      TOTAL_REQUIRED_MC > 0 ? Math.min((totalMc / TOTAL_REQUIRED_MC) * 100, 100) : 0,
  };
}

export function evaluateModule(module, allSemesters, semesterIndex) {
  const numericGrade = getGradePoint(module.grade);
  const moduleCredit = toNumber(module.moduleCredit);
  const suApplied = Boolean(module.useSu) && Boolean(module.suEligible);

  const takenEarlier = getCompletedModuleCodesBefore(allSemesters, semesterIndex);
  const prerequisiteCheck = evaluatePrerequisites(module, takenEarlier);
  const availability = getAvailabilityStatus(module, semesterIndex);

  return {
    numericGrade,
    moduleCredit,
    gradedMc: Number.isFinite(numericGrade) ? moduleCredit : 0,
    postSuMc: Number.isFinite(numericGrade) && !suApplied ? moduleCredit : 0,
    preSuGradePoints: Number.isFinite(numericGrade) ? numericGrade * moduleCredit : 0,
    postSuGradePoints:
      Number.isFinite(numericGrade) && !suApplied ? numericGrade * moduleCredit : 0,
    prerequisiteCheck,
    availability,
  };
}

function calculateSemester(semester, requirements, allSemesters, semesterIndex) {
  const modules = semester.modules.map((module) => {
    const evaluation = evaluateModule(module, allSemesters, semesterIndex);
    const requirementName =
      requirements.find((item) => item.id === module.requirementId)?.name ?? "Custom / Other";
    return {
      ...module,
      requirementName,
      ...evaluation,
    };
  });

  const totalMc = modules.reduce((sum, module) => sum + module.moduleCredit, 0);
  const gradedMc = modules.reduce((sum, module) => sum + module.gradedMc, 0);
  const postSuMc = modules.reduce((sum, module) => sum + module.postSuMc, 0);
  const preSuGradePoints = modules.reduce((sum, module) => sum + module.preSuGradePoints, 0);
  const postSuGradePoints = modules.reduce((sum, module) => sum + module.postSuGradePoints, 0);

  return {
    totalMc,
    gradedMc,
    postSuMc,
    preSuGradePoints,
    postSuGradePoints,
    preSuCap: gradedMc > 0 ? preSuGradePoints / gradedMc : null,
    postSuCap: postSuMc > 0 ? postSuGradePoints / postSuMc : null,
    modules,
  };
}

function weightedAverage(numerators, denominators) {
  const numerator = numerators.reduce((sum, item) => sum + (item ?? 0), 0);
  const denominator = denominators.reduce((sum, item) => sum + (item ?? 0), 0);
  return denominator > 0 ? numerator / denominator : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCompletedModuleCodesBefore(allSemesters, semesterIndex) {
  const codes = new Set();
  allSemesters.slice(0, semesterIndex).forEach((semester) => {
    semester.modules.forEach((module) => {
      if (module.moduleCode) {
        codes.add(module.moduleCode.toUpperCase());
      }
    });
  });
  return codes;
}

function getAvailabilityStatus(module, semesterIndex) {
  const semesterNumber = (semesterIndex % 2) + 1;
  const offered = Array.isArray(module.offeredSemesters)
    ? module.offeredSemesters.includes(semesterNumber)
    : null;

  if (offered === null) {
    return {
      offered: null,
      message: "Semester offering unknown",
    };
  }

  return offered
    ? {
        offered: true,
        message: `Offered in ${formatSemesterNumber(semesterNumber)}`,
      }
    : {
        offered: false,
        message: `Not listed for ${formatSemesterNumber(semesterNumber)}`,
      };
}

export function evaluatePrerequisites(module, completedCodes) {
  const rule = module.prerequisiteRule || "";
  const fallbackCodes = extractCourseCodes(
    `${module.prerequisiteRule ?? ""} ${module.prerequisite ?? ""}`,
  );

  if (!rule.trim()) {
    return {
      status: fallbackCodes.length ? "approximate" : "clear",
      summary: fallbackCodes.length
        ? `Possible prerequisite codes: ${fallbackCodes.join(", ")}`
        : "No prerequisite rule listed",
      matchedCodes: fallbackCodes.filter((code) => completedCodes.has(code)),
      missingCodes: fallbackCodes.filter((code) => !completedCodes.has(code)),
    };
  }

  const parsed = parsePrerequisiteRule(rule);
  if (!parsed) {
    return {
      status: fallbackCodes.length ? "approximate" : "unknown",
      summary: fallbackCodes.length
        ? `Complex prerequisite rule. Potential course codes: ${fallbackCodes.join(", ")}`
        : "Complex prerequisite rule",
      matchedCodes: fallbackCodes.filter((code) => completedCodes.has(code)),
      missingCodes: fallbackCodes.filter((code) => !completedCodes.has(code)),
    };
  }

  const satisfied = evaluatePrerequisiteNode(parsed.tree, parsed.groups, completedCodes);
  const allCodes = Array.from(new Set(parsed.groups.flatMap((group) => group.codes)));
  const matchedCodes = allCodes.filter((code) => completedCodes.has(code));
  const missingCodes = allCodes.filter((code) => !completedCodes.has(code));

  return {
    status: satisfied ? "met" : "missing",
    summary: satisfied
      ? "Prerequisite rule appears satisfied by earlier semesters"
      : `Missing prerequisite coverage for ${missingCodes.join(", ") || "one or more groups"}`,
    matchedCodes,
    missingCodes,
  };
}

function parsePrerequisiteRule(rule) {
  const thenIndex = rule.indexOf("THEN");
  const working = (thenIndex >= 0 ? rule.slice(thenIndex + 4) : rule)
    .replace(/\s+/g, " ")
    .trim();

  const groups = [];
  let expression = working.replace(
    /COURSES\s*\((\d+)\)\s*([^()]+?)(?=\s+(?:AND|OR)\s+|$|\))/g,
    (_, minCount, codeBlob) => {
      const codes = Array.from(
        new Set(
          (codeBlob.match(/[A-Z]{2,3}\d{4}[A-Z]{0,3}/g) || []).map((code) => code.toUpperCase()),
        ),
      );
      const groupIndex = groups.push({ minCount: Number(minCount), codes }) - 1;
      return ` G${groupIndex} `;
    },
  );

  expression = expression.replace(/SUBJECTS\s*\((\d+)\)\s*([^()]+?)(?=\s+(?:AND|OR)\s+|$|\))/g, " TRUE ");
  expression = expression.replace(/[A-Z_]+\s+IF_IN\s+[^()]+/g, " TRUE ");
  expression = expression.replace(/[A-Z_]+\s+IF_[A-Z]+\s+[^()]+/g, " TRUE ");
  expression = expression.replace(/must have completed/gi, "");
  expression = expression.replace(/must not have completed/gi, "");
  expression = expression.replace(/ at a grade of at least [A-Z+:-]+/gi, "");
  expression = expression.replace(/[^A-Z0-9() ]+/g, " ");
  expression = expression.replace(/\s+/g, " ").trim();

  const tokens = expression.match(/G\d+|TRUE|FALSE|AND|OR|\(|\)/g);
  if (!tokens?.length) {
    return null;
  }

  let position = 0;

  function parseExpression() {
    let node = parseTerm();
    while (tokens[position] === "OR") {
      position += 1;
      node = { type: "or", left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseFactor();
    while (tokens[position] === "AND") {
      position += 1;
      node = { type: "and", left: node, right: parseFactor() };
    }
    return node;
  }

  function parseFactor() {
    const token = tokens[position];
    if (!token) {
      throw new Error("Unexpected end of tokens");
    }
    if (token === "(") {
      position += 1;
      const node = parseExpression();
      if (tokens[position] !== ")") {
        throw new Error("Expected closing bracket");
      }
      position += 1;
      return node;
    }
    position += 1;
    if (token === "TRUE" || token === "FALSE") {
      return { type: "literal", value: token === "TRUE" };
    }
    if (token.startsWith("G")) {
      return { type: "group", value: Number(token.slice(1)) };
    }
    throw new Error(`Unexpected token ${token}`);
  }

  try {
    const tree = parseExpression();
    return { tree, groups };
  } catch {
    return null;
  }
}

function evaluatePrerequisiteNode(node, groups, completedCodes) {
  if (node.type === "literal") {
    return node.value;
  }
  if (node.type === "group") {
    const group = groups[node.value];
    if (!group || !group.codes.length) {
      return true;
    }
    const matched = group.codes.filter((code) => completedCodes.has(code)).length;
    return matched >= Math.max(group.minCount || 1, 1);
  }
  if (node.type === "and") {
    return (
      evaluatePrerequisiteNode(node.left, groups, completedCodes) &&
      evaluatePrerequisiteNode(node.right, groups, completedCodes)
    );
  }
  if (node.type === "or") {
    return (
      evaluatePrerequisiteNode(node.left, groups, completedCodes) ||
      evaluatePrerequisiteNode(node.right, groups, completedCodes)
    );
  }
  return false;
}

function extractCourseCodes(text) {
  return Array.from(
    new Set((text.match(/[A-Z]{2,3}\d{4}[A-Z]{0,3}/g) || []).map((code) => code.toUpperCase())),
  );
}
import { formatSemesterNumber } from "./data.js";
