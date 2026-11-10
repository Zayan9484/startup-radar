/**
 * taxonomy.js — the single source of truth for NICHES and REGIONS.
 *
 * This file is shared by BOTH sides of the app:
 *   - the browser imports it from /js/taxonomy.js
 *   - the serverless functions in /api import it with a relative path
 * Keeping the rules in one place means the server and the page can never
 * disagree about what "Cybersecurity" or "South Asia" means.
 *
 * To add a niche or region, add an entry here — nothing else needs to change.
 */

/* ------------------------------------------------------------------ */
/* NICHES                                                              */
/* ------------------------------------------------------------------ */
/*
 * Each niche has two sets of rules:
 *
 *  yc   → how to recognise a YC company in this niche, using the tags and
 *         sub-industry that YC itself assigns, plus a few text keywords.
 *
 *  jobs → how to recognise a JOB in this niche. We match on the job TITLE
 *         only. Job feeds attach lots of loose tags (a generic "Software
 *         Engineer" ad is often tagged "cloud" or "devops"), so matching on
 *         tags let generic software roles leak into Cloud. Titles are much
 *         more honest about what the role actually is.
 */
export const NICHES = [
  {
    id: 'cloud',
    label: 'Cloud & DevOps',
    emoji: '☁️',
    description: 'Infrastructure, platform engineering, SRE, Kubernetes and cloud tooling.',
    yc: {
      tags: ['Cloud Computing', 'DevOps', 'Infrastructure', 'Kubernetes', 'AIOps', 'FinOps', 'Monitoring'],
      subindustries: ['B2B -> Infrastructure'],
      keywords: [],
    },
    jobs: {
      // A title must contain one of these words…
      include: [
        'devops', 'dev ops', 'sre', 'site reliability', 'cloud', 'platform engineer',
        'infrastructure', 'kubernetes', 'k8s', 'sysadmin', 'system administrator',
        'systems administrator', 'linux', 'aws', 'azure', 'gcp',
        'network engineer', 'release engineer', 'build engineer', 'observability',
        'finops', 'terraform', 'ubuntu',
      ],
      // …and must NOT contain these (keeps sales/marketing "cloud" jobs out).
      exclude: ['sales', 'salesforce', 'account executive', 'marketing', 'recruiter', 'customer success', 'business development'],
    },
  },
  {
    id: 'security',
    label: 'Cybersecurity',
    emoji: '🛡️',
    description: 'Application, cloud and network security, identity, threat detection and GRC.',
    yc: {
      tags: [
        'Security', 'Cybersecurity', 'DevSecOps', 'Identity', 'Privacy', 'Fraud Detection',
        'Fraud Prevention', 'Cloud Workload Protection', 'Next-gen Network Security', 'IoT Security',
        'Security Orchestration, Automation and Response (SOAR)',
      ],
      subindustries: ['B2B -> Security'],
      keywords: [],
    },
    jobs: {
      include: [
        'security', 'cyber', 'cybersecurity', 'infosec', 'soc analyst', 'soc engineer', 'penetration', 'pentest', 'pentester',
        'appsec', 'threat', 'vulnerability', 'identity and access', 'iam ', 'grc',
        'incident response', 'detection engineer', 'devsecops', 'red team', 'blue team',
        'forensic', 'malware', 'privacy engineer',
      ],
      exclude: ['security guard', 'security officer', 'physical security', 'social security', 'sales', 'account executive', 'marketing', 'recruiter'],
    },
  },
  {
    id: 'agentic',
    label: 'Agentic AI & Automation',
    emoji: '🤖',
    description: 'AI agents, LLM applications, workflow automation and RPA.',
    yc: {
      tags: ['AI Assistant', 'Workflow Automation', 'Robotic Process Automation', 'Automation', 'Conversational AI'],
      subindustries: [],
      // A company also counts if its one-liner talks about agents.
      keywords: ['ai agent', 'agentic', 'ai agents', 'autonomous agent'],
    },
    jobs: {
      include: [
        'ai engineer', 'ai developer', 'ai/ml', 'ml engineer', 'machine learning', 'llm',
        'agent', 'agents', 'agentic', 'genai', 'generative ai', 'automation', 'rpa', 'mlops',
        'nlp', 'prompt engineer', 'applied ai', 'ai specialist', 'ai solutions',
      ],
      // Data-labelling gig work is a different kind of job; keep it out.
      exclude: ['trainer', 'annotation', 'annotator', 'qa', 'test automation', 'labeling', 'labelling', 'rater', 'sales', 'account executive', 'marketing', 'recruiter', 'insurance agent', 'travel agent', 'real estate agent', 'customer service agent', 'support agent'],
    },
  },
];

/* ------------------------------------------------------------------ */
/* REGIONS                                                             */
/* ------------------------------------------------------------------ */
/*
 * Each region has:
 *  ycRegions   → region/country names exactly as they appear in YC data
 *  jobKeywords → lowercase words we look for in a job's location text
 *                (feeds write locations freely: "USA", "EMEA", "Worldwide"…)
 */
export const REGIONS = [
  {
    id: 'any',
    label: 'Anywhere',
    ycRegions: [],      // empty = no filter
    jobKeywords: [],
  },
  {
    id: 'remote',
    label: 'Remote / Worldwide',
    ycRegions: ['Remote', 'Fully Remote', 'Partly Remote'],
    jobKeywords: ['worldwide', 'anywhere', 'global', 'remote'],
  },
  {
    id: 'north-america',
    label: 'North America',
    ycRegions: ['America / Canada', 'United States of America', 'Canada', 'Mexico'],
    jobKeywords: ['usa', 'united states', 'us only', 'u.s.', 'canada', 'north america', 'americas', 'mexico', 'est', 'pst', 'new york', 'san francisco'],
  },
  {
    id: 'europe',
    label: 'Europe',
    ycRegions: ['Europe', 'United Kingdom', 'France', 'Germany', 'Spain', 'Sweden', 'Netherlands', 'Denmark', 'Switzerland', 'Norway', 'Ireland', 'Poland', 'Portugal', 'Slovenia', 'Austria', 'Finland', 'Romania', 'Czechia', 'Italy', 'Estonia', 'Belgium', 'Greece', 'Ukraine', 'Croatia', 'Bulgaria', 'Hungary', 'Latvia', 'Lithuania', 'Iceland', 'Cyprus'],
    jobKeywords: ['europe', 'emea', 'eu ', 'european', 'uk', 'united kingdom', 'germany', 'france', 'spain', 'netherlands', 'poland', 'portugal', 'ireland', 'sweden', 'romania', 'italy', 'cet', 'gmt', 'london', 'berlin'],
  },
  {
    id: 'uk',
    label: 'United Kingdom',
    ycRegions: ['United Kingdom'],
    jobKeywords: ['uk', 'united kingdom', 'england', 'london', 'scotland', 'gmt'],
  },
  {
    id: 'middle-east',
    label: 'Middle East & North Africa',
    ycRegions: ['Middle East and North Africa', 'United Arab Emirates', 'Israel', 'Saudi Arabia', 'Egypt', 'Turkey', 'Jordan', 'Bahrain', 'Iraq', 'Morocco', 'Algeria'],
    jobKeywords: ['middle east', 'mena', 'emea', 'uae', 'united arab emirates', 'dubai', 'abu dhabi', 'saudi', 'riyadh', 'qatar', 'egypt', 'israel', 'turkey', 'gulf'],
  },
  {
    id: 'south-asia',
    label: 'South Asia (Pakistan, India…)',
    ycRegions: ['South Asia', 'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka'],
    jobKeywords: ['pakistan', 'lahore', 'karachi', 'islamabad', 'india', 'bangalore', 'bengaluru', 'south asia', 'bangladesh', 'sri lanka', 'nepal', 'apac', 'asia'],
  },
  {
    id: 'asia-pacific',
    label: 'East & Southeast Asia',
    ycRegions: ['Southeast Asia', 'East Asia', 'Singapore', 'Indonesia', 'Philippines', 'Malaysia', 'Vietnam', 'Hong Kong', 'South Korea', 'Japan', 'China', 'Taiwan', 'Thailand', 'Asia'],
    jobKeywords: ['apac', 'asia', 'singapore', 'philippines', 'indonesia', 'malaysia', 'vietnam', 'japan', 'korea', 'hong kong', 'taiwan', 'thailand'],
  },
  {
    id: 'latam',
    label: 'Latin America',
    ycRegions: ['Latin America', 'Brazil', 'Mexico', 'Colombia', 'Argentina', 'Chile', 'Peru', 'Uruguay', 'Panama', 'Ecuador', 'Costa Rica', 'Venezuela', 'Puerto Rico'],
    jobKeywords: ['latam', 'latin america', 'south america', 'brazil', 'mexico', 'colombia', 'argentina', 'chile', 'peru', 'americas'],
  },
  {
    id: 'africa',
    label: 'Sub-Saharan Africa',
    ycRegions: ['Africa', 'Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Senegal', 'Uganda', 'Tanzania', 'Ethiopia', 'Zambia', 'Namibia', 'Ivory Coast'],
    jobKeywords: ['africa', 'nigeria', 'kenya', 'ghana', 'south africa', 'emea'],
  },
  {
    id: 'oceania',
    label: 'Australia & Oceania',
    ycRegions: ['Oceania', 'Australia', 'New Zealand'],
    jobKeywords: ['australia', 'new zealand', 'oceania', 'apac', 'sydney', 'melbourne'],
  },
];

/* ------------------------------------------------------------------ */
/* EXPERIENCE LEVEL (for the Junior Jobs view)                         */
/* ------------------------------------------------------------------ */

/** Words in a title that mean "this is an early-career role". */
export const JUNIOR_WORDS = [
  'junior', 'jr', 'entry', 'entry-level', 'graduate', 'grad', 'new grad', 'intern',
  'internship', 'trainee', 'apprentice', 'associate', 'early career', 'early-career',
  'level i', 'level 1', 'fellowship',
];

/** Words in a title that mean "this role is NOT for beginners". */
export const SENIOR_WORDS = [
  'senior', 'sr', 'staff', 'principal', 'lead', 'head', 'manager', 'director',
  'architect', 'vp', 'vice president', 'chief', 'expert', 'distinguished', 'founding',
  'level iii', 'level 3', 'iii', 'iv',
];

/* ------------------------------------------------------------------ */
/* Small helpers that use the lists above                              */
/* ------------------------------------------------------------------ */

/** Find a niche by id (returns undefined if not found). */
export const getNiche = (id) => NICHES.find((n) => n.id === id);

/** Find a region by id, falling back to "Anywhere". */
export const getRegion = (id) => REGIONS.find((r) => r.id === id) || REGIONS[0];

/**
 * Does `text` contain `word` as a whole word (or phrase)?
 * "lead" should match "Team Lead" but not "Leadership" or "Mislead".
 * We pad both sides with spaces after replacing punctuation with spaces.
 */
export function hasWord(text, word) {
  const clean = ` ${String(text).toLowerCase().replace(/[^a-z0-9+#/]+/g, ' ')} `;
  const w = ` ${word.toLowerCase().replace(/[^a-z0-9+#/]+/g, ' ').trim()} `;
  return clean.includes(w);
}

/** Does `text` contain any of `words` as a whole word/phrase? */
export const hasAnyWord = (text, words) => words.some((w) => hasWord(text, w));
