const dom = {
  heroName: document.querySelector("#hero-name"),
  heroRole: document.querySelector("#hero-role"),
  heroHeadline: document.querySelector("#hero-headline"),
  heroIntro: document.querySelector("#hero-intro"),
  heroAvailability: document.querySelector("#hero-availability"),
  highlightList: document.querySelector("#highlight-list"),
  capabilityGrid: document.querySelector("#capability-grid"),
  projectGrid: document.querySelector("#project-grid"),
  accountGrid: document.querySelector("#account-grid"),
  languageCloud: document.querySelector("#language-cloud"),
  architectureGrid: document.querySelector("#architecture-grid"),
  servicesList: document.querySelector("#services-list"),
  timelineList: document.querySelector("#timeline-list"),
  educationList: document.querySelector("#education-list"),
  interestList: document.querySelector("#interest-list"),
  roleFitGrid: document.querySelector("#role-fit-grid"),
  syncStatusText: document.querySelector("#sync-status-text"),
  linkedinStatusText: document.querySelector("#linkedin-status-text"),
  securityList: document.querySelector("#security-list"),
  statRepos: document.querySelector("#stat-repos"),
  statProjects: document.querySelector("#stat-projects"),
  statLanguages: document.querySelector("#stat-languages"),
  statLocation: document.querySelector("#stat-location"),
  emailLink: document.querySelector("#email-link"),
  linkedinLink: document.querySelector("#linkedin-link"),
  githubPrimaryLink: document.querySelector("#github-primary-link"),
  githubSecondaryLink: document.querySelector("#github-secondary-link"),
  resumeViewLink: document.querySelector("#resume-view-link"),
  resumeDownloadLink: document.querySelector("#resume-download-link"),
  resumeViewLink2: document.querySelector("#resume-view-link-2"),
  resumeDownloadLink2: document.querySelector("#resume-download-link-2"),
  resumeDownloadHtmlLink: document.querySelector("#resume-download-html-link"),
  publicProfileSelect: document.querySelector("#public-profile-select"),
  publicAtsScore: document.querySelector("#public-ats-score"),
  publicAtsMissing: document.querySelector("#public-ats-missing"),
  adminStudioLink: document.querySelector("#admin-studio-link"),
  contactForm: document.querySelector("#contact-form"),
  formStatus: document.querySelector("#form-status"),
  footerText: document.querySelector("#footer-text")
};

function clearElement(node) {
  if (!node) {
    return;
  }

  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function setText(node, value, fallback = "") {
  if (!node) {
    return;
  }

  node.textContent = value || fallback;
}

function setStatus(message, type) {
  if (!dom.formStatus) {
    return;
  }

  dom.formStatus.className = "status";
  if (type) {
    dom.formStatus.classList.add(type);
  }

  dom.formStatus.textContent = message;
}

function createChip(label, className = "chip") {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = label;
  return node;
}

function setExternalLink(node, url, fallbackLabel) {
  if (!node || !url) {
    return;
  }

  node.href = url;

  if (fallbackLabel) {
    node.textContent = fallbackLabel;
  }
}

function toReadableDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function toReadableDateTime(value) {
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

function animateCounter(node, value, duration = 1200) {
  if (!node) {
    return;
  }

  const target = Number(value);
  if (!Number.isFinite(target)) {
    node.textContent = String(value || "0");
    return;
  }

  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    node.textContent = String(current);

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function createLabeledParagraph(label, text, className) {
  const paragraph = document.createElement("p");
  if (className) {
    paragraph.className = className;
  }

  const strong = document.createElement("strong");
  strong.textContent = `${label}:`;
  paragraph.appendChild(strong);
  paragraph.append(` ${text}`);

  return paragraph;
}

function updateResumeLinks(profileId) {
  const encodedProfile = encodeURIComponent(profileId || "");
  const suffix = encodedProfile ? `?profileId=${encodedProfile}` : "";
  const txtSuffix = encodedProfile ? `?format=txt&profileId=${encodedProfile}` : "?format=txt";
  const htmlSuffix = encodedProfile ? `?format=html&profileId=${encodedProfile}` : "?format=html";

  const viewUrl = `/resume${suffix}`;
  const downloadTxtUrl = `/api/resume/download${txtSuffix}`;
  const downloadHtmlUrl = `/api/resume/download${htmlSuffix}`;

  [dom.resumeViewLink, dom.resumeViewLink2].forEach((node) => {
    if (node) {
      node.href = viewUrl;
    }
  });

  [dom.resumeDownloadLink, dom.resumeDownloadLink2].forEach((node) => {
    if (node) {
      node.href = downloadTxtUrl;
    }
  });

  if (dom.resumeDownloadHtmlLink) {
    dom.resumeDownloadHtmlLink.href = downloadHtmlUrl;
  }
}

function setAtsInsight(analysis) {
  if (!dom.publicAtsScore || !dom.publicAtsMissing) {
    return;
  }

  if (!analysis || typeof analysis !== "object") {
    dom.publicAtsScore.textContent = "ATS match score: --";
    dom.publicAtsMissing.textContent = "";
    return;
  }

  dom.publicAtsScore.textContent = `ATS match score: ${Number(analysis.score) || 0}%`;
  const missing = Array.isArray(analysis.missingKeywords) ? analysis.missingKeywords.slice(0, 5) : [];
  dom.publicAtsMissing.textContent = missing.length > 0
    ? `Possible missing keywords: ${missing.join(", ")}`
    : "Great coverage for this profile based on verified portfolio data.";
}

async function loadResumeAnalysis(profileId) {
  try {
    const suffix = profileId ? `?profileId=${encodeURIComponent(profileId)}` : "";
    const response = await fetch(`/api/resume/analysis${suffix}`);
    if (!response.ok) {
      throw new Error("Could not load ATS analysis.");
    }

    const result = await response.json();
    setAtsInsight(result.analysis);
  } catch {
    setAtsInsight(null);
  }
}

function renderHero(showcase) {
  const profile = showcase.profile || {};
  const positioning = showcase.positioning || {};

  setText(dom.heroName, profile.name, "Portfolio");
  setText(dom.heroRole, profile.role, "ML Engineer");
  setText(dom.heroHeadline, profile.headline, "Building useful software products with end-to-end ownership.");
  setText(dom.heroIntro, positioning.intro, "Problem-first development with practical architecture and fast delivery.");
  setText(dom.heroAvailability, profile.availability, "");

  if (profile.email) {
    setExternalLink(dom.emailLink, `mailto:${profile.email}`);
  }

  setExternalLink(dom.linkedinLink, profile.linkedin || "");
  setExternalLink(dom.githubPrimaryLink, profile.githubPrimary || "");
  setExternalLink(dom.githubSecondaryLink, profile.githubSecondary || "");

  if (dom.adminStudioLink) {
    dom.adminStudioLink.href = "/admin";
  }

  clearElement(dom.highlightList);
  const highlights = Array.isArray(showcase.highlights) ? showcase.highlights : [];

  highlights.slice(0, 4).forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    dom.highlightList.appendChild(entry);
  });
}

function renderMetrics(showcase) {
  const github = showcase.github || {};
  const combined = github.combined || {};
  const projects = Array.isArray(showcase.featuredProjects) ? showcase.featuredProjects : [];
  const profile = showcase.profile || {};

  animateCounter(dom.statRepos, combined.repoCount || 0);
  animateCounter(dom.statProjects, projects.length);
  animateCounter(dom.statLanguages, Array.isArray(combined.languages) ? combined.languages.length : 0);
  setText(dom.statLocation, profile.location, "Remote");
}

function renderRoleFits(roleFits) {
  clearElement(dom.roleFitGrid);

  if (!Array.isArray(roleFits) || roleFits.length === 0) {
    return;
  }

  roleFits.slice(0, 6).forEach((entry) => {
    const card = document.createElement("article");
    card.className = "fit-card";

    const title = document.createElement("h3");
    title.textContent = entry.title;

    const objective = document.createElement("p");
    objective.className = "fit-objective";
    objective.textContent = entry.objective || "Role alignment based on verified data.";

    const score = document.createElement("p");
    score.className = "fit-score";
    score.textContent = `${entry.score}% fit`;

    const bar = document.createElement("div");
    bar.className = "fit-bar";
    const barFill = document.createElement("span");
    barFill.style.width = `${Math.min(Math.max(Number(entry.score) || 0, 0), 100)}%`;
    bar.appendChild(barFill);

    const keywords = document.createElement("div");
    keywords.className = "chip-wrap";
    (Array.isArray(entry.matchedKeywords) ? entry.matchedKeywords : []).slice(0, 5).forEach((keyword) => {
      keywords.appendChild(createChip(keyword, "chip fit-chip"));
    });

    const resumeCta = document.createElement("a");
    resumeCta.className = "fit-link";
    resumeCta.href = `/resume?profileId=${encodeURIComponent(entry.id)}`;
    resumeCta.target = "_blank";
    resumeCta.rel = "noreferrer";
    resumeCta.textContent = "Open tailored resume";

    card.appendChild(title);
    card.appendChild(objective);
    card.appendChild(score);
    card.appendChild(bar);
    card.appendChild(keywords);
    card.appendChild(resumeCta);
    dom.roleFitGrid.appendChild(card);
  });

  updateResumeLinks(roleFits[0] ? roleFits[0].id : "");
  if (dom.publicProfileSelect) {
    clearElement(dom.publicProfileSelect);
    roleFits.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = `${entry.title} (${entry.score}% fit)`;
      dom.publicProfileSelect.appendChild(option);
    });

    if (roleFits[0]) {
      dom.publicProfileSelect.value = roleFits[0].id;
      loadResumeAnalysis(roleFits[0].id);
    }
  }
}

function renderCapabilities(cards) {
  clearElement(dom.capabilityGrid);

  if (!Array.isArray(cards) || cards.length === 0) {
    return;
  }

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "capability-card";

    const title = document.createElement("h3");
    title.textContent = card.title || "Capability";

    const description = document.createElement("p");
    description.textContent = card.description || "";

    const chipWrap = document.createElement("div");
    chipWrap.className = "chip-wrap";

    (Array.isArray(card.tools) ? card.tools : []).forEach((tool) => {
      chipWrap.appendChild(createChip(tool));
    });

    article.appendChild(title);
    article.appendChild(description);
    article.appendChild(chipWrap);
    dom.capabilityGrid.appendChild(article);
  });
}

function renderProjects(projects) {
  clearElement(dom.projectGrid);

  if (!Array.isArray(projects) || projects.length === 0) {
    return;
  }

  projects.forEach((project, index) => {
    const card = document.createElement("article");
    card.className = "project-card";

    const top = document.createElement("div");
    top.className = "project-top";

    const title = document.createElement("h3");
    title.textContent = project.name || `Project ${index + 1}`;

    const source = document.createElement("span");
    source.className = "source-badge";
    source.textContent = project.sourceAccount || "Portfolio";

    top.appendChild(title);
    top.appendChild(source);

    const summary = document.createElement("p");
    summary.className = "project-summary";
    summary.textContent = project.summary || project.description || "Project details available in repository.";

    const challenge = createLabeledParagraph(
      "Challenge",
      project.challenge || "Build a reliable solution with user value.",
      "project-detail"
    );

    const impact = createLabeledParagraph(
      "Impact",
      project.impact || "Demonstrates practical engineering execution.",
      "project-detail"
    );

    const chips = document.createElement("div");
    chips.className = "chip-wrap";
    (Array.isArray(project.stack) ? project.stack : []).forEach((stackItem) => {
      chips.appendChild(createChip(stackItem));
    });

    const links = document.createElement("div");
    links.className = "project-links";

    if (project.repo) {
      const repoLink = document.createElement("a");
      repoLink.href = project.repo;
      repoLink.target = "_blank";
      repoLink.rel = "noreferrer";
      repoLink.textContent = "Repository";
      links.appendChild(repoLink);
    }

    if (project.live) {
      const liveLink = document.createElement("a");
      liveLink.href = project.live;
      liveLink.target = "_blank";
      liveLink.rel = "noreferrer";
      liveLink.textContent = "Live Product";
      links.appendChild(liveLink);
    }

    card.appendChild(top);
    card.appendChild(summary);
    card.appendChild(challenge);
    card.appendChild(impact);
    card.appendChild(chips);

    if (links.childElementCount > 0) {
      card.appendChild(links);
    }

    dom.projectGrid.appendChild(card);
  });
}

function renderGithub(github) {
  clearElement(dom.accountGrid);
  clearElement(dom.languageCloud);

  const accounts = Array.isArray(github.accounts) ? github.accounts : [];

  accounts.forEach((account) => {
    const card = document.createElement("article");
    card.className = "account-card";

    const header = document.createElement("div");
    header.className = "account-head";

    const name = document.createElement("h3");
    name.textContent = account.username;

    const profileLink = document.createElement("a");
    profileLink.href = account.profileUrl;
    profileLink.target = "_blank";
    profileLink.rel = "noreferrer";
    profileLink.textContent = "Profile";

    header.appendChild(name);
    header.appendChild(profileLink);

    const stats = document.createElement("p");
    stats.className = "account-stats";
    stats.textContent = `${account.repoCount || 0} repos • ${account.totalStars || 0} stars • ${account.totalForks || 0} forks`;

    const active = document.createElement("p");
    active.className = "account-active";
    active.textContent = `Last active: ${toReadableDate(account.lastActive)}`;

    const languageWrap = document.createElement("div");
    languageWrap.className = "chip-wrap";
    (Array.isArray(account.languages) ? account.languages : []).slice(0, 5).forEach((language) => {
      languageWrap.appendChild(createChip(`${language.name} (${language.count})`));
    });

    const repoList = document.createElement("ul");
    repoList.className = "mini-repo-list";

    (Array.isArray(account.topRepos) ? account.topRepos : []).slice(0, 3).forEach((repo) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = repo.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = repo.name;
      item.appendChild(link);
      repoList.appendChild(item);
    });

    card.appendChild(header);

    if (account.error) {
      const issue = document.createElement("p");
      issue.className = "account-error";
      issue.textContent = account.error;
      card.appendChild(issue);
    }

    card.appendChild(stats);
    card.appendChild(active);
    card.appendChild(languageWrap);
    card.appendChild(repoList);
    dom.accountGrid.appendChild(card);
  });

  const combinedLanguages = github.combined && Array.isArray(github.combined.languages)
    ? github.combined.languages
    : [];

  combinedLanguages.slice(0, 10).forEach((language) => {
    const pill = document.createElement("span");
    pill.className = "language-pill";
    pill.style.setProperty("--weight", String(Math.max(language.count, 1)));
    pill.textContent = `${language.name} (${language.count})`;
    dom.languageCloud.appendChild(pill);
  });
}

function renderArchitecture(pillars) {
  clearElement(dom.architectureGrid);

  if (!Array.isArray(pillars)) {
    return;
  }

  pillars.forEach((pillar) => {
    const card = document.createElement("article");
    card.className = "architecture-card";

    const title = document.createElement("h3");
    title.textContent = pillar.title || "Architecture Stage";

    const details = document.createElement("p");
    details.textContent = pillar.details || "";

    const outcome = createLabeledParagraph("Outcome", pillar.outcome || "Clear value delivery.", "architecture-outcome");

    card.appendChild(title);
    card.appendChild(details);
    card.appendChild(outcome);
    dom.architectureGrid.appendChild(card);
  });
}

function renderServices(services) {
  clearElement(dom.servicesList);

  (Array.isArray(services) ? services : []).forEach((service) => {
    const item = document.createElement("li");
    item.textContent = service;
    dom.servicesList.appendChild(item);
  });
}

function renderTimeline(listNode, entries) {
  clearElement(listNode);

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const item = document.createElement("li");

    const period = document.createElement("p");
    period.className = "timeline-period";
    period.textContent = entry.period || "Timeline";

    const title = document.createElement("h4");
    title.textContent = entry.title || entry.degree || "Milestone";

    const schoolOrDetail = document.createElement("p");
    schoolOrDetail.className = "timeline-title";
    schoolOrDetail.textContent = entry.school || entry.details || "";

    item.appendChild(period);
    item.appendChild(title);
    item.appendChild(schoolOrDetail);
    listNode.appendChild(item);
  });
}

function renderInterests(interests) {
  clearElement(dom.interestList);

  (Array.isArray(interests) ? interests : []).forEach((interest) => {
    dom.interestList.appendChild(createChip(interest, "interest-chip"));
  });
}

function renderAutomation(showcase) {
  const github = showcase.github || {};
  const linkedin = showcase.linkedin || {};

  setText(
    dom.syncStatusText,
    `GitHub last synced: ${toReadableDateTime(github.generatedAt)}. Repositories and project signals auto-refresh from public APIs.`
  );

  const linkedInMessage = linkedin.status === "live"
    ? `LinkedIn sync: live metadata fetched at ${toReadableDateTime(linkedin.updatedAt)}.`
    : `LinkedIn sync: ${linkedin.status || "restricted"}. URL remains connected; full scrape may be platform-restricted.`;

  setText(dom.linkedinStatusText, linkedInMessage);

  clearElement(dom.securityList);

  const securityEntries = showcase.security && typeof showcase.security === "object"
    ? Object.entries(showcase.security)
    : [];

  securityEntries.forEach(([label, details]) => {
    const item = document.createElement("li");
    item.textContent = `${label}: ${details}`;
    dom.securityList.appendChild(item);
  });
}

function initReveal() {
  const revealTargets = document.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    revealTargets.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, io) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -32px 0px"
    }
  );

  revealTargets.forEach((node) => observer.observe(node));
}

async function handleContactSubmit(event) {
  event.preventDefault();

  const formData = new FormData(dom.contactForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    message: String(formData.get("message") || "").trim()
  };

  if (payload.name.length < 2 || payload.message.length < 10) {
    setStatus("Please enter your name and a message with at least 10 characters.", "error");
    return;
  }

  try {
    setStatus("Sending message...", "loading");

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Could not send message at this moment.");
    }

    dom.contactForm.reset();
    setStatus(result.message || "Message sent successfully.", "success");
  } catch (error) {
    setStatus(error.message || "Something went wrong while sending your message.", "error");
  }
}

async function loadShowcase() {
  try {
    const response = await fetch("/api/showcase");

    if (!response.ok) {
      throw new Error("Unable to load showcase data.");
    }

    const showcase = await response.json();
    renderHero(showcase);
    renderMetrics(showcase);
    renderRoleFits(showcase.roleFitProfiles || []);
    renderCapabilities(showcase.capabilityCards);
    renderProjects(showcase.featuredProjects);
    renderGithub(showcase.github || {});
    renderArchitecture(showcase.architecturePillars);
    renderServices(showcase.services);
    renderTimeline(dom.timelineList, showcase.experienceTimeline);
    renderTimeline(dom.educationList, showcase.education);
    renderInterests(showcase.interests);
    renderAutomation(showcase);

    const year = new Date().getFullYear();
    setText(dom.footerText, `Copyright ${year} Shivansh Mishra. Portfolio with secure ATS resume automation.`);
  } catch (error) {
    setStatus("Showcase data could not be loaded. Please start backend with npm start.", "error");
    console.error(error);
  }
}

if (dom.contactForm) {
  dom.contactForm.addEventListener("submit", handleContactSubmit);
}

if (dom.publicProfileSelect) {
  dom.publicProfileSelect.addEventListener("change", () => {
    const selectedProfile = dom.publicProfileSelect.value;
    updateResumeLinks(selectedProfile);
    loadResumeAnalysis(selectedProfile);
  });
}

updateResumeLinks("");
initReveal();
loadShowcase();
