import {
  createEmptyPlan,
  EXTRA_TERM_LOCATIONS,
  EXTRA_TERM_TYPES,
  GRADE_OPTIONS,
  STORAGE_KEY,
  getAcademicYearOptions,
  getOrderedSemesters,
  normalizeAcademicYear,
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
  formatOfferedSemesters,
  normalizeModuleForPlan,
  searchCatalog,
} from "./nusmods.js";

const ACTIVE_VIEW_STORAGE_KEY = "nus-course-planner-active-view";

const state = {
  plan: loadPlan(),
  analytics: null,
  catalog: [],
  catalogLoadedFor: null,
  catalogLoading: false,
  searchQuery: "",
  targetSemesterId: "",
  selectedModuleCatalogEntry: null,
  selectedModuleDetails: null,
  activeView: "dashboard",
  dashboardDetailsVisible: false,
};

const academicYearInput = document.querySelector("#academic-year");
const refreshCatalogButton = document.querySelector("#refresh-catalog");
const resetPlanButton = document.querySelector("#reset-plan");
const summaryCards = document.querySelector("#summary-cards");
const scheduleSummaryCards = document.querySelector("#schedule-summary-cards");
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
const suBudgetInput = document.querySelector("#su-budget");
const extraTermQuickAdd = document.querySelector("#extra-term-quick-add");
const viewTabs = document.querySelectorAll("[data-view-tab]");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const showDetailedStatsButton = document.querySelector("#show-detailed-stats");
const dashboardDetailedStats = document.querySelector("#dashboard-detailed-stats");

let searchDebounce = null;

boot();

function boot() {
  state.plan.academicYear = normalizeAcademicYear(state.plan.academicYear);
  state.activeView = loadActiveView();
  state.analytics = calculatePlan(state.plan);
  renderAcademicYearOptions();
  suBudgetInput.value = state.plan.suBudgetMc ?? 32;
  bindEvents();
  render();
  if (state.plan.academicYear) {
    loadCatalog(false);
  }
}

function bindEvents() {
  refreshCatalogButton.addEventListener("click", () => loadCatalog(true));
  resetPlanButton.addEventListener("click", handleResetPlan);
  suBudgetInput.addEventListener("change", () => {
    state.plan.suBudgetMc = Number(suBudgetInput.value) || 0;
    savePlan();
    render();
  });
  academicYearInput.addEventListener("change", () => {
    state.plan.academicYear = normalizeAcademicYear(academicYearInput.value);
    state.catalog = [];
    state.catalogLoadedFor = null;
    state.selectedModuleCatalogEntry = null;
    state.selectedModuleDetails = null;
    savePlan();
    render();
    loadCatalog(false);
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
    state.targetSemesterId = targetSemesterSelect.value;
    renderModulePreview();
  });

  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveView(tab.dataset.viewTab);
    });
  });

  showDetailedStatsButton?.addEventListener("click", () => {
    state.dashboardDetailsVisible = !state.dashboardDetailsVisible;
    renderDashboardDetails();
  });
}

async function loadCatalog(forceReload) {
  const academicYear = academicYearInput.value.trim();
  if (!academicYear) {
    setCatalogBanner("Add an academic year first.", "warning");
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
  renderAcademicYearOptions();
  renderActiveView();
  renderDashboardDetails();
  renderTargetSemesterOptions();
  renderSummary();
  renderExtraTermQuickAdd();
  renderRequirements();
  renderSemesters();
  renderSearchResults();
  renderModulePreview();
}

function renderDashboardDetails() {
  if (!dashboardDetailedStats || !showDetailedStatsButton) {
    return;
  }

  dashboardDetailedStats.hidden = !state.dashboardDetailsVisible;
  showDetailedStatsButton.textContent = state.dashboardDetailsVisible
    ? "Hide detailed stats"
    : "Show detailed stats";
  showDetailedStatsButton.setAttribute("aria-expanded", String(state.dashboardDetailsVisible));
}

function renderActiveView() {
  viewTabs.forEach((tab) => {
    const isActive = tab.dataset.viewTab === state.activeView;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  });

  viewPanels.forEach((panel) => {
    const isActive = panel.dataset.viewPanel === state.activeView;
    panel.hidden = !isActive;
  });
}

function setActiveView(viewName) {
  if (!["dashboard", "courses", "schedule", "requirements"].includes(viewName)) {
    return;
  }
  state.activeView = viewName;
  localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, viewName);
  renderActiveView();
}

function renderAcademicYearOptions() {
  state.plan.academicYear = normalizeAcademicYear(state.plan.academicYear);
  const options = getAcademicYearOptions(state.plan.academicYear);
  academicYearInput.innerHTML = options
    .map(
      (academicYear) =>
        `<option value="${academicYear}" ${academicYear === state.plan.academicYear ? "selected" : ""}>${academicYear}</option>`,
    )
    .join("");
  academicYearInput.value = state.plan.academicYear;
}

function renderTargetSemesterOptions() {
  const orderedSemesters = state.analytics.orderedSemesters;
  targetSemesterSelect.innerHTML = orderedSemesters
    .map(
      (semester) =>
        `<option value="${semester.id}">${escapeHtml(semester.year)} ${escapeHtml(semester.semester)}</option>`,
    )
    .join("");

  const availableIds = new Set(orderedSemesters.map((semester) => semester.id));
  if (!availableIds.has(state.targetSemesterId)) {
    state.targetSemesterId = orderedSemesters[0]?.id ?? "";
  }
  targetSemesterSelect.value = state.targetSemesterId;
}

function renderSummary() {
  const analytics = state.analytics;
  const dashboardCards = [
    {
      label: "Current CAP",
      value: formatCap(analytics.overallPostSuCap),
      note: analytics.honoursClassification,
    },
    {
      label: "Degree progress",
      value: `${analytics.totalMc} / 160 MC`,
      note: `${analytics.remainingMc} MC left`,
    },
    {
      label: "S/U left",
      value: `${analytics.suRemainingMc} MC`,
      note: `${analytics.suUsedMc} MC used`,
    },
  ];

  const detailedCards = [
    {
      label: "Pre-S/U CAP",
      value: formatCap(analytics.overallPreSuCap),
      note: `${analytics.gradedMc} graded MC`,
    },
    {
      label: "S/U budget",
      value: `${analytics.suBudgetMc} MC`,
      note: `${analytics.suRemainingMc} MC left`,
    },
    {
      label: "S/U used",
      value: `${analytics.suUsedMc} MC`,
      note: `${analytics.postSuMc} MC counted`,
    },
    {
      label: "Honours track",
      value: analytics.honoursClassification,
      note: `Post-S/U CAP ${formatCap(analytics.overallPostSuCap)}`,
    },
  ];

  summaryCards.innerHTML = dashboardCards
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

  scheduleSummaryCards.innerHTML = detailedCards
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
          <div class="year-chip-grid">
            <strong>Pre-S/U ${formatCap(year.preSuCap)}</strong>
            <strong>Post-S/U ${formatCap(year.postSuCap)}</strong>
          </div>
          <span>${formatMc(year.totalMc)}</span>
        </article>
      `,
    )
    .join("");
}

function renderExtraTermQuickAdd() {
  const totalExtras = state.plan.semesters.filter((semester) => !semester.isCore).length;
  const locationOptions = EXTRA_TERM_LOCATIONS.map(
    (location) => `<option value="${location.id}">${escapeHtml(location.label)}</option>`,
  ).join("");
  const termTypeOptions = EXTRA_TERM_TYPES.map(
    (termType) => `<option value="${termType.id}">${escapeHtml(termType.label)}</option>`,
  ).join("");
  const existingLabels = EXTRA_TERM_LOCATIONS.map((location) => {
    const count = state.plan.semesters.filter(
      (semester) => !semester.isCore && semester.year === location.year,
    ).length;
    if (!count) {
      return "";
    }
    return `<span class="optional-term-chip">${escapeHtml(location.label)}: ${count}</span>`;
  })
    .filter(Boolean)
    .join("");

  extraTermQuickAdd.innerHTML = `
    <div class="quick-add-compact">
      <label class="field compact-field">
        <span>When</span>
        <select id="extra-term-location">${locationOptions}</select>
      </label>
      <label class="field compact-field">
        <span>Type</span>
        <select id="extra-term-type">${termTypeOptions}</select>
      </label>
      <button class="btn btn-secondary quick-add-submit" id="add-extra-term" type="button">
        Add optional term
      </button>
    </div>
    <div class="quick-add-summary">
      <span>${totalExtras} optional term${totalExtras === 1 ? "" : "s"} added</span>
      <div class="optional-term-chip-row">${existingLabels || '<span class="optional-term-chip optional-term-chip-muted">No optional terms yet</span>'}</div>
    </div>
  `;

  extraTermQuickAdd.querySelector("#add-extra-term")?.addEventListener("click", () => {
    const locationId = extraTermQuickAdd.querySelector("#extra-term-location")?.value;
    const termTypeId = extraTermQuickAdd.querySelector("#extra-term-type")?.value;
    addExtraTerm(locationId, termTypeId);
  });
}

function renderRequirements() {
  requirementsEditor.innerHTML = state.analytics.requirementProgress
    .map(
      (requirement, index) => `
        <article class="requirement-card minimal-card">
          <div class="requirement-topline">
            <div>
              <strong>${escapeHtml(requirement.name)}</strong>
              <p>${requirement.completedMc} / ${requirement.requiredMc} MC</p>
            </div>
            <span>${requirement.remainingMc} MC left</span>
          </div>
          <div class="progress-strip">
            <div class="progress-fill" style="width: ${requirement.percentage}%"></div>
          </div>
          <details class="requirement-editor-toggle">
            <summary>Edit bucket</summary>
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
          </details>
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

  const groups = [];
  state.analytics.orderedSemesters.forEach((semester, semesterIndex) => {
    let group = groups.find((item) => item.year === semester.year);
    if (!group) {
      group = { year: semester.year, semesters: [] };
      groups.push(group);
    }
    group.semesters.push({ semester, semesterIndex });
  });

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "year-section";
    section.innerHTML = `
      <div class="year-section-header">
        <div>
          <p class="section-kicker">Study block</p>
          <h3>${escapeHtml(group.year)}</h3>
        </div>
      </div>
      <div class="year-section-grid"></div>
    `;

    const grid = section.querySelector(".year-section-grid");

    group.semesters.forEach(({ semester, semesterIndex }) => {
      const card = semesterTemplate.content.firstElementChild.cloneNode(true);
      const result = state.analytics.semesterResults[semesterIndex];
      card.querySelector(".semester-year").textContent = semester.isCore ? group.year : "Optional term";
      card.querySelector(".semester-name").textContent = semester.semester;
      card.querySelector(
        ".semester-cap",
      ).innerHTML = `<span>CAP ${formatCap(result.postSuCap)}</span><span class="muted-cap">Pre ${formatCap(result.preSuCap)}</span>`;
      card.querySelector(
        ".semester-meta",
      ).innerHTML = `<span>${formatMc(result.totalMc)}</span><span>${result.modules.length} module${result.modules.length === 1 ? "" : "s"}</span><span>${result.postSuMc} counted MC</span>`;
      if (!semester.isCore) {
        card.classList.add("optional-semester-card");
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "icon-button";
        removeButton.textContent = "Remove term";
        removeButton.addEventListener("click", () => removeExtraTerm(semester.id));
        card.querySelector(".semester-card-header").append(removeButton);
      }

      const rows = card.querySelector(".semester-rows");
      rows.innerHTML = result.modules.length
        ? result.modules.map((module) => createModuleRowMarkup(module, semesterIndex)).join("")
        : `<tr><td colspan="6" class="empty-row">No modules added yet.</td></tr>`;

      wireSemesterRows(card, semesterIndex);

      card.querySelector(".add-manual").addEventListener("click", () => {
        addManualModule(semester.id);
      });

      grid.append(card);
    });

    semesterGrid.append(section);
  });
}

function createModuleRowMarkup(module, semesterIndex) {
  const semester = state.analytics.orderedSemesters[semesterIndex];
  const requirementOptions = state.plan.requirements
    .map(
      (requirement) => `
        <option value="${requirement.id}" ${requirement.id === module.requirementId ? "selected" : ""}>
          ${escapeHtml(requirement.name)}
        </option>
      `,
    )
    .join("");

  const gradeOptions = GRADE_OPTIONS.map(
    (grade) =>
      `<option value="${grade}" ${grade === module.grade ? "selected" : ""}>${grade || "Ungraded"}</option>`,
  ).join("");

  const semesterResult = evaluateModule(
    { ...module, targetTermNumber: semester.termNumber ?? null },
    state.analytics.orderedSemesters,
    semesterIndex,
    semester.termNumber ?? null,
  );
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
            <span class="${availabilityClass}">${escapeHtml(semesterResult.availability.message)}</span>
            <span class="${prerequisiteClass}">${escapeHtml(semesterResult.prerequisiteCheck.summary)}</span>
          </div>
        </div>
      </td>
      <td>
        <input class="table-input short-input" type="number" min="0" step="1" data-module-credit="${module.id}" value="${module.moduleCredit}" />
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
          <input type="checkbox" data-module-su="${module.id}" ${module.useSu ? "checked" : ""} ${module.suEligible ? "" : "disabled"} />
          <span>${module.suEligible ? "Use S/U" : "Not S/U-able"}</span>
        </label>
      </td>
      <td>
        <button class="icon-button" type="button" data-module-remove="${module.id}">Remove</button>
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
          <small>Offered in ${escapeHtml(formatOfferedSemesters(item.semesters))}</small>
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
  const targetSemester = state.analytics.orderedSemesters.find(
    (semester) => semester.id === state.targetSemesterId,
  );
  const targetIndex = state.analytics.orderedSemesters.findIndex(
    (semester) => semester.id === state.targetSemesterId,
  );
  const evaluation = evaluateModule(
    { ...draftModule, targetTermNumber: targetSemester?.termNumber ?? null },
    state.analytics.orderedSemesters,
    targetIndex,
    targetSemester?.termNumber ?? null,
  );
  const requirementOptions = state.plan.requirements
    .map(
      (requirement) => `
        <option value="${requirement.id}" ${requirement.id === requirementId ? "selected" : ""}>
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
        <span>Offered terms: ${escapeHtml(formatOfferedSemesters(draftModule.offeredSemesters) || "Unknown")}</span>
      </article>
      <article class="preview-card">
        <p>S/U</p>
        <strong>${draftModule.suEligible ? "S/U eligible" : "Not S/U eligible"}</strong>
        <span>Source AY: ${escapeHtml(draftModule.sourceAcademicYear || state.plan.academicYear)}</span>
      </article>
      <article class="preview-card">
        <p>Prerequisites</p>
        <strong>${escapeHtml(evaluation.prerequisiteCheck.summary)}</strong>
        <span>${escapeHtml(state.selectedModuleDetails.prerequisite || "No prerequisite text listed")}</span>
      </article>
    </div>
    <div class="field-row">
      <label class="field">
        <span>Map to requirement</span>
        <select id="preview-requirement">${requirementOptions}</select>
      </label>
      <button id="add-selected-module" class="btn btn-primary" type="button">
        Add to ${escapeHtml(targetSemester?.year ?? "")} ${escapeHtml(targetSemester?.semester ?? "")}
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
  const targetSemester = state.plan.semesters.find((semester) => semester.id === state.targetSemesterId);
  if (!targetSemester) {
    return;
  }

  const newModule = normalizeModuleForPlan(
    state.selectedModuleDetails,
    state.selectedModuleCatalogEntry,
    requirementId,
  );
  newModule.targetTermNumber = targetSemester.termNumber ?? null;
  targetSemester.modules.push(newModule);
  savePlan();
  render();
  saveStatus.textContent = `${newModule.moduleCode} added to ${targetSemester.year} ${targetSemester.semester}.`;
}

function addManualModule(semesterId) {
  const semester = state.plan.semesters.find((item) => item.id === semesterId);
  if (!semester) {
    return;
  }
  semester.modules.push({
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
    offeredSemesters: semester.termNumber ? [semester.termNumber] : [],
    targetTermNumber: semester.termNumber ?? null,
    semesterData: [],
    sourceAcademicYear: state.plan.academicYear,
  });
  savePlan();
  render();
}

function updateModule(semesterIndex, moduleId, updater) {
  const semesterId = state.analytics.orderedSemesters[semesterIndex]?.id;
  const module = state.plan.semesters
    .find((item) => item.id === semesterId)
    ?.modules.find((item) => item.id === moduleId);
  if (!module) {
    return;
  }
  updater(module);
  savePlan();
  render();
}

function removeModule(semesterIndex, moduleId) {
  const semesterId = state.analytics.orderedSemesters[semesterIndex]?.id;
  const semester = state.plan.semesters.find((item) => item.id === semesterId);
  if (!semester) {
    return;
  }
  semester.modules = semester.modules.filter((module) => module.id !== moduleId);
  savePlan();
  render();
}

function addExtraTerm(locationId, termTypeId) {
  const location = EXTRA_TERM_LOCATIONS.find((item) => item.id === locationId);
  const termType = EXTRA_TERM_TYPES.find((item) => item.id === termTypeId);
  if (!location || !termType) {
    return;
  }
  const siblingOrders = state.plan.semesters
    .filter((semester) => !semester.isCore && semester.year === location.year)
    .map((semester) => semester.order ?? 0);
  const nextOffset = siblingOrders.length
    ? Math.max(...siblingOrders) - location.baseOrder + 1
    : 1;

  state.plan.semesters.push({
    id: crypto.randomUUID(),
    year: location.year,
    semester: termType.label,
    order: location.baseOrder + nextOffset,
    termNumber: termType.termNumber,
    isCore: false,
    modules: [],
  });
  savePlan();
  render();
}

function removeExtraTerm(semesterId) {
  const semester = state.plan.semesters.find((item) => item.id === semesterId);
  if (!semester || semester.isCore) {
    return;
  }
  const confirmed = window.confirm(`Remove ${semester.year} ${semester.semester}?`);
  if (!confirmed) {
    return;
  }
  state.plan.semesters = state.plan.semesters.filter((item) => item.id !== semesterId);
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
  suBudgetInput.value = state.plan.suBudgetMc ?? 32;
  savePlan();
  render();
}

function savePlan() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plan));
  state.analytics = calculatePlan(state.plan);
  suBudgetInput.value = state.plan.suBudgetMc ?? 32;
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
    const safeRequirements = Array.isArray(parsed.requirements)
      ? parsed.requirements
          .filter((item) => item && typeof item === "object")
          .map((item, index) => ({
            id: typeof item.id === "string" && item.id ? item.id : fresh.requirements[index]?.id ?? `custom-${index}`,
            name: typeof item.name === "string" && item.name.trim() ? item.name : fresh.requirements[index]?.name ?? `Requirement ${index + 1}`,
            requiredMc: Number.isFinite(Number(item.requiredMc)) ? Number(item.requiredMc) : fresh.requirements[index]?.requiredMc ?? 0,
          }))
      : fresh.requirements;

    const safeSemesters = Array.isArray(parsed.semesters)
      ? parsed.semesters
          .filter((semester) => semester && typeof semester === "object")
          .map((semester, index) => ({
            id: typeof semester.id === "string" && semester.id ? semester.id : crypto.randomUUID(),
            year: typeof semester.year === "string" && semester.year.trim() ? semester.year : fresh.semesters[index]?.year ?? `Year ${Math.floor(index / 2) + 1}`,
            semester: typeof semester.semester === "string" && semester.semester.trim() ? semester.semester : fresh.semesters[index]?.semester ?? `Semester ${(index % 2) + 1}`,
            order: typeof semester.order === "number" ? semester.order : fresh.semesters[index]?.order ?? (index + 1) * 10,
            termNumber: semester.termNumber !== undefined && semester.termNumber !== null && Number.isFinite(Number(semester.termNumber)) ? Number(semester.termNumber) : fresh.semesters[index]?.termNumber ?? null,
            isCore: typeof semester.isCore === "boolean" ? semester.isCore : index < 8,
            modules: Array.isArray(semester.modules)
              ? semester.modules
                  .filter((module) => module && typeof module === "object")
                  .map((module) => ({
                    id: typeof module.id === "string" && module.id ? module.id : crypto.randomUUID(),
                    moduleCode: typeof module.moduleCode === "string" ? module.moduleCode : "",
                    title: typeof module.title === "string" ? module.title : "Custom module",
                    moduleCredit: Number.isFinite(Number(module.moduleCredit)) ? Number(module.moduleCredit) : 0,
                    grade: typeof module.grade === "string" ? module.grade : "",
                    suEligible: Boolean(module.suEligible),
                    useSu: Boolean(module.useSu),
                    requirementId: typeof module.requirementId === "string" ? module.requirementId : "custom",
                    prerequisite: typeof module.prerequisite === "string" ? module.prerequisite : "",
                    prerequisiteRule: typeof module.prerequisiteRule === "string" ? module.prerequisiteRule : "",
                    offeredSemesters: Array.isArray(module.offeredSemesters) ? module.offeredSemesters.filter((value) => Number.isFinite(Number(value))).map(Number) : [],
                    targetTermNumber: module.targetTermNumber !== undefined && module.targetTermNumber !== null && Number.isFinite(Number(module.targetTermNumber)) ? Number(module.targetTermNumber) : null,
                    semesterData: Array.isArray(module.semesterData) ? module.semesterData : [],
                    sourceAcademicYear: typeof module.sourceAcademicYear === "string" ? module.sourceAcademicYear : null,
                  }))
              : [],
          }))
      : fresh.semesters;

    return {
      ...fresh,
      academicYear: normalizeAcademicYear(parsed.academicYear ?? fresh.academicYear),
      suBudgetMc: Number.isFinite(Number(parsed.suBudgetMc)) ? Number(parsed.suBudgetMc) : fresh.suBudgetMc,
      requirements: safeRequirements.length ? safeRequirements : fresh.requirements,
      semesters: safeSemesters.length ? safeSemesters : fresh.semesters,
    };
  } catch {
    return createEmptyPlan();
  }
}

function loadActiveView() {
  const stored = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  return ["dashboard", "courses", "schedule", "requirements"].includes(stored)
    ? stored
    : "dashboard";
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
