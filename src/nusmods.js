const API_BASE = "https://api.nusmods.com/v2";

export async function fetchModuleCatalog(academicYear) {
  const response = await fetch(`${API_BASE}/${academicYear}/moduleList.json`);
  if (!response.ok) {
    throw new Error(`Unable to load module list for ${academicYear}`);
  }
  return response.json();
}

export async function fetchModuleDetails(academicYear, moduleCode) {
  const response = await fetch(
    `${API_BASE}/${academicYear}/modules/${encodeURIComponent(moduleCode.toUpperCase())}.json`,
  );
  if (!response.ok) {
    throw new Error(`Unable to load details for ${moduleCode}`);
  }
  return response.json();
}

export function searchCatalog(catalog, query, limit = 20) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return catalog
    .filter((item) => {
      const code = item.moduleCode.toLowerCase();
      const title = item.title.toLowerCase();
      return code.includes(normalized) || title.includes(normalized);
    })
    .sort((left, right) => {
      const leftStarts = left.moduleCode.toLowerCase().startsWith(normalized) ? 0 : 1;
      const rightStarts = right.moduleCode.toLowerCase().startsWith(normalized) ? 0 : 1;
      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }
      return left.moduleCode.localeCompare(right.moduleCode);
    })
    .slice(0, limit);
}

export function normalizeModuleForPlan(details, fallbackCatalogEntry, requirementId) {
  return {
    id: crypto.randomUUID(),
    moduleCode: details.moduleCode,
    title: details.title,
    moduleCredit: Number(details.moduleCredit) || 0,
    grade: "",
    suEligible: Boolean(details.attributes?.su),
    useSu: false,
    requirementId,
    prerequisite: details.prerequisite ?? "",
    prerequisiteRule: details.prerequisiteRule ?? "",
    offeredSemesters:
      details.semesterData?.map((item) => item.semester).filter((item) => Number.isFinite(item)) ??
      fallbackCatalogEntry?.semesters ??
      [],
    semesterData: details.semesterData ?? [],
    sourceAcademicYear: details.acadYear?.replace("/", "-") ?? null,
  };
}
