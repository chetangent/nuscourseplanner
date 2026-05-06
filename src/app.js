import {
  createEmptyPlan,
  GRADE_OPTIONS,
  STORAGE_KEY,
  guessRequirementId,
} from "./data.js";
import {
  calculatePlan,
  evaluateModule,
  formatCap,
  formatMc,
} from "./logic.js";
import {
  fetchModuleCatalog,
  fetchModuleDetails,
  normalizeModuleForPlan,
  searchCatalog,
} from "./nusmods.js";

const state = {
  plan: loadPlan(),
  analytics: null,
  catalog: [],
  catalogLoadedFor: null,
  catalogLoading: false,
  searchQuery: "",
  targetSemesterIndex: 0,
  selectedModuleCatalogEntry: null,
  selectedModuleDetails: null,
};

const academicYearInput = document.querySelector("#academic-year");
const refreshCatalogButton = document.querySelector("#refresh-catalog");
const resetPlanButton = document.querySelector("#reset-plan");
const summaryCards = document.querySelector("#summary-cards");
const yearBreakdown = document.querySelector("#year-breakdown");
const semesterGrid = document.querySelector("#semester-grid");
const requirementsEditor = document.querySelector("#requirements-editor");
const moduleSearchInput = document.querySelector("#module-search");
const targetSemesterSelect = document.querySelector("#target-semester");
const catalogStatus = document.querySelector("#catalog-status");
const searchResults = document.querySelector("#search-results");
const modulePreview = document.querySelector("#module-preview");
const saveStatus = document.querySelector("#save-status");
const semesterTemplate = document.querySelector("#semester-card-template");

let searchDebounce = null;

boot();

function boot() {
  state.analytics = calculatePlan(state.plan);
  academicYearInput.value = state.plan.academicYear;
  targetSemesterSelect.innerHTML = state.plan.semesters
    .map(
      (semester, index) =>
        `<option value="${index}">${semester.year} ${semester.semester}</option>`,
    )
    .join("");
  targetSemesterSelect.value = String(state.targetSemesterIndex);

  bindEvents();
  render();
  if (state.plan.academicYear) {
    loadCatalog(false);
  }
}

function bindEvents() {
  refreshCatalogButton.addEventListener("click", () => loadCatalog(true));
  resetPlanButton.addEventListener("click", handleResetPlan);
  academicYearInput.addEventListener("change", () => {
    state.plan.academicYear = academicYearInput.value.trim();
    state.catalog = [];
    state.catalogLoadedFor = null;
    state.selectedModuleCatalogEntry = null;
    state.selectedModuleDetails = null;
    savePlan();
    render();
    if (state.plan.academicYear) {
      loadCatalog(false);
    }
  });

  moduleSearchInput.addEventListener("input", () => {
    state.searchQuery = moduleSearchInput.value;
    if (searchDebounce) {
      window.clearTimeout(searchDebounce);
    }
    searchDebounce = window.setTimeout(() => {
      if (!state.catalog.length && state.searchQuery.trim()) {
        loadCatalog(false);
      } else {
        renderSearchResults();
      }
    }, 180);
  });

  targetSemesterSelect.addEventListener("change", () => {
    state.targetSemesterIndex = Number(targetSemesterSelect.value);
    renderModulePreview();
  });
}

async function loadCatalog(forceReload) {
  const academicYear = academicYearInput.value.trim();
  if (!academicYear) {
    setCatalogBanner("Add an academic year like 2025-2026 first.", "warning");
    return;
  }
  if (!forceReload && state.catalogLoadedFor === academicYear && state.catalog.length) {
    renderSearchResults();
    return;
  }

  state.catalogLoading = true;
  setCatalogBanner(`Loading NUSMods catalog for ${academicYear}...`, "muted");
  renderSearchResults();

  try {
    state.catalog = await fetchModuleCatalog(academicYear);
    state.catalogLoadedFor = academicYear;
    setCatalogBanner(
      `Loaded ${state.catalog.length.toLocaleString()} modules for ${academicYear}.`,
      "success",
    );
  } catch (error) {
    setCatalogBanner(error.message, "danger");
  } finally {
    state.catalogLoading = false;
    renderSearchResults();
  }
}

async function selectCatalogEntry(moduleCode) {
  const entry = state.catalog.find((item) => item.moduleCode === moduleCode);
  if (!entry) {
    return;
  }
  state.selectedModuleCatalogEntry = entry;
  state.selectedModuleDetails = null;
  renderModulePreview("Loading module details...");

  try {
    state.selectedModuleDetails = await fetchModuleDetails(state.plan.academicYear, moduleCode);
    renderModulePreview();
  } catch (error) {
    renderModulePreview(error.message);
  }
}

function render() {
  state.analytics = calculatePlan(state.plan);
  renderSummary();
  renderRequirements();
  renderSemesters();
  renderSearchResults();
  renderModulePreview();
}

function renderSummary() {
  const analytics = state.analytics;
  const cards = [
    {
      label: "Post-S/U CAP",
      value: formatCap(analytics.overallPostSuCap),
      note: analytics.honoursClassification,
    },
    {
      label: "Pre-S/U CAP",
      value: formatCap(analytics.overallPreSuCap),
      note: `${analytics.gradedMc} graded MC counted`,
    },
    {
      label: "Progress",
      value: `${analytics.totalMc} / 160 MC`,
      note: `${analytics.remainingMc} MC left`,
    },
    {
      label: "Post-S/U counted MC",
      value: `${analytics.postSuMc} MC`,
      note: "After excluding S/U-ed modules",
    },
  ];

  summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <p>${card.label}</p>
          <h3>${card.value}</h3>
          <span>${card.note}</span>
        </article>
      `,
    )
    .join("");

  yearBreakdown.innerHTML = analytics.yearlyResults
    .map(
      (year) => `
        <article class="year-chip">
          <p>${year.year}</p>
          <strong>Pre: ${formatCap(year.preSuCap)}</strong>
          <strong>Post: ${formatCap(year.postSuCap)}</strong>
          <span>${formatMc(year.totalMc)}</span>
        </article>
      `,
    )
    .join("");
}

function renderRequirements() {
  requirementsEditor.innerHTML = state.analytics.requirementProgress
    .map(
      (requirement, index) => `
        <article class="requirement-card">
          <div class="requirement-row">
            <label class="field">
              <span>Name</span>
              <input
                type="text"
                data-requirement-name="${index}"
                value="${escapeHtml(requirement.name)}"
              />
            </label>
            <label class="field small-field">
              <span>Required MC</span>
              <input
                type="number"
                min="0"
                step="1"
                data-requirement-mc="${index}"
                value="${requirement.requiredMc}"
              />
            </label>
          </div>
          <div class="progress-strip">
            <div class="progress-fill" style="width: ${requirement.percentage}%"></div>
          </div>
          <div class="requirement-meta">
            <span>${requirement.completedMc} MC mapped</span>
            <span>${requirement.remainingMc} MC remaining</span>
          </div>
        </article>
      `,
    )
    .join("");

  requirementsEditor.querySelectorAll("[data-requirement-name]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const index = Number(event.currentTarget.dataset.requirementName);
      state.plan.requirements[index].name = event.currentTarget.value;
      savePlan();
      render();
    });
  });

  requirementsEditor.querySelectorAll("[data-requirement-mc]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const index = Number(event.currentTarget.dataset.requirementMc);
      state.plan.requirements[index].requiredMc = Number(event.currentTarget.value) || 0;
      savePlan();
      render();
    });
  });
}

function renderSemesters() {
  semesterGrid.innerHTML = "";

  state.plan.semesters.forEach((semester, semesterIndex) => {
    const card = semesterTemplate.content.firstElementChild.cloneNode(true);
    const result = state.analytics.semesterResults[semesterIndex];
    card.querySelector(".semester-year").textContent = semester.year;
    card.querySelector(".semester-name").textContent = semester.semester;
    card.querySelector(
      ".semester-cap",
    ).innerHTML = `<span>Pre ${formatCap(result.preSuCap)}</span><span>Post ${formatCap(
      result.postSuCap,
    )}</span>`;
    card.querySelector(
      ".semester-meta",
    ).innerHTML = `<span>${formatMc(result.totalMc)}</span><span>${result.modules.length} modules</span>`;

    const rows = card.querySelector(".semester-rows");
    rows.innerHTML = result.modules.length
      ? result.modules
          .map((module) => createModuleRowMarkup(module, semesterIndex))
          .join("")
      : `<tr><td colspan="6" class="empty-row">No modules added yet.</td></tr>`;

    wireSemesterRows(card, semesterIndex);

    card.querySelector(".add-manual").addEventListener("click", () => {
      addManualModule(semesterIndex);
    });

    semesterGrid.append(card);
  });
}

function createModuleRowMarkup(module, semesterIndex) {
  const requirementOptions = state.plan.requirements
    .map(
      (requirement) => `
        <option value="${requirement.id}" ${
          requirement.id === module.requirementId ? "selected" : ""
        }>
          ${escapeHtml(requirement.name)}
        </option>
      `,
    )
    .join("");

  const gradeOptions = GRADE_OPTIONS.map(
    (grade) =>
      `<option value="${grade}" ${grade === module.grade ? "selected" : ""}>${
        grade || "Ungraded"
      }</option>`,
  ).join("");

  const semesterResult = evaluateModule(module, state.plan.semesters, semesterIndex);
  const availabilityClass =
    semesterResult.availability.offered === false
      ? "badge danger"
      : semesterResult.availability.offered
        ? "badge success"
        : "badge muted";
  const prerequisiteClass =
    semesterResult.prerequisiteCheck.status === "missing"
      ? "badge warning"
      : semesterResult.prerequisiteCheck.status === "met"
        ? "badge success"
        : "badge muted";

  return `
    <tr>
      <td>
        <div class="module-title-cell">
          <input
            class="table-input"
            type="text"
            data-module-code="${module.id}"
            value="${escapeHtml(module.moduleCode || "")}"
            placeholder="Module code"
          />
          <input
            class="table-input"
            type="text"
            data-module-title="${module.id}"
            value="${escapeHtml(module.title || "")}"
            placeholder="Module title"
          />
          <div class="badge-row">
            <span class="${availabilityClass}">${escapeHtml(
              semesterResult.availability.message,
            )}</span>
            <span class="${prerequisiteClass}">${escapeHtml(
              semesterResult.prerequisiteCheck.summary,
            )}</span>
          </div>
        </div>
      </td>
      <td>
        <input
          class="table-input short-input"
          type="number"
          min="0"
          step="1"
          data-module-credit="${module.id}"
          value="${module.moduleCredit}"
        />
      </td>
      <td>
        <select class="table-input" data-module-requirement="${module.id}">
          ${requirementOptions}
        </select>
      </td>
      <td>
        <select class="table-input" data-module-grade="${module.id}">
          ${gradeOptions}
        </select>
      </td>
      <td>
        <label class="su-toggle">
          <input
            type="checkbox"
            data-module-su="${module.id}"
            ${module.useSu ? "checked" : ""}
            ${module.suEligible ? "" : "disabled"}
          />
          <span>${module.suEligible ? "Use S/U" : "Not S/U-able"}</span>
        </label>
      </td>
      <td>
        <button class="icon-button" type="button" data-module-remove="${module.id}">
          Remove
        </button>
      </td>
    </tr>
  `;
}

function wireSemesterRows(card, semesterIndex) {
  card.querySelectorAll("[data-module-code]").forEach((input) => {
    input.addEventListener("change", (event) => {
      updateModule(semesterIndex, event.currentTarget.dataset.moduleCode, (module) => {
        module.moduleCode = event.currentTarget.value.toUpperCase().trim();
      });
    });
  });

  card.querySelectorAll("[data-module-title]").forEach((input) => {
    input.addEventListener("change", (event) => {
      updateModule(semesterIndex, event.currentTarget.dataset.moduleTitle, (module) => {
        module.title = event.currentTarget.value;
      });
    });
  });

  card.querySelectorAll("[data-module-credit]").forEach((input) => {
    input.addEventListener("change", (event) => {
      updateModule(semesterIndex, event.currentTarget.dataset.moduleCredit, (module) => {
        module.moduleCredit = Number(event.currentTarget.value) || 0;
      });
    });
  });

  card.querySelectorAll("[data-module-requirement]").forEach((select) => {
    select.addEventListener("change", (event) => {
      updateModule(semesterIndex, event.currentTarget.dataset.moduleRequirement, (module) => {
        module.requirementId = event.currentTarget.value;
      });
    });
  });

  card.querySelectorAll("[data-module-grade]").forEach((select) => {
    select.addEventListener("change", (event) => {
      updateModule(semesterIndex, event.currentTarget.dataset.moduleGrade, (module) => {
        module.grade = event.currentTarget.value;
      });
    });
  });

  card.querySelectorAll("[data-module-su]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      updateModule(semesterIndex, event.currentTarget.dataset.moduleSu, (module) => {
        module.useSu = event.currentTarget.checked;
      });
    });
  });

  card.querySelectorAll("[data-module-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      removeModule(semesterIndex, event.currentTarget.dataset.moduleRemove);
    });
  });
}

function renderSearchResults() {
  if (state.catalogLoading) {
    searchResults.innerHTML = "";
    return;
  }

  const query = state.searchQuery.trim();
  if (!query) {
    searchResults.innerHTML =
      '<div class="empty-state small-empty">Type a module code or title to search the live catalog.</div>';
    return;
  }

  if (!state.catalog.length) {
    searchResults.innerHTML =
      '<div class="empty-state small-empty">The catalog is not loaded yet.</div>';
    return;
  }

  const matches = searchCatalog(state.catalog, query);
  if (!matches.length) {
    searchResults.innerHTML =
      '<div class="empty-state small-empty">No modules matched that search.</div>';
    return;
  }

  searchResults.innerHTML = matches
    .map(
      (item) => `
        <button class="search-result" type="button" data-catalog-code="${item.moduleCode}">
          <strong>${escapeHtml(item.moduleCode)}</strong>
          <span>${escapeHtml(item.title)}</span>
          <small>Offered in sems ${item.semesters.join(", ")}</small>
        </button>
      `,
    )
    .join("");

  searchResults.querySelectorAll("[data-catalog-code]").forEach((button) => {
    button.addEventListener("click", (event) => {
      selectCatalogEntry(event.currentTarget.dataset.catalogCode);
    });
  });
}

function renderModulePreview(message) {
  if (message) {
    modulePreview.innerHTML = `<div class="banner banner-muted">${escapeHtml(message)}</div>`;
    return;
  }

  if (!state.selectedModuleCatalogEntry) {
    modulePreview.className = "module-preview empty-state";
    modulePreview.textContent =
      "Search for a module to inspect its CAP, S/U, prerequisite, and semester availability details.";
    return;
  }

  if (!state.selectedModuleDetails) {
    modulePreview.className = "module-preview";
    modulePreview.innerHTML = `<div class="banner banner-muted">Loading module details...</div>`;
    return;
  }

  const requirementId = guessRequirementId(
    state.selectedModuleDetails.moduleCode,
    state.selectedModuleDetails.title,
  );
  const draftModule = normalizeModuleForPlan(
    state.selectedModuleDetails,
    state.selectedModuleCatalogEntry,
    requirementId,
  );
  const evaluation = evaluateModule(
    draftModule,
    state.plan.semesters,
    state.targetSemesterIndex,
  );
  const requirementOptions = state.plan.requirements
    .map(
      (requirement) => `
        <option value="${requirement.id}" ${
          requirement.id === requirementId ? "selected" : ""
        }>
          ${escapeHtml(requirement.name)}
        </option>
      `,
    )
    .join("");

  modulePreview.className = "module-preview";
  modulePreview.innerHTML = `
    <div class="preview-header">
      <div>
        <p class="preview-code">${escapeHtml(state.selectedModuleDetails.moduleCode)}</p>
        <h3>${escapeHtml(state.selectedModuleDetails.title)}</h3>
      </div>
      <span class="credit-pill">${draftModule.moduleCredit} MC</span>
    </div>
    <div class="preview-grid">
      <article class="preview-card">
        <p>Availability</p>
        <strong>${escapeHtml(evaluation.availability.message)}</strong>
        <span>Offered semesters: ${escapeHtml(
          draftModule.offeredSemesters.join(", ") || "Unknown",
        )}</span>
      </article>
      <article class="preview-card">
        <p>S/U</p>
        <strong>${draftModule.suEligible ? "S/U eligible" : "Not S/U eligible"}</strong>
        <span>Source AY: ${escapeHtml(draftModule.sourceAcademicYear || state.plan.academicYear)}</span>
      </article>
      <article class="preview-card">
        <p>Prerequisites</p>
        <strong>${escapeHtml(evaluation.prerequisiteCheck.summary)}</strong>
        <span>${escapeHtml(
          state.selectedModuleDetails.prerequisite || "No prerequisite text listed",
        )}</span>
      </article>
    </div>
    <div class="field-row">
      <label class="field">
        <span>Map to requirement</span>
        <select id="preview-requirement">${requirementOptions}</select>
      </label>
      <button id="add-selected-module" class="btn btn-primary" type="button">
        Add to ${escapeHtml(state.plan.semesters[state.targetSemesterIndex].year)} ${escapeHtml(
          state.plan.semesters[state.targetSemesterIndex].semester,
        )}
      </button>
    </div>
    <div class="preview-description">
      ${escapeHtml(state.selectedModuleDetails.description || "No module description provided.")}
    </div>
  `;

  modulePreview.querySelector("#add-selected-module").addEventListener("click", () => {
    const selectedRequirementId = modulePreview.querySelector("#preview-requirement").value;
    addSelectedModule(selectedRequirementId);
  });
}

function addSelectedModule(requirementId) {
  if (!state.selectedModuleCatalogEntry || !state.selectedModuleDetails) {
    return;
  }

  const newModule = normalizeModuleForPlan(
    state.selectedModuleDetails,
    state.selectedModuleCatalogEntry,
    requirementId,
  );

  state.plan.semesters[state.targetSemesterIndex].modules.push(newModule);
  savePlan();
  render();
  saveStatus.textContent = `${newModule.moduleCode} added to ${state.plan.semesters[state.targetSemesterIndex].year} ${state.plan.semesters[state.targetSemesterIndex].semester}.`;
}

function addManualModule(semesterIndex) {
  state.plan.semesters[semesterIndex].modules.push({
    id: crypto.randomUUID(),
    moduleCode: "",
    title: "Custom module",
    moduleCredit: 4,
    grade: "",
    suEligible: false,
    useSu: false,
    requirementId: "custom",
    prerequisite: "",
    prerequisiteRule: "",
    offeredSemesters: [(semesterIndex % 2) + 1],
    semesterData: [],
    sourceAcademicYear: state.plan.academicYear,
  });
  savePlan();
  render();
}

function updateModule(semesterIndex, moduleId, updater) {
  const module = state.plan.semesters[semesterIndex].modules.find((item) => item.id === moduleId);
  if (!module) {
    return;
  }
  updater(module);
  savePlan();
  render();
}

function removeModule(semesterIndex, moduleId) {
  state.plan.semesters[semesterIndex].modules = state.plan.semesters[
    semesterIndex
  ].modules.filter((module) => module.id !== moduleId);
  savePlan();
  render();
}

function handleResetPlan() {
  const confirmed = window.confirm("Reset the planner and clear all saved semesters?");
  if (!confirmed) {
    return;
  }
  state.plan = createEmptyPlan();
  state.analytics = calculatePlan(state.plan);
  state.catalog = [];
  state.catalogLoadedFor = null;
  state.searchQuery = "";
  state.selectedModuleCatalogEntry = null;
  state.selectedModuleDetails = null;
  moduleSearchInput.value = "";
  academicYearInput.value = state.plan.academicYear;
  savePlan();
  render();
}

function savePlan() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plan));
  state.analytics = calculatePlan(state.plan);
  saveStatus.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
}

function loadPlan() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptyPlan();
  }
  try {
    const parsed = JSON.parse(raw);
    const fresh = createEmptyPlan();
    return {
      ...fresh,
      ...parsed,
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements
        : fresh.requirements,
      semesters: Array.isArray(parsed.semesters) ? parsed.semesters : fresh.semesters,
    };
  } catch {
    return createEmptyPlan();
  }
}

function setCatalogBanner(message, tone) {
  catalogStatus.className = `banner banner-${tone}`;
  catalogStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
