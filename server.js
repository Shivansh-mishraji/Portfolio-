const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const PORTFOLIO_FILE = path.join(DATA_DIR, "portfolio.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const JOB_PROFILES_FILE = path.join(DATA_DIR, "job-profiles.json");
const RESUME_CONFIG_FILE = path.join(DATA_DIR, "resume-config.json");

const GITHUB_CACHE_TTL_MS = 8 * 60 * 1000;
const LINKEDIN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_RATE_MAX = 30;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = 8;
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_BODY_SIZE_BYTES = 1_000_000;

const SESSION_COOKIE_NAME = "portfolio_admin_session";
const DEFAULT_GITHUB_ACCOUNTS = ["Shivansh-mishraji", "Shivanshmishra7275"];

const GENERATED_ADMIN_PASSWORD = crypto.randomBytes(12).toString("base64url");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || GENERATED_ADMIN_PASSWORD;
const ADMIN_PASSWORD_SOURCE = process.env.ADMIN_PASSWORD ? "environment" : "generated";
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString("hex");

const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/admin", "admin.html"],
  ["/admin.html", "admin.html"],
  ["/admin.css", "admin.css"],
  ["/admin.js", "admin.js"]
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "shivansh-portfolio-showcase",
  "X-GitHub-Api-Version": "2022-11-28"
};

if (process.env.GITHUB_TOKEN) {
  GITHUB_HEADERS.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const githubCache = {
  expiresAt: 0,
  value: null
};

const linkedinCache = {
  expiresAt: 0,
  value: null,
  key: ""
};

const contactRateMap = new Map();
const loginRateMap = new Map();

const DEFAULT_JOB_PROFILES = [
  {
    id: "ml-engineer",
    title: "Machine Learning Engineer",
    objective: "Highlight model development, evaluation, and integration into usable products.",
    keywordTargets: [
      "machine learning",
      "python",
      "model",
      "regression",
      "classification",
      "scikit-learn",
      "data pipeline",
      "analytics"
    ],
    focusCapabilities: [
      "Machine Learning to Product",
      "Data and Analytics Engineering"
    ],
    focusProjectKeywords: [
      "prediction",
      "analysis",
      "classification",
      "model",
      "data",
      "pipeline"
    ],
    questionSet: [
      {
        id: "targetModelDomain",
        label: "Preferred ML domain",
        type: "select",
        options: ["Regression", "NLP", "Computer Vision", "General Applied ML"],
        required: false
      },
      {
        id: "customFocus",
        label: "ML focus statement",
        type: "text",
        required: false,
        maxLength: 220
      }
    ]
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    objective: "Emphasize data analysis, modeling, and insight generation from real-world datasets.",
    keywordTargets: [
      "data science",
      "python",
      "statistics",
      "machine learning",
      "feature engineering",
      "model evaluation",
      "visualization",
      "insights"
    ],
    focusCapabilities: [
      "Data and Analytics Engineering",
      "Machine Learning to Product"
    ],
    focusProjectKeywords: [
      "analysis",
      "unemployment",
      "prediction",
      "model",
      "data"
    ],
    questionSet: [
      {
        id: "preferredBusinessArea",
        label: "Preferred business area",
        type: "select",
        options: ["Finance", "Education", "Operations", "Healthcare", "General"],
        required: false
      },
      {
        id: "customFocus",
        label: "Data science focus statement",
        type: "text",
        required: false,
        maxLength: 220
      }
    ]
  },
  {
    id: "ai-engineer",
    title: "AI Engineer",
    objective: "Focus on building AI-powered applications from model logic to practical product usage.",
    keywordTargets: [
      "artificial intelligence",
      "machine learning",
      "python",
      "model integration",
      "automation",
      "workflow",
      "applied ai",
      "prediction"
    ],
    focusCapabilities: [
      "Machine Learning to Product",
      "Product Delivery and Collaboration"
    ],
    focusProjectKeywords: [
      "mvp",
      "prediction",
      "workflow",
      "model",
      "product"
    ],
    questionSet: [
      {
        id: "targetModelDomain",
        label: "Preferred AI domain",
        type: "select",
        options: ["General Applied AI", "Regression", "NLP", "Computer Vision"],
        required: false
      },
      {
        id: "customFocus",
        label: "AI focus statement",
        type: "text",
        required: false,
        maxLength: 220
      }
    ]
  },
  {
    id: "product-manager",
    title: "Product Manager",
    objective: "Highlight product thinking, execution ownership, and user-problem focused delivery.",
    keywordTargets: [
      "product",
      "roadmap",
      "user",
      "execution",
      "requirements",
      "problem solving",
      "delivery",
      "collaboration"
    ],
    focusCapabilities: [
      "Product Delivery and Collaboration",
      "Data and Analytics Engineering"
    ],
    focusProjectKeywords: [
      "campus",
      "mvp",
      "workflow",
      "platform",
      "product"
    ],
    questionSet: [
      {
        id: "targetIndustry",
        label: "Target industry",
        type: "text",
        required: false,
        maxLength: 120
      },
      {
        id: "targetCompanyType",
        label: "Target company type",
        type: "select",
        options: ["Startup", "Product Company", "Service Company", "Enterprise"],
        required: false
      },
      {
        id: "customFocus",
        label: "Product focus statement",
        type: "text",
        required: false,
        maxLength: 220
      }
    ]
  }
];

function applySecurityHeaders(res) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.github.com https://www.linkedin.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  applySecurityHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce((acc, item) => {
    const [rawName, ...rawValueParts] = item.split("=");
    const name = rawName.trim();
    const rawValue = rawValueParts.join("=").trim();

    if (name) {
      acc[name] = decodeURIComponent(rawValue);
    }

    return acc;
  }, {});
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

function safeString(value, maxLength = 220) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));

  if (left.length !== right.length || left.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function consumeRateLimit(map, key, maxCount, windowMs) {
  const now = Date.now();
  const history = (map.get(key) || []).filter((timestamp) => now - timestamp <= windowMs);
  history.push(now);
  map.set(key, history);

  const retryAfterMs = history.length > 0 ? Math.max(windowMs - (now - history[0]), 0) : 0;

  return {
    limited: history.length > maxCount,
    count: history.length,
    retryAfterSec: Math.ceil(retryAfterMs / 1000)
  };
}

function signSessionPayload(encodedPayload) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(encodedPayload).digest("base64url");
}

function createAdminSessionToken() {
  const payload = {
    sub: "admin",
    csrf: crypto.randomBytes(18).toString("base64url"),
    exp: Date.now() + ADMIN_SESSION_TTL_MS
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signSessionPayload(encoded);

  return {
    token: `${encoded}.${signature}`,
    payload
  };
}

function verifyAdminSessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const splitIndex = token.lastIndexOf(".");

  if (splitIndex <= 0) {
    return null;
  }

  const encoded = token.slice(0, splitIndex);
  const signature = token.slice(splitIndex + 1);
  const expected = signSessionPayload(encoded);

  if (!safeEquals(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));

    if (!payload || payload.sub !== "admin" || typeof payload.exp !== "number") {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function buildSessionCookie(token) {
  const maxAge = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict"
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildSessionClearCookie() {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict"
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function getAdminSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];

  return verifyAdminSessionToken(token);
}

function requireAdminSession(req, res, options = { requireCsrf: false }) {
  const session = getAdminSessionFromRequest(req);

  if (!session) {
    sendJson(res, 401, { ok: false, error: "Admin authentication required." });
    return null;
  }

  if (options.requireCsrf) {
    const csrfHeader = req.headers["x-csrf-token"];

    if (!csrfHeader || !safeEquals(csrfHeader, session.csrf)) {
      sendJson(res, 403, { ok: false, error: "Invalid CSRF token." });
      return null;
    }
  }

  return session;
}

async function readJson(filePath, fallbackValue) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }

    throw error;
  }
}

async function writeJson(filePath, payload) {
  const nextValue = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(filePath, nextValue, "utf8");
}

function uniqueBy(array, keySelector) {
  const seen = new Set();
  const result = [];

  array.forEach((item) => {
    const key = keySelector(item);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(item);
  });

  return result;
}

function normalizeRepo(repo, sourceAccount) {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || "Project description coming soon.",
    url: repo.html_url,
    homepage: repo.homepage || null,
    language: repo.language || "Mixed",
    stars: Number(repo.stargazers_count) || 0,
    forks: Number(repo.forks_count) || 0,
    updatedAt: repo.updated_at,
    sourceAccount
  };
}

function summarizeLanguages(repos) {
  const counts = new Map();

  repos.forEach((repo) => {
    const key = repo.language || "Mixed";
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function pickTopRepos(repos, limit) {
  return repos
    .slice()
    .sort((a, b) => {
      const starDelta = (b.stars || 0) - (a.stars || 0);

      if (starDelta !== 0) {
        return starDelta;
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, limit);
}

function pickRecentRepos(repos, limit) {
  return repos
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGithubReposForUser(username) {
  const githubUrl = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;
  const response = await fetchWithTimeout(
    githubUrl,
    {
      method: "GET",
      headers: GITHUB_HEADERS
    },
    9000
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub API error for ${username}: ${response.status} ${response.statusText} ${detail}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((repo) => !repo.private && !repo.fork && !repo.archived)
    .map((repo) => normalizeRepo(repo, username));
}

async function buildGithubInsights(usernames) {
  if (githubCache.value && githubCache.expiresAt > Date.now()) {
    return githubCache.value;
  }

  const results = await Promise.all(
    usernames.map(async (username) => {
      try {
        const repos = await fetchGithubReposForUser(username);
        const repoCount = repos.length;
        const totalStars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
        const totalForks = repos.reduce((sum, repo) => sum + (repo.forks || 0), 0);
        const languages = summarizeLanguages(repos).slice(0, 8);

        return {
          username,
          profileUrl: `https://github.com/${username}`,
          repoCount,
          totalStars,
          totalForks,
          lastActive: repos[0] ? repos[0].updatedAt : null,
          languages,
          topRepos: pickTopRepos(repos, 4),
          recentRepos: pickRecentRepos(repos, 5),
          repos
        };
      } catch (error) {
        return {
          username,
          profileUrl: `https://github.com/${username}`,
          repoCount: 0,
          totalStars: 0,
          totalForks: 0,
          lastActive: null,
          languages: [],
          topRepos: [],
          recentRepos: [],
          repos: [],
          error: "Unable to fetch repositories right now."
        };
      }
    })
  );

  const mergedRepos = results.flatMap((entry) => entry.repos);
  const dedupedRepos = uniqueBy(mergedRepos, (repo) => repo.fullName);
  const combinedLanguages = summarizeLanguages(dedupedRepos);
  const combinedRepoCount = dedupedRepos.length;
  const combinedStars = dedupedRepos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const combinedForks = dedupedRepos.reduce((sum, repo) => sum + (repo.forks || 0), 0);

  const insights = {
    accounts: results.map((entry) => ({
      username: entry.username,
      profileUrl: entry.profileUrl,
      repoCount: entry.repoCount,
      totalStars: entry.totalStars,
      totalForks: entry.totalForks,
      lastActive: entry.lastActive,
      languages: entry.languages,
      topRepos: entry.topRepos,
      recentRepos: entry.recentRepos,
      error: entry.error
    })),
    combined: {
      repoCount: combinedRepoCount,
      totalStars: combinedStars,
      totalForks: combinedForks,
      languages: combinedLanguages,
      recentActivity: pickRecentRepos(dedupedRepos, 10)
    },
    generatedAt: new Date().toISOString()
  };

  githubCache.value = insights;
  githubCache.expiresAt = Date.now() + GITHUB_CACHE_TTL_MS;

  return insights;
}

async function fetchLinkedinSignals(linkedinUrl) {
  const normalizedUrl = safeString(linkedinUrl, 300);

  if (!normalizedUrl) {
    return {
      status: "not-configured",
      source: "none",
      updatedAt: new Date().toISOString()
    };
  }

  if (linkedinCache.value && linkedinCache.expiresAt > Date.now() && linkedinCache.key === normalizedUrl) {
    return linkedinCache.value;
  }

  try {
    const response = await fetchWithTimeout(
      normalizedUrl,
      {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PortfolioBot/1.0)"
        }
      },
      9000
    );

    if (!response.ok) {
      throw new Error(`LinkedIn response ${response.status}`);
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descriptionMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    const title = titleMatch ? safeString(titleMatch[1], 140).replace(/\s*\|\s*LinkedIn.*$/i, "") : "LinkedIn profile";
    const description = descriptionMatch ? safeString(descriptionMatch[1], 260) : "Public summary not exposed by LinkedIn fetch.";

    const result = {
      status: "live",
      source: "public-profile-fetch",
      profileUrl: normalizedUrl,
      title,
      description,
      updatedAt: new Date().toISOString()
    };

    linkedinCache.value = result;
    linkedinCache.key = normalizedUrl;
    linkedinCache.expiresAt = Date.now() + LINKEDIN_CACHE_TTL_MS;

    return result;
  } catch {
    const result = {
      status: "restricted",
      source: "public-profile-fetch",
      profileUrl: normalizedUrl,
      title: "LinkedIn profile connected",
      description: "Live LinkedIn scraping is restricted by platform protections. URL remains linked in portfolio.",
      updatedAt: new Date().toISOString()
    };

    linkedinCache.value = result;
    linkedinCache.key = normalizedUrl;
    linkedinCache.expiresAt = Date.now() + LINKEDIN_CACHE_TTL_MS;

    return result;
  }
}

function normalizeCuratedProject(project) {
  const stack = Array.isArray(project.stack)
    ? project.stack.map((item) => safeString(item, 60)).filter(Boolean)
    : [];

  return {
    name: safeString(project.name, 120),
    summary: safeString(project.summary || project.description, 360),
    challenge: safeString(project.challenge, 320),
    impact: safeString(project.impact, 320),
    stack,
    repo: safeString(project.repo, 320),
    live: safeString(project.live, 320),
    sourceAccount: safeString(project.sourceAccount, 80),
    updatedAt: safeString(project.updatedAt, 80)
  };
}

function toShowcaseProjects(curatedProjects, githubInsights) {
  const curated = (Array.isArray(curatedProjects) ? curatedProjects : []).map(normalizeCuratedProject);
  const fromGithub = (githubInsights.combined.recentActivity || []).map((repo) => ({
    name: repo.name,
    summary: repo.description,
    challenge: "Project implementation and iteration from idea to deployment.",
    impact: `Repository maintained on ${repo.sourceAccount}.`,
    stack: [repo.language],
    repo: repo.url,
    live: repo.homepage,
    sourceAccount: repo.sourceAccount,
    updatedAt: repo.updatedAt
  }));

  return uniqueBy([...curated, ...fromGithub], (item) => String(item.name || "").toLowerCase()).slice(0, 12);
}

function createSkillPool(showcase) {
  const pool = new Set();

  (showcase.capabilityCards || []).forEach((card) => {
    (card.tools || []).forEach((tool) => {
      const normalized = safeString(tool, 60);
      if (normalized) {
        pool.add(normalized);
      }
    });
  });

  const githubLanguages = showcase.github && showcase.github.combined ? showcase.github.combined.languages : [];
  (githubLanguages || []).forEach((entry) => {
    const normalized = safeString(entry.name, 50);
    if (normalized) {
      pool.add(normalized);
    }
  });

  return [...pool];
}

function scoreRoleFit(showcase, profileTemplate) {
  const keywords = Array.isArray(profileTemplate.keywordTargets)
    ? profileTemplate.keywordTargets.map((item) => safeString(item, 60).toLowerCase()).filter(Boolean)
    : [];

  const sourceText = [
    ...(showcase.highlights || []),
    ...(showcase.services || []),
    ...(showcase.featuredProjects || []).map((project) => `${project.name} ${project.summary} ${(project.stack || []).join(" ")}`),
    ...createSkillPool(showcase)
  ]
    .join(" ")
    .toLowerCase();

  const matched = keywords.filter((keyword) => sourceText.includes(keyword));
  const ratio = keywords.length > 0 ? matched.length / keywords.length : 0.55;
  const score = Math.round(55 + ratio * 43);

  return {
    id: profileTemplate.id,
    title: profileTemplate.title,
    objective: profileTemplate.objective,
    score: Math.max(Math.min(score, 98), 45),
    matchedKeywords: matched.slice(0, 7)
  };
}

function computeRoleFitProfiles(showcase, jobProfiles) {
  return (Array.isArray(jobProfiles) ? jobProfiles : [])
    .map((profile) => scoreRoleFit(showcase, profile))
    .sort((a, b) => b.score - a.score);
}

async function readJobProfiles() {
  const fromFile = await readJson(JOB_PROFILES_FILE, DEFAULT_JOB_PROFILES);

  if (!Array.isArray(fromFile) || fromFile.length === 0) {
    return DEFAULT_JOB_PROFILES;
  }

  return fromFile;
}

function defaultResumeConfig() {
  return {
    selectedProfileId: DEFAULT_JOB_PROFILES[0].id,
    answers: {},
    updatedAt: new Date().toISOString()
  };
}

async function readResumeConfig() {
  const fromFile = await readJson(RESUME_CONFIG_FILE, defaultResumeConfig());

  if (!fromFile || typeof fromFile !== "object") {
    return defaultResumeConfig();
  }

  return {
    selectedProfileId: safeString(fromFile.selectedProfileId, 80) || DEFAULT_JOB_PROFILES[0].id,
    answers: typeof fromFile.answers === "object" && fromFile.answers ? fromFile.answers : {},
    updatedAt: safeString(fromFile.updatedAt, 80) || new Date().toISOString()
  };
}

function getTemplateById(jobProfiles, profileId) {
  const found = (jobProfiles || []).find((item) => item.id === profileId);
  if (found) {
    return found;
  }

  return (jobProfiles || [])[0] || DEFAULT_JOB_PROFILES[0];
}

function normalizeAnswerByQuestion(question, value) {
  if (question.type === "select") {
    const normalized = safeString(value, 120);

    if (!normalized) {
      return "";
    }

    const options = Array.isArray(question.options) ? question.options : [];

    if (!options.includes(normalized)) {
      return "";
    }

    return normalized;
  }

  return safeString(value, Number(question.maxLength) || 220);
}

function normalizeResumeConfigPayload(payload, jobProfiles) {
  const errors = {};
  const profileId = safeString(payload.profileId, 80);
  const template = getTemplateById(jobProfiles, profileId);

  if (!template || template.id !== profileId) {
    errors.profileId = "Invalid job profile selected.";
  }

  const incomingAnswers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
  const questionSet = Array.isArray(template.questionSet) ? template.questionSet : [];
  const normalizedAnswers = {};

  questionSet.forEach((question) => {
    const rawValue = incomingAnswers[question.id];
    const normalizedValue = normalizeAnswerByQuestion(question, rawValue);

    if (question.required && !normalizedValue) {
      errors[question.id] = `${question.label} is required.`;
      return;
    }

    if (normalizedValue) {
      normalizedAnswers[question.id] = normalizedValue;
    }
  });

  return {
    errors,
    value: {
      selectedProfileId: template.id,
      answers: normalizedAnswers,
      updatedAt: new Date().toISOString()
    }
  };
}

function rankSkillsForTemplate(showcase, template) {
  const skillPool = createSkillPool(showcase);
  const keywords = (template.keywordTargets || []).map((keyword) => keyword.toLowerCase());

  return skillPool
    .map((skill) => {
      const lower = skill.toLowerCase();
      let score = 1;

      keywords.forEach((keyword) => {
        if (lower.includes(keyword) || keyword.includes(lower)) {
          score += 2;
        }
      });

      return { skill, score };
    })
    .sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill))
    .map((entry) => entry.skill)
    .slice(0, 16);
}

function scoreProjectForTemplate(project, template) {
  const text = `${project.name} ${project.summary} ${project.challenge} ${project.impact} ${(project.stack || []).join(" ")}`.toLowerCase();
  let score = 0;

  (template.keywordTargets || []).forEach((keyword) => {
    if (text.includes(String(keyword).toLowerCase())) {
      score += 2;
    }
  });

  (template.focusProjectKeywords || []).forEach((keyword) => {
    if (text.includes(String(keyword).toLowerCase())) {
      score += 3;
    }
  });

  return score;
}

function selectProjectsForResume(projects, template, limit = 5) {
  const source = Array.isArray(projects) ? projects : [];

  return source
    .map((project) => ({
      project,
      score: scoreProjectForTemplate(project, template)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const bDate = new Date(b.project.updatedAt || 0).getTime();
      const aDate = new Date(a.project.updatedAt || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, limit)
    .map((item) => item.project);
}

function buildRoleSpecificSummary(showcase, template, answers) {
  const profile = showcase.profile || {};
  const positioning = showcase.positioning || {};
  const customFocus = safeString(answers.customFocus, 220);
  const companyType = safeString(answers.targetCompanyType, 80);
  const workMode = safeString(answers.preferredWorkMode, 80);
  const industry = safeString(answers.targetIndustry, 80);
  const domain = safeString(answers.targetModelDomain || answers.preferredBusinessArea, 80);

  const lines = [
    safeString(profile.headline, 260),
    safeString(positioning.valueProposition, 260),
    safeString(template.objective, 260)
  ].filter(Boolean);

  if (companyType) {
    lines.push(`Preferred company environment: ${companyType}.`);
  }

  if (workMode) {
    lines.push(`Preferred work mode: ${workMode}.`);
  }

  if (industry) {
    lines.push(`Target industry focus: ${industry}.`);
  }

  if (domain) {
    lines.push(`Role domain preference: ${domain}.`);
  }

  if (customFocus) {
    lines.push(customFocus);
  }

  return lines.join(" ");
}

function buildResumeDocument(showcase, template, answers) {
  const profile = showcase.profile || {};
  const selectedProjects = selectProjectsForResume(showcase.featuredProjects, template, 5);
  const selectedSkills = rankSkillsForTemplate(showcase, template);

  return {
    generatedAt: new Date().toISOString(),
    targetRole: template.title,
    complianceNote: "Generated only from verified portfolio information. No fabricated details included.",
    contact: {
      name: safeString(profile.name, 80),
      role: safeString(profile.role, 120),
      location: safeString(profile.location, 120),
      email: safeString(profile.email, 120),
      phone: safeString(profile.phone, 60),
      linkedin: safeString(profile.linkedin, 220),
      githubPrimary: safeString(profile.githubPrimary, 220),
      githubSecondary: safeString(profile.githubSecondary, 220)
    },
    summary: buildRoleSpecificSummary(showcase, template, answers),
    strengths: (showcase.highlights || []).slice(0, 6),
    skills: selectedSkills,
    projects: selectedProjects.map((project) => ({
      name: project.name,
      summary: project.summary,
      challenge: project.challenge,
      impact: project.impact,
      stack: project.stack || [],
      repo: project.repo,
      live: project.live,
      sourceAccount: project.sourceAccount
    })),
    experience: Array.isArray(showcase.experienceTimeline) ? showcase.experienceTimeline : [],
    education: Array.isArray(showcase.education) ? showcase.education : [],
    atsKeywords: Array.isArray(template.keywordTargets) ? template.keywordTargets : []
  };
}

function buildResumeAnalysis(document, template) {
  const keywords = Array.isArray(template.keywordTargets) ? template.keywordTargets : [];
  const analysisSource = [
    safeString(document.summary, 5000),
    ...(Array.isArray(document.strengths) ? document.strengths : []),
    ...(Array.isArray(document.skills) ? document.skills : []),
    ...(Array.isArray(document.projects) ? document.projects : []).map(
      (project) => `${project.name} ${project.summary} ${(project.stack || []).join(" ")}`
    )
  ]
    .join(" ")
    .toLowerCase();

  const matchedKeywords = keywords.filter((keyword) => analysisSource.includes(String(keyword).toLowerCase()));
  const missingKeywords = keywords.filter((keyword) => !matchedKeywords.includes(keyword));
  const ratio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0.5;
  const score = Math.max(45, Math.min(98, Math.round(55 + ratio * 43)));

  const recommendations = missingKeywords.slice(0, 5).map((keyword) => (
    `Add verifiable evidence for "${keyword}" in summary, skills, or project outcomes when applicable.`
  ));

  return {
    score,
    matchedKeywords,
    missingKeywords,
    recommendations,
    evaluatedAt: new Date().toISOString(),
    policy: "Recommendations must be implemented only with truthful, verifiable information."
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resumeToText(document) {
  const lines = [];

  lines.push(`${document.contact.name} | ${document.targetRole}`);
  lines.push(`${document.contact.location} | ${document.contact.email} | ${document.contact.phone}`);
  lines.push(`LinkedIn: ${document.contact.linkedin}`);
  lines.push(`GitHub: ${document.contact.githubPrimary} | ${document.contact.githubSecondary}`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(document.summary);
  lines.push("");
  lines.push("CORE STRENGTHS");
  document.strengths.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("SKILLS");
  lines.push(document.skills.join(", "));
  lines.push("");
  lines.push("PROJECTS");
  document.projects.forEach((project) => {
    lines.push(`- ${project.name}`);
    lines.push(`  Summary: ${project.summary}`);
    if (project.challenge) {
      lines.push(`  Challenge: ${project.challenge}`);
    }
    if (project.impact) {
      lines.push(`  Impact: ${project.impact}`);
    }
    if (Array.isArray(project.stack) && project.stack.length > 0) {
      lines.push(`  Stack: ${project.stack.join(", ")}`);
    }
    if (project.repo) {
      lines.push(`  Repo: ${project.repo}`);
    }
    if (project.live) {
      lines.push(`  Live: ${project.live}`);
    }
  });
  lines.push("");
  lines.push("EXPERIENCE");
  document.experience.forEach((item) => {
    lines.push(`- ${item.period} | ${item.title}`);
    lines.push(`  ${item.details}`);
  });
  lines.push("");
  lines.push("EDUCATION");
  document.education.forEach((item) => {
    lines.push(`- ${item.period} | ${item.degree}`);
    lines.push(`  ${item.school}`);
    lines.push(`  ${item.details}`);
  });
  lines.push("");
  lines.push("ATS KEYWORDS");
  lines.push(document.atsKeywords.join(", "));
  lines.push("");
  lines.push(`Generated: ${document.generatedAt}`);
  lines.push(document.complianceNote);

  return `${lines.join("\n")}\n`;
}

function resumeToHtml(document) {
  const projectItems = (document.projects || [])
    .map((project) => {
      const stackText = Array.isArray(project.stack) && project.stack.length > 0 ? project.stack.join(", ") : "";

      return `
        <article class="resume-card">
          <h3>${escapeHtml(project.name)}</h3>
          <p><strong>Summary:</strong> ${escapeHtml(project.summary)}</p>
          ${project.challenge ? `<p><strong>Challenge:</strong> ${escapeHtml(project.challenge)}</p>` : ""}
          ${project.impact ? `<p><strong>Impact:</strong> ${escapeHtml(project.impact)}</p>` : ""}
          ${stackText ? `<p><strong>Stack:</strong> ${escapeHtml(stackText)}</p>` : ""}
          <p class="muted">${project.repo ? `<a href="${escapeHtml(project.repo)}">Repository</a>` : ""} ${project.live ? `| <a href="${escapeHtml(project.live)}">Live</a>` : ""}</p>
        </article>
      `;
    })
    .join("\n");

  const experienceItems = (document.experience || [])
    .map(
      (item) => `
      <li>
        <p class="meta">${escapeHtml(item.period)}</p>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.details)}</p>
      </li>
    `
    )
    .join("\n");

  const educationItems = (document.education || [])
    .map(
      (item) => `
      <li>
        <p class="meta">${escapeHtml(item.period)}</p>
        <h4>${escapeHtml(item.degree)}</h4>
        <p>${escapeHtml(item.school)}</p>
        <p>${escapeHtml(item.details)}</p>
      </li>
    `
    )
    .join("\n");

  const strengths = (document.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const skills = (document.skills || []).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(document.contact.name)} - ${escapeHtml(document.targetRole)} Resume</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --ink: #1d2433;
      --muted: #56627a;
      --line: #d7dfec;
      --accent: #0b63ce;
      --card: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.5;
      padding: 1.25rem;
    }
    .resume {
      max-width: 980px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 1.25rem;
    }
    h1, h2, h3, h4, p { margin: 0; }
    .top h1 { font-size: 1.8rem; }
    .top p { color: var(--muted); margin-top: 0.35rem; }
    .links { margin-top: 0.5rem; font-size: 0.9rem; }
    .links a { color: var(--accent); text-decoration: none; }
    .section { margin-top: 1rem; }
    .section h2 {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      margin-bottom: 0.5rem;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.65rem;
    }
    .resume-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0.7rem;
      background: #fbfdff;
    }
    .resume-card h3 { font-size: 1rem; margin-bottom: 0.35rem; }
    .resume-card p { margin-top: 0.25rem; font-size: 0.9rem; }
    .resume-card .muted { color: var(--muted); }
    .chip-wrap { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0.24rem 0.5rem;
      font-size: 0.78rem;
      background: #f2f6ff;
    }
    ul { margin: 0; padding-left: 1rem; }
    li { margin-top: 0.4rem; }
    .timeline { list-style: none; padding: 0; display: grid; gap: 0.45rem; }
    .timeline li {
      border: 1px solid var(--line);
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      padding: 0.55rem;
      background: #fcfdff;
    }
    .meta {
      font-size: 0.75rem;
      color: var(--muted);
      margin-bottom: 0.2rem;
    }
    .footer-note {
      margin-top: 1.2rem;
      font-size: 0.8rem;
      color: var(--muted);
      border-top: 1px dashed var(--line);
      padding-top: 0.7rem;
    }
  </style>
</head>
<body>
  <article class="resume">
    <header class="top">
      <h1>${escapeHtml(document.contact.name)}</h1>
      <p>${escapeHtml(document.targetRole)} | ${escapeHtml(document.contact.location)}</p>
      <p>${escapeHtml(document.contact.email)} | ${escapeHtml(document.contact.phone)}</p>
      <p class="links">
        <a href="${escapeHtml(document.contact.linkedin)}">LinkedIn</a> |
        <a href="${escapeHtml(document.contact.githubPrimary)}">GitHub 1</a> |
        <a href="${escapeHtml(document.contact.githubSecondary)}">GitHub 2</a>
      </p>
    </header>

    <section class="section">
      <h2>Professional Summary</h2>
      <p>${escapeHtml(document.summary)}</p>
    </section>

    <section class="section">
      <h2>Core Strengths</h2>
      <ul>${strengths}</ul>
    </section>

    <section class="section">
      <h2>Skills</h2>
      <div class="chip-wrap">${skills}</div>
    </section>

    <section class="section">
      <h2>Selected Projects</h2>
      <div class="card-grid">${projectItems}</div>
    </section>

    <section class="section">
      <h2>Experience</h2>
      <ul class="timeline">${experienceItems}</ul>
    </section>

    <section class="section">
      <h2>Education</h2>
      <ul class="timeline">${educationItems}</ul>
    </section>

    <section class="section">
      <h2>ATS Keywords</h2>
      <p>${escapeHtml((document.atsKeywords || []).join(", "))}</p>
    </section>

    <p class="footer-note">${escapeHtml(document.complianceNote)} Generated at ${escapeHtml(document.generatedAt)}.</p>
  </article>
</body>
</html>`;
}

function buildResumeFileName(name, role) {
  const slug = `${safeString(name, 80)}-${safeString(role, 80)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "resume";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function parseJsonBody(req) {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of req) {
    receivedBytes += chunk.length;

    if (receivedBytes > MAX_BODY_SIZE_BYTES) {
      throw { statusCode: 413, message: "Payload too large." };
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw { statusCode: 400, message: "Invalid JSON body." };
  }
}

function normalizeContactPayload(payload) {
  const nextName = safeString(payload.name, 80);
  const nextEmail = safeString(payload.email, 120);
  const nextMessage = safeString(payload.message, 1000);
  const errors = {};

  if (nextName.length < 2) {
    errors.name = "Name must be between 2 and 80 characters.";
  }

  if (!isValidEmail(nextEmail)) {
    errors.email = "A valid email is required.";
  }

  if (nextMessage.length < 10) {
    errors.message = "Message must be between 10 and 1000 characters.";
  }

  return {
    errors,
    value: {
      name: nextName,
      email: nextEmail,
      message: nextMessage
    }
  };
}

async function buildShowcasePayload() {
  const portfolio = await readJson(PORTFOLIO_FILE, {});
  const configuredAccounts = Array.isArray(portfolio.githubAccounts) ? portfolio.githubAccounts : [];
  const accountNames = configuredAccounts.length > 0 ? configuredAccounts : DEFAULT_GITHUB_ACCOUNTS;
  const githubInsights = await buildGithubInsights(accountNames);
  const featuredProjects = toShowcaseProjects(portfolio.featuredProjects, githubInsights);
  const linkedinSignals = await fetchLinkedinSignals(portfolio.profile && portfolio.profile.linkedin);
  const jobProfiles = await readJobProfiles();

  const baseShowcase = {
    profile: portfolio.profile || {},
    positioning: portfolio.positioning || {},
    capabilityCards: Array.isArray(portfolio.capabilityCards) ? portfolio.capabilityCards : [],
    architecturePillars: Array.isArray(portfolio.architecturePillars) ? portfolio.architecturePillars : [],
    services: Array.isArray(portfolio.services) ? portfolio.services : [],
    education: Array.isArray(portfolio.education) ? portfolio.education : [],
    experienceTimeline: Array.isArray(portfolio.experienceTimeline) ? portfolio.experienceTimeline : [],
    interests: Array.isArray(portfolio.interests) ? portfolio.interests : [],
    highlights: Array.isArray(portfolio.highlights) ? portfolio.highlights : [],
    featuredProjects,
    github: githubInsights,
    linkedin: linkedinSignals,
    generatedAt: new Date().toISOString()
  };

  return {
    ...baseShowcase,
    roleFitProfiles: computeRoleFitProfiles(baseShowcase, jobProfiles),
    security: {
      auth: "HttpOnly admin session cookie + CSRF token",
      validation: "Strict input validation and size limits",
      headers: "CSP, frame deny, nosniff, referrer policy",
      rateLimiting: "Contact and admin login route throttling"
    }
  };
}

async function resolveResumeDocument(profileIdOverride, answersOverride) {
  const showcase = await buildShowcasePayload();
  const jobProfiles = await readJobProfiles();
  const storedConfig = await readResumeConfig();
  const selectedProfileId = safeString(profileIdOverride, 80) || storedConfig.selectedProfileId;
  const template = getTemplateById(jobProfiles, selectedProfileId);

  const answers = answersOverride && typeof answersOverride === "object"
    ? answersOverride
    : template.id === storedConfig.selectedProfileId
      ? storedConfig.answers
      : {};

  const document = buildResumeDocument(showcase, template, answers);

  return {
    template,
    answers,
    document,
    showcase
  };
}

async function handleAdminRoutes(req, res, requestUrl) {
  const route = requestUrl.pathname;

  if (req.method === "GET" && route === "/api/admin/session") {
    const session = getAdminSessionFromRequest(req);

    if (!session) {
      sendJson(res, 200, { authenticated: false });
      return;
    }

    sendJson(res, 200, {
      authenticated: true,
      csrfToken: session.csrf,
      expiresAt: session.exp,
      passwordSource: ADMIN_PASSWORD_SOURCE,
      requirePasswordRotation: ADMIN_PASSWORD_SOURCE === "generated"
    });
    return;
  }

  if (req.method === "POST" && route === "/api/admin/login") {
    const ip = getClientIp(req);
    const rate = consumeRateLimit(loginRateMap, ip, LOGIN_RATE_MAX, LOGIN_RATE_WINDOW_MS);

    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSec));
      sendJson(res, 429, { ok: false, error: "Too many login attempts. Please try later." });
      return;
    }

    let payload;

    try {
      payload = await parseJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { ok: false, error: error.message || "Invalid request body." });
      return;
    }

    const submittedPassword = safeString(payload.password, 240);

    if (!submittedPassword || !safeEquals(submittedPassword, ADMIN_PASSWORD)) {
      sendJson(res, 401, { ok: false, error: "Invalid credentials." });
      return;
    }

    const session = createAdminSessionToken();
    res.setHeader("Set-Cookie", buildSessionCookie(session.token));

    sendJson(res, 200, {
      ok: true,
      message: "Admin authentication successful.",
      csrfToken: session.payload.csrf,
      expiresAt: session.payload.exp,
      requirePasswordRotation: ADMIN_PASSWORD_SOURCE === "generated"
    });
    return;
  }

  if (req.method === "POST" && route === "/api/admin/logout") {
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    sendJson(res, 200, { ok: true, message: "Logged out." });
    return;
  }

  if (req.method === "GET" && route === "/api/admin/job-profiles") {
    const session = requireAdminSession(req, res, { requireCsrf: false });

    if (!session) {
      return;
    }

    const templates = await readJobProfiles();
    sendJson(res, 200, templates);
    return;
  }

  if (req.method === "GET" && route === "/api/admin/resume-config") {
    const session = requireAdminSession(req, res, { requireCsrf: false });

    if (!session) {
      return;
    }

    const config = await readResumeConfig();
    sendJson(res, 200, config);
    return;
  }

  if (req.method === "GET" && route === "/api/admin/messages") {
    const session = requireAdminSession(req, res, { requireCsrf: false });

    if (!session) {
      return;
    }

    const messageLog = await readJson(MESSAGES_FILE, []);
    const safeLog = Array.isArray(messageLog) ? messageLog.slice().reverse() : [];
    sendJson(res, 200, safeLog);
    return;
  }

  if (req.method === "POST" && route === "/api/admin/resume-config") {
    const session = requireAdminSession(req, res, { requireCsrf: true });

    if (!session) {
      return;
    }

    let payload;

    try {
      payload = await parseJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { ok: false, error: error.message || "Invalid request body." });
      return;
    }

    const templates = await readJobProfiles();
    const normalized = normalizeResumeConfigPayload(payload, templates);

    if (Object.keys(normalized.errors).length > 0) {
      sendJson(res, 400, { ok: false, error: "Validation failed.", fields: normalized.errors });
      return;
    }

    await writeJson(RESUME_CONFIG_FILE, normalized.value);

    sendJson(res, 200, {
      ok: true,
      message: "Resume configuration saved.",
      config: normalized.value
    });
    return;
  }

  if (req.method === "POST" && route === "/api/admin/resume-preview") {
    const session = requireAdminSession(req, res, { requireCsrf: true });

    if (!session) {
      return;
    }

    let payload;

    try {
      payload = await parseJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { ok: false, error: error.message || "Invalid request body." });
      return;
    }

    const templates = await readJobProfiles();
    const normalized = normalizeResumeConfigPayload(payload, templates);

    if (Object.keys(normalized.errors).length > 0) {
      sendJson(res, 400, { ok: false, error: "Validation failed.", fields: normalized.errors });
      return;
    }

    const context = await resolveResumeDocument(normalized.value.selectedProfileId, normalized.value.answers);
    sendJson(res, 200, {
      ok: true,
      template: context.template,
      resume: context.document,
      analysis: buildResumeAnalysis(context.document, context.template)
    });
    return;
  }

  if (req.method === "POST" && route === "/api/admin/sync") {
    const session = requireAdminSession(req, res, { requireCsrf: true });

    if (!session) {
      return;
    }

    githubCache.expiresAt = 0;
    linkedinCache.expiresAt = 0;
    await buildShowcasePayload();

    sendJson(res, 200, {
      ok: true,
      message: "Data sync completed.",
      syncedAt: new Date().toISOString()
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Admin API route not found." });
}

async function handleApiRoutes(req, res, requestUrl) {
  if (requestUrl.pathname.startsWith("/api/admin/")) {
    await handleAdminRoutes(req, res, requestUrl);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/showcase") {
    const showcase = await buildShowcasePayload();
    sendJson(res, 200, showcase);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/github") {
    const showcase = await buildShowcasePayload();
    sendJson(res, 200, showcase.github || {});
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/linkedin") {
    const showcase = await buildShowcasePayload();
    sendJson(res, 200, showcase.linkedin || {});
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/job-profiles") {
    const templates = await readJobProfiles();
    const safeTemplates = templates.map((template) => ({
      id: template.id,
      title: template.title,
      objective: template.objective,
      keywordTargets: template.keywordTargets,
      questionSet: template.questionSet
    }));
    sendJson(res, 200, safeTemplates);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/portfolio") {
    const portfolio = await readJson(PORTFOLIO_FILE, {});
    sendJson(res, 200, portfolio);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/projects") {
    const showcase = await buildShowcasePayload();
    const projects = Array.isArray(showcase.featuredProjects) ? showcase.featuredProjects : [];
    sendJson(res, 200, projects);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/resume") {
    const profileId = safeString(requestUrl.searchParams.get("profileId"), 80);
    const context = await resolveResumeDocument(profileId, null);

    sendJson(res, 200, {
      ok: true,
      template: context.template,
      resume: context.document,
      analysis: buildResumeAnalysis(context.document, context.template)
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/resume/analysis") {
    const profileId = safeString(requestUrl.searchParams.get("profileId"), 80);
    const context = await resolveResumeDocument(profileId, null);
    sendJson(res, 200, {
      ok: true,
      template: context.template,
      analysis: buildResumeAnalysis(context.document, context.template)
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/resume/download") {
    const format = safeString(requestUrl.searchParams.get("format"), 10).toLowerCase() || "txt";
    const profileId = safeString(requestUrl.searchParams.get("profileId"), 80);
    const context = await resolveResumeDocument(profileId, null);
    const fileNameBase = buildResumeFileName(context.document.contact.name, context.document.targetRole);

    if (format === "html") {
      const html = resumeToHtml(context.document);
      res.setHeader("Content-Disposition", `attachment; filename="${fileNameBase}.html"`);
      send(res, 200, html, "text/html; charset=utf-8");
      return;
    }

    const text = resumeToText(context.document);
    res.setHeader("Content-Disposition", `attachment; filename="${fileNameBase}.txt"`);
    send(res, 200, text, "text/plain; charset=utf-8");
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "portfolio-api",
      githubCache: {
        hasCachedValue: Boolean(githubCache.value),
        expiresInMs: Math.max(githubCache.expiresAt - Date.now(), 0)
      },
      linkedinCache: {
        hasCachedValue: Boolean(linkedinCache.value),
        expiresInMs: Math.max(linkedinCache.expiresAt - Date.now(), 0)
      },
      security: {
        adminSession: "cookie+csrf",
        contactRateLimit: `${CONTACT_RATE_MAX}/hour`
      }
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/contact") {
    const ip = getClientIp(req);
    const rate = consumeRateLimit(contactRateMap, ip, CONTACT_RATE_MAX, CONTACT_RATE_WINDOW_MS);

    if (rate.limited) {
      res.setHeader("Retry-After", String(rate.retryAfterSec));
      sendJson(res, 429, { ok: false, error: "Too many submissions. Please try again later." });
      return;
    }

    let payload;

    try {
      payload = await parseJsonBody(req);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { ok: false, error: error.message || "Invalid request body." });
      return;
    }

    const { errors, value } = normalizeContactPayload(payload);

    if (Object.keys(errors).length > 0) {
      sendJson(res, 400, { ok: false, error: "Validation failed.", fields: errors });
      return;
    }

    const messageLog = await readJson(MESSAGES_FILE, []);
    const safeLog = Array.isArray(messageLog) ? messageLog : [];
    const nextMessage = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      submittedAt: new Date().toISOString(),
      ...value
    };

    safeLog.push(nextMessage);
    await writeJson(MESSAGES_FILE, safeLog);

    sendJson(res, 201, {
      ok: true,
      message: "Message received. Thanks for reaching out."
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "API route not found." });
}

async function handleResumePage(req, res, requestUrl) {
  const profileId = safeString(requestUrl.searchParams.get("profileId"), 80);
  const context = await resolveResumeDocument(profileId, null);
  const html = resumeToHtml(context.document);
  send(res, 200, html, "text/html; charset=utf-8");
}

async function handleStaticRoutes(req, res, requestUrl) {
  const fileName = STATIC_FILES.get(requestUrl.pathname);

  if (!fileName) {
    send(res, 404, "Not Found");
    return;
  }

  const filePath = path.join(ROOT_DIR, fileName);

  try {
    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    applySecurityHeaders(res);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.end(fileBuffer);
  } catch {
    send(res, 404, "File not found.");
  }
}

async function ensureDataStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const existingMessages = await readJson(MESSAGES_FILE, null);
  if (!Array.isArray(existingMessages)) {
    await writeJson(MESSAGES_FILE, []);
  }

  const existingProfiles = await readJson(JOB_PROFILES_FILE, null);
  if (!Array.isArray(existingProfiles) || existingProfiles.length === 0) {
    await writeJson(JOB_PROFILES_FILE, DEFAULT_JOB_PROFILES);
  }

  const existingResumeConfig = await readJson(RESUME_CONFIG_FILE, null);
  if (!existingResumeConfig || typeof existingResumeConfig !== "object") {
    await writeJson(RESUME_CONFIG_FILE, defaultResumeConfig());
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      send(res, 400, "Malformed request.");
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/resume") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        send(res, 405, "Method Not Allowed");
        return;
      }

      await handleResumePage(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApiRoutes(req, res, requestUrl);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "Method Not Allowed");
      return;
    }

    await handleStaticRoutes(req, res, requestUrl);
  } catch (error) {
    console.error("Unhandled server error:", error);
    sendJson(res, 500, { ok: false, error: "Internal server error." });
  }
});

ensureDataStorage()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Portfolio app running at http://localhost:${PORT}`);
      console.log(`Showcase API available at http://localhost:${PORT}/api/showcase`);
      console.log(`Resume download API: http://localhost:${PORT}/api/resume/download?format=txt`);
      console.log(`Admin studio: http://localhost:${PORT}/admin`);

      if (ADMIN_PASSWORD_SOURCE === "generated") {
        console.log("\n[Security Notice] ADMIN_PASSWORD was not set.");
        console.log(`[Security Notice] Temporary admin password for this session: ${ADMIN_PASSWORD}`);
        console.log("[Security Notice] Set ADMIN_PASSWORD in environment for persistent secure admin login.\n");
      }
    });
  })
  .catch((error) => {
    console.error("Unable to initialize data storage:", error);
    process.exit(1);
  });
