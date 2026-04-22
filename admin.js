const state = {
  authenticated: false,
  csrfToken: "",
  jobProfiles: [],
  selectedProfileId: "",
  answers: {},
  configUpdatedAt: "",
  messages: [],
  atsScore: null
};

const DRAFT_STORAGE_KEY = "portfolio_admin_resume_draft_v1";

const dom = {
  loginPanel: document.querySelector("#login-panel"),
  loginForm: document.querySelector("#login-form"),
  loginStatus: document.querySelector("#login-status"),
  passwordInput: document.querySelector("#admin-password"),
  sessionWarning: document.querySelector("#session-warning"),
  logoutButton: document.querySelector("#logout-btn"),
  studioPanel: document.querySelector("#studio-panel"),
  profileSelect: document.querySelector("#profile-select"),
  profileObjective: document.querySelector("#profile-objective"),
  keywordChipWrap: document.querySelector("#keyword-chip-wrap"),
  answersForm: document.querySelector("#answers-form"),
  actionStatus: document.querySelector("#action-status"),
  configMeta: document.querySelector("#config-meta"),
  draftMeta: document.querySelector("#draft-meta"),
  previewButton: document.querySelector("#preview-btn"),
  saveButton: document.querySelector("#save-btn"),
  syncButton: document.querySelector("#sync-btn"),
  copyKeywordsButton: document.querySelector("#copy-keywords-btn"),
  resetAnswersButton: document.querySelector("#reset-answers-btn"),
  completionScore: document.querySelector("#completion-score"),
  atsScore: document.querySelector("#ats-score"),
  previewCard: document.querySelector("#preview-card"),
  viewResumeLink: document.querySelector("#view-resume-link"),
  downloadResumeTxtLink: document.querySelector("#download-resume-txt-link"),
  downloadResumeHtmlLink: document.querySelector("#download-resume-html-link"),
  refreshMessagesButton: document.querySelector("#refresh-messages-btn"),
  messagesStatus: document.querySelector("#messages-status"),
  messagesList: document.querySelector("#messages-list")
};

function setStatus(node, message, type = "") {
  if (!node) {
    return;
  }

  node.className = "status";
  if (type) {
    node.classList.add(type);
  }
  node.textContent = message;
}

function clearNode(node) {
  if (!node) {
    return;
  }

  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function safeText(value) {
  return String(value || "").trim();
}

function readableDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCurrentProfile() {
  return state.jobProfiles.find((profile) => profile.id === state.selectedProfileId) || null;
}

function sanitizeAnswersForProfile(profile, answers) {
  const nextAnswers = {};

  if (!profile || !Array.isArray(profile.questionSet)) {
    return nextAnswers;
  }

  profile.questionSet.forEach((question) => {
    const value = safeText(answers[question.id]);
    if (value) {
      nextAnswers[question.id] = value;
    }
  });

  return nextAnswers;
}

function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveDraft() {
  const payload = {
    selectedProfileId: state.selectedProfileId,
    answers: state.answers,
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    if (dom.draftMeta) {
      dom.draftMeta.textContent = `Draft auto-saved at ${readableDateTime(payload.savedAt)}.`;
    }
  } catch {
    // Ignore localStorage failures and keep admin flow functional.
  }
}

function updateHealthIndicators() {
  const profile = getCurrentProfile();
  const questions = profile && Array.isArray(profile.questionSet) ? profile.questionSet : [];
  const total = questions.length;
  const answered = questions.reduce((count, question) => {
    return safeText(state.answers[question.id]) ? count + 1 : count;
  }, 0);
  const completionPercent = total > 0 ? Math.round((answered / total) * 100) : 100;

  if (dom.completionScore) {
    dom.completionScore.textContent = `${completionPercent}%`;
  }

  if (dom.atsScore) {
    dom.atsScore.textContent = typeof state.atsScore === "number" ? `${state.atsScore}%` : "--";
  }
}

function buildProfileQuery(profileId) {
  const safeId = safeText(profileId);
  return safeId ? `?profileId=${encodeURIComponent(safeId)}` : "";
}

function updateDownloadLinks() {
  const query = buildProfileQuery(state.selectedProfileId);

  if (dom.viewResumeLink) {
    dom.viewResumeLink.href = `/resume${query}`;
  }
  if (dom.downloadResumeTxtLink) {
    dom.downloadResumeTxtLink.href = `/api/resume/download${query ? `${query}&format=txt` : "?format=txt"}`;
  }
  if (dom.downloadResumeHtmlLink) {
    dom.downloadResumeHtmlLink.href = `/api/resume/download${query ? `${query}&format=html` : "?format=html"}`;
  }
}

function renderKeywordChips(profile) {
  clearNode(dom.keywordChipWrap);

  const keywords = profile && Array.isArray(profile.keywordTargets)
    ? profile.keywordTargets
    : [];

  keywords.forEach((keyword) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = keyword;
    dom.keywordChipWrap.appendChild(chip);
  });
}

function renderQuestionFields(profile) {
  clearNode(dom.answersForm);

  const questions = profile && Array.isArray(profile.questionSet)
    ? profile.questionSet
    : [];

  if (questions.length === 0) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "No additional questions configured for this profile.";
    dom.answersForm.appendChild(note);
    return;
  }

  questions.forEach((question) => {
    const wrapper = document.createElement("article");
    wrapper.className = "answer-field";
    wrapper.dataset.questionId = question.id;

    const label = document.createElement("label");
    label.setAttribute("for", `answer-${question.id}`);
    label.textContent = question.required ? `${question.label} *` : question.label;

    let input;
    if (question.type === "select") {
      input = document.createElement("select");
      input.innerHTML = "";

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Select an option";
      input.appendChild(empty);

      (Array.isArray(question.options) ? question.options : []).forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        input.appendChild(option);
      });
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.maxLength = Number(question.maxLength) || 220;
      input.placeholder = "Enter your answer";
    }

    input.id = `answer-${question.id}`;
    input.name = question.id;
    input.required = Boolean(question.required);
    input.value = safeText(state.answers[question.id]);

    input.addEventListener("input", () => {
      const value = safeText(input.value);
      if (value) {
        state.answers[question.id] = value;
      } else {
        delete state.answers[question.id];
      }
      saveDraft();
      updateHealthIndicators();

      const errorNode = wrapper.querySelector(".field-error");
      if (errorNode) {
        errorNode.textContent = "";
      }
    });

    const meta = document.createElement("p");
    meta.className = "field-meta";
    meta.textContent = question.type === "select"
      ? "Answer is validated against predefined options."
      : `Max length: ${Number(question.maxLength) || 220} characters.`;

    const fieldError = document.createElement("p");
    fieldError.className = "field-error";
    fieldError.dataset.errorFor = question.id;

    label.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(meta);
    wrapper.appendChild(fieldError);
    dom.answersForm.appendChild(wrapper);
  });
}

function renderProfileSummary() {
  const profile = getCurrentProfile();

  if (!profile) {
    if (dom.profileObjective) {
      dom.profileObjective.textContent = "No profile selected.";
    }
    renderKeywordChips(null);
    renderQuestionFields(null);
    updateDownloadLinks();
    return;
  }

  if (dom.profileObjective) {
    dom.profileObjective.textContent = profile.objective || "";
  }

  renderKeywordChips(profile);
  renderQuestionFields(profile);
  updateDownloadLinks();
  updateHealthIndicators();
}

function renderProfileOptions() {
  clearNode(dom.profileSelect);

  state.jobProfiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.title;
    dom.profileSelect.appendChild(option);
  });

  if (!state.selectedProfileId && state.jobProfiles[0]) {
    state.selectedProfileId = state.jobProfiles[0].id;
  }

  if (dom.profileSelect && state.selectedProfileId) {
    dom.profileSelect.value = state.selectedProfileId;
  }

  renderProfileSummary();
}

function renderConfigMeta() {
  if (!dom.configMeta) {
    return;
  }

  const profile = getCurrentProfile();
  const profileLabel = profile ? profile.title : "Unknown";
  const updated = state.configUpdatedAt ? readableDateTime(state.configUpdatedAt) : "Unknown";

  dom.configMeta.textContent = `Current saved profile: ${profileLabel}. Last saved at: ${updated}.`;
}

function collectPayload() {
  const profile = getCurrentProfile();
  const answers = sanitizeAnswersForProfile(profile, state.answers);

  return {
    profileId: state.selectedProfileId,
    answers
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.details = data;
    throw error;
  }

  return data;
}

function setAuthenticatedUi(authenticated) {
  state.authenticated = authenticated;

  if (dom.loginPanel) {
    dom.loginPanel.hidden = authenticated;
  }
  if (dom.studioPanel) {
    dom.studioPanel.hidden = !authenticated;
  }
  if (dom.logoutButton) {
    dom.logoutButton.hidden = !authenticated;
  }
}

function applyFieldErrors(fields) {
  if (!fields || typeof fields !== "object") {
    return;
  }

  Object.entries(fields).forEach(([key, message]) => {
    const node = dom.answersForm.querySelector(`[data-error-for="${key}"]`);
    if (node) {
      node.textContent = safeText(message);
    }
  });
}

async function loadJobProfiles() {
  state.jobProfiles = await fetchJson("/api/admin/job-profiles");
}

async function loadResumeConfig() {
  const config = await fetchJson("/api/admin/resume-config");

  state.selectedProfileId = safeText(config.selectedProfileId);
  state.configUpdatedAt = safeText(config.updatedAt);
  state.answers = config.answers && typeof config.answers === "object" ? { ...config.answers } : {};
  state.atsScore = null;
}

function renderMessages(messages) {
  clearNode(dom.messagesList);

  if (!Array.isArray(messages) || messages.length === 0) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "No messages received yet.";
    dom.messagesList.appendChild(note);
    return;
  }

  messages.slice(0, 60).forEach((message) => {
    const card = document.createElement("article");
    card.className = "message-item";

    const title = document.createElement("h4");
    title.textContent = safeText(message.name) || "Unknown sender";

    const email = document.createElement("p");
    email.innerHTML = `<a href="mailto:${encodeURIComponent(safeText(message.email))}">${safeText(message.email)}</a>`;

    const meta = document.createElement("p");
    meta.className = "message-meta";
    meta.textContent = `Submitted: ${readableDateTime(message.submittedAt)} • ID: ${safeText(message.id)}`;

    const body = document.createElement("p");
    body.className = "message-body";
    body.textContent = safeText(message.message);

    card.appendChild(title);
    card.appendChild(email);
    card.appendChild(meta);
    card.appendChild(body);
    dom.messagesList.appendChild(card);
  });
}

async function loadMessages() {
  setStatus(dom.messagesStatus, "Loading messages...");
  try {
    state.messages = await fetchJson("/api/admin/messages");
    renderMessages(state.messages);
    setStatus(dom.messagesStatus, `Loaded ${state.messages.length} messages.`, "success");
  } catch (error) {
    setStatus(dom.messagesStatus, error.message || "Unable to load messages.", "error");
  }
}

function createPreviewSection(title) {
  const section = document.createElement("section");
  section.className = "preview-section";

  const heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);

  return section;
}

function renderPreview(resume, analysis) {
  clearNode(dom.previewCard);
  dom.previewCard.classList.remove("empty");

  if (!resume || typeof resume !== "object") {
    dom.previewCard.classList.add("empty");
    const text = document.createElement("p");
    text.className = "empty-text";
    text.textContent = "Preview is not available yet.";
    dom.previewCard.appendChild(text);
    return;
  }

  const head = document.createElement("div");
  head.className = "preview-head";

  const title = document.createElement("h3");
  title.textContent = `${safeText(resume.contact && resume.contact.name)} | ${safeText(resume.targetRole)}`;

  const summary = document.createElement("p");
  summary.textContent = safeText(resume.summary);

  head.appendChild(title);
  head.appendChild(summary);
  dom.previewCard.appendChild(head);

  const strengthsSection = createPreviewSection("Core Strengths");
  const strengthsList = document.createElement("div");
  strengthsList.className = "preview-list";
  (Array.isArray(resume.strengths) ? resume.strengths : []).slice(0, 6).forEach((item) => {
    const card = document.createElement("article");
    card.className = "preview-list-item";
    const text = document.createElement("p");
    text.textContent = safeText(item);
    card.appendChild(text);
    strengthsList.appendChild(card);
  });
  strengthsSection.appendChild(strengthsList);
  dom.previewCard.appendChild(strengthsSection);

  const skillsSection = createPreviewSection("Skills");
  const skillsWrap = document.createElement("div");
  skillsWrap.className = "chip-wrap";
  (Array.isArray(resume.skills) ? resume.skills : []).slice(0, 16).forEach((skill) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = safeText(skill);
    skillsWrap.appendChild(chip);
  });
  skillsSection.appendChild(skillsWrap);
  dom.previewCard.appendChild(skillsSection);

  const projectSection = createPreviewSection("Selected Projects");
  const projectList = document.createElement("div");
  projectList.className = "preview-list";

  (Array.isArray(resume.projects) ? resume.projects : []).slice(0, 5).forEach((project) => {
    const item = document.createElement("article");
    item.className = "preview-list-item";

    const h = document.createElement("p");
    h.textContent = safeText(project.name);
    h.style.fontWeight = "700";

    const p1 = document.createElement("p");
    p1.textContent = safeText(project.summary);

    const p2 = document.createElement("p");
    p2.textContent = `Stack: ${(Array.isArray(project.stack) ? project.stack : []).join(", ")}`;

    item.appendChild(h);
    item.appendChild(p1);
    item.appendChild(p2);
    projectList.appendChild(item);
  });

  projectSection.appendChild(projectList);
  dom.previewCard.appendChild(projectSection);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = safeText(resume.complianceNote);
  dom.previewCard.appendChild(note);

  if (analysis && typeof analysis === "object") {
    state.atsScore = Number(analysis.score) || 0;
    updateHealthIndicators();
    const analysisSection = createPreviewSection("ATS Analysis");
    const score = document.createElement("p");
    score.textContent = `Match score: ${Number(analysis.score) || 0}%`;
    analysisSection.appendChild(score);

    const missing = document.createElement("p");
    const missingKeywords = Array.isArray(analysis.missingKeywords) ? analysis.missingKeywords.slice(0, 6) : [];
    missing.textContent = missingKeywords.length > 0
      ? `Missing keywords to consider (truthfully): ${missingKeywords.join(", ")}`
      : "No major keyword gaps found for this profile.";
    analysisSection.appendChild(missing);

    const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations.slice(0, 4) : [];
    if (recommendations.length > 0) {
      const list = document.createElement("ul");
      recommendations.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = safeText(item);
        list.appendChild(li);
      });
      analysisSection.appendChild(list);
    }

    dom.previewCard.appendChild(analysisSection);
  }
}

async function loadStudioData() {
  setStatus(dom.actionStatus, "Loading admin studio...");

  await Promise.all([loadJobProfiles(), loadResumeConfig()]);

  const selectedProfile = state.jobProfiles.find((profile) => profile.id === state.selectedProfileId);
  if (!selectedProfile && state.jobProfiles[0]) {
    state.selectedProfileId = state.jobProfiles[0].id;
    state.answers = {};
  } else {
    state.answers = sanitizeAnswersForProfile(selectedProfile, state.answers);
  }

  const draft = getDraft();
  if (draft && safeText(draft.selectedProfileId) === state.selectedProfileId) {
    const profileForDraft = state.jobProfiles.find((profile) => profile.id === state.selectedProfileId);
    state.answers = sanitizeAnswersForProfile(profileForDraft, draft.answers || {});
    if (dom.draftMeta) {
      dom.draftMeta.textContent = `Recovered local draft from ${readableDateTime(draft.savedAt)}.`;
    }
  } else if (dom.draftMeta) {
    dom.draftMeta.textContent = "";
  }

  renderProfileOptions();
  renderConfigMeta();
  await loadMessages();
  setStatus(dom.actionStatus, "Admin studio is ready.", "success");
}

async function checkSession() {
  const session = await fetchJson("/api/admin/session");

  if (!session.authenticated) {
    setAuthenticatedUi(false);
    state.csrfToken = "";
    return;
  }

  state.csrfToken = safeText(session.csrfToken);
  setAuthenticatedUi(true);

  if (dom.sessionWarning) {
    dom.sessionWarning.hidden = !session.requirePasswordRotation;
  }

  await loadStudioData();
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const password = safeText(dom.passwordInput.value);
  if (!password) {
    setStatus(dom.loginStatus, "Please enter admin password.", "error");
    return;
  }

  setStatus(dom.loginStatus, "Authenticating...");

  try {
    const result = await fetchJson("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    state.csrfToken = safeText(result.csrfToken);
    if (dom.sessionWarning) {
      dom.sessionWarning.hidden = !result.requirePasswordRotation;
    }

    dom.passwordInput.value = "";
    setStatus(dom.loginStatus, result.message || "Authenticated.", "success");
    setAuthenticatedUi(true);
    await loadStudioData();
  } catch (error) {
    setStatus(dom.loginStatus, error.message || "Authentication failed.", "error");
  }
}

async function handleLogout() {
  try {
    await fetchJson("/api/admin/logout", {
      method: "POST",
      headers: {
        "x-csrf-token": state.csrfToken
      }
    });
  } catch {
    // Intentionally ignore logout errors to always clear local state.
  }

  state.csrfToken = "";
  state.selectedProfileId = "";
  state.answers = {};
  state.jobProfiles = [];
  state.messages = [];

  setAuthenticatedUi(false);
  if (dom.sessionWarning) {
    dom.sessionWarning.hidden = true;
  }
  setStatus(dom.actionStatus, "");
  setStatus(dom.messagesStatus, "");
  setStatus(dom.loginStatus, "Logged out.", "success");
  renderMessages([]);
  clearNode(dom.previewCard);
  dom.previewCard.classList.add("empty");

  const text = document.createElement("p");
  text.className = "empty-text";
  text.textContent = "Generate a preview to inspect summary, strengths, skills, and project selection.";
  dom.previewCard.appendChild(text);
}

function updateProfileSelection(newProfileId) {
  const next = safeText(newProfileId);
  const profile = state.jobProfiles.find((entry) => entry.id === next);

  if (!profile) {
    return;
  }

  state.selectedProfileId = profile.id;
  state.answers = sanitizeAnswersForProfile(profile, {});
  state.atsScore = null;
  saveDraft();
  renderProfileSummary();
  setStatus(dom.actionStatus, "Profile switched. Update answers, then preview or save.");
}

async function handlePreview() {
  setStatus(dom.actionStatus, "Generating preview...");

  const payload = collectPayload();

  try {
    const result = await fetchJson("/api/admin/resume-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": state.csrfToken
      },
      body: JSON.stringify(payload)
    });

    renderPreview(result.resume, result.analysis);
    setStatus(dom.actionStatus, "Preview generated.", "success");
  } catch (error) {
    applyFieldErrors(error.details && error.details.fields);
    setStatus(dom.actionStatus, error.message || "Preview failed.", "error");
  }
}

async function handleSave() {
  setStatus(dom.actionStatus, "Saving configuration...");

  const payload = collectPayload();

  try {
    const result = await fetchJson("/api/admin/resume-config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": state.csrfToken
      },
      body: JSON.stringify(payload)
    });

    state.configUpdatedAt = safeText(result.config && result.config.updatedAt);
    saveDraft();
    renderConfigMeta();
    updateDownloadLinks();
    updateHealthIndicators();
    setStatus(dom.actionStatus, result.message || "Configuration saved.", "success");
  } catch (error) {
    applyFieldErrors(error.details && error.details.fields);
    setStatus(dom.actionStatus, error.message || "Save failed.", "error");
  }
}

async function handleSync() {
  setStatus(dom.actionStatus, "Running live sync...");

  try {
    const result = await fetchJson("/api/admin/sync", {
      method: "POST",
      headers: {
        "x-csrf-token": state.csrfToken
      }
    });

    setStatus(dom.actionStatus, `${result.message || "Data sync completed."} (${readableDateTime(result.syncedAt)})`, "success");
  } catch (error) {
    setStatus(dom.actionStatus, error.message || "Sync failed.", "error");
  }
}

function wireEvents() {
  dom.loginForm.addEventListener("submit", handleLoginSubmit);

  dom.logoutButton.addEventListener("click", () => {
    handleLogout().catch(() => {
      setStatus(dom.loginStatus, "Logout encountered an issue.", "error");
    });
  });

  dom.profileSelect.addEventListener("change", () => {
    updateProfileSelection(dom.profileSelect.value);
  });

  dom.copyKeywordsButton.addEventListener("click", async () => {
    const profile = getCurrentProfile();
    const keywords = profile && Array.isArray(profile.keywordTargets) ? profile.keywordTargets : [];
    if (keywords.length === 0) {
      setStatus(dom.actionStatus, "No keywords available for this profile.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(keywords.join(", "));
      setStatus(dom.actionStatus, "ATS keywords copied to clipboard.", "success");
    } catch {
      setStatus(dom.actionStatus, "Could not copy keywords in this browser.", "error");
    }
  });

  dom.resetAnswersButton.addEventListener("click", () => {
    const profile = getCurrentProfile();
    state.answers = sanitizeAnswersForProfile(profile, {});
    state.atsScore = null;
    saveDraft();
    renderQuestionFields(profile);
    updateHealthIndicators();
    setStatus(dom.actionStatus, "Answers reset for current profile.", "success");
  });

  dom.previewButton.addEventListener("click", () => {
    handlePreview().catch((error) => {
      setStatus(dom.actionStatus, error.message || "Preview failed.", "error");
    });
  });

  dom.saveButton.addEventListener("click", () => {
    handleSave().catch((error) => {
      setStatus(dom.actionStatus, error.message || "Save failed.", "error");
    });
  });

  dom.syncButton.addEventListener("click", () => {
    handleSync().catch((error) => {
      setStatus(dom.actionStatus, error.message || "Sync failed.", "error");
    });
  });

  dom.refreshMessagesButton.addEventListener("click", () => {
    loadMessages().catch((error) => {
      setStatus(dom.messagesStatus, error.message || "Could not refresh messages.", "error");
    });
  });
}

async function init() {
  wireEvents();
  updateDownloadLinks();
  updateHealthIndicators();

  try {
    await checkSession();
  } catch (error) {
    setAuthenticatedUi(false);
    setStatus(dom.loginStatus, error.message || "Unable to check admin session.", "error");
  }
}

init();
