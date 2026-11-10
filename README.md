# Startup Radar

**Find startups and companies by niche and region, with YC discovery and junior remote jobs together in one workspace.**

Startup information is spread across Y Combinator, company websites and job boards. Startup Radar puts it in one place:
pick a **niche** and a **region**, explore matching companies and early-career roles, check the original sources, and save a shortlist.

- **Niches:** ☁️ Cloud & DevOps · 🛡️ Cybersecurity · 🤖 Agentic AI & Automation
- **Regions:** Remote/Worldwide, North America, Europe, United Kingdom, Middle East & North Africa, South Asia (Pakistan, India…), East & Southeast Asia, Latin America, Sub-Saharan Africa, Australia & Oceania

No API keys, no database, no paid services. It runs on Vercel's free Hobby plan.

---

## Features

| View | What it does |
| --- | --- |
| **YC Startups** | ~1,500 YC companies in the three niches. Filter by region, batch, *hiring*, *remote-friendly* and *active*, and search by name, tags or description. Each card links to the company's YC profile and website. |
| **Companies** | A hand-picked directory of 60 cloud, security and automation companies, including **European startups that aren't YC-backed** (n8n, Parloa, Dust, H Company, Lovable, ElevenLabs, ParakeetAI, Tines, Nebius, Kestra…) and companies in Pakistan and the Middle East. For 29 of them, **open roles are counted live** from their public careers board. Filters: *startups only*, *hiring now*, *not YC-backed* and *remote-friendly*. Companies whose website also appears in the YC data are automatically labelled *YC-backed*. |
| **Junior Jobs** | Jobs from four remote job feeds plus the companies' own careers pages, filtered by niche (using the job **title**), region and experience level (*hide senior roles*, *junior & entry only*, or *all*). Every job links to its original listing and credits its source. |
| **★ Watchlist** | Save any company with one click, even if it isn't hiring today. You can add personal notes and export the list as JSON. Everything is stored in **your browser only** (localStorage). |

Other details:
- **Fails gracefully.** If one job feed is down, the others still show, and a coloured pill tells you which source failed. Each tab loads on its own, so a YC outage doesn't affect the jobs view.
- Responsive on phones and desktops. A ☀️/🌙 button switches between light and dark mode (it follows your device setting until you choose), keyboard-navigable tabs, and no tracking.
- Your niche, region and tab choices are remembered between visits.

---

## How it works

```
 Browser (public/)                         Vercel serverless functions (api/)
 ───────────────────                       ──────────────────────────────────
 index.html + app.js                       /api/yc   ──► yc-oss.github.io (YC dataset)
   │  fetch('/api/yc')    ───────────────►
   │  fetch('/api/jobs')  ───────────────► /api/jobs ──► Remotive, Remote OK, Jobicy, Himalayas
   │  fetch('/data/companies.json')                     + company careers boards (Ashby, Greenhouse, Lever)
   │                                         (all fetched in parallel; failures isolated)
   ▼
 filters by niche / region / level in the browser
 saves watchlist to localStorage
```

1. **Why serverless functions?** Browsers block a web page from reading data from most other websites, unless those sites allow it (a rule called CORS). Our `/api` functions run on Vercel's servers, where that rule doesn't apply. They fetch the feeds and pass clean JSON to our page.
2. **Server side:** the functions download each source, keep only items that match a niche, trim each item to the fields we show, and add a source credit.
3. **Browser side:** region, level, batch and text filters run in your browser on the downloaded list, so changing a filter is instant.
4. **Caching:** responses are sent with `Cache-Control: s-maxage=…`, so Vercel's CDN keeps one shared copy for about 6 hours. Most visits never reach the upstream feeds, which respects their rate limits and keeps us well within the free plan. Each function also keeps a copy in memory, and if a source fails it serves the last good copy (marked "cached").
5. **Niche rules** (keywords, YC tags) and **region rules** live in one shared file, [`public/js/taxonomy.js`](public/js/taxonomy.js). Both the browser and the API import it.

### Why jobs are matched by title
Job feeds attach loose tags. A generic "Software Engineer" ad is often tagged *cloud* or *devops*, so matching on tags let generic software roles show up under Cloud. Matching on the **title**, with a list of words to exclude, keeps each niche relevant.

---

## Folder structure

```
startup-radar/
├── api/                        # Vercel serverless functions: each file = one URL
│   ├── yc.js                   # GET /api/yc   → YC companies in our niches
│   ├── jobs.js                 # GET /api/jobs → merged job feeds + per-source status
│   └── _lib/                   # private helpers ("_" = not exposed as a URL)
│       ├── fetch-helpers.js    # fetch with timeout, in-memory cache, JSON responses
│       ├── job-filters.js      # niche + experience-level rules for job titles
│       └── sources/            # one adapter per job feed → common job shape
│           ├── company-boards.js # live openings from companies' Ashby/Greenhouse/Lever boards
│           ├── remotive.js
│           ├── remoteok.js
│           ├── jobicy.js
│           └── himalayas.js
├── public/                     # static site served by Vercel
│   ├── index.html              # page layout
│   ├── css/styles.css          # design tokens, light/dark mode, responsive layout
│   ├── js/
│   │   ├── app.js              # state, filters, event handling, rendering loop
│   │   ├── taxonomy.js         # niches, regions, junior/senior words (shared with /api)
│   │   ├── api-client.js       # safe fetch wrappers → { data, error }
│   │   ├── render.js           # HTML card templates (with escaping)
│   │   ├── watchlist.js        # localStorage save / remove / notes / export
│   │   └── theme.js            # light/dark toggle
│   └── data/companies.json     # the hand-picked company directory
├── scripts/dev-server.js       # zero-dependency local server that mimics Vercel
├── vercel.json                 # output folder, function limits, security headers
├── package.json                # "npm run dev"
├── .gitignore
├── LICENSE                     # MIT licence
└── README.md
```

---

## Data sources and attribution

Every company and job in the app links to its original source. This table lists each source's usage rules and how we follow them.

| Source | What we use | Their rules | How we comply |
| --- | --- | --- | --- |
| [yc-oss/api](https://github.com/yc-oss/api) | YC company profiles (unofficial, community-maintained, rebuilt daily from YC's public directory) | Unofficial; no formal terms | Credited in the YC tab and footer. Each card links to the company's official **YC profile** page. We state that we're not affiliated with Y Combinator. Cached for 6 hours. |
| [Remotive](https://remotive.com/api-documentation) | Remote jobs | Link back to the Remotive job URL **and** name Remotive as the source. Request at most ~4 times a day. Don't redistribute to other job boards or put listings behind sign-ups. (Free listings are delayed 24 hours.) | Each job says "View on Remotive" and "via Remotive". Cached for 6 hours. No sign-ups, no redistribution. |
| [Remote OK](https://remoteok.com/api) | Remote jobs | Link back to the Remote OK URL with a normal (not `nofollow`) link and name "Remote OK". Don't use their logo. | Normal links with "via Remote OK". No logos (we show initials avatars). Custom User-Agent sent. |
| [Jobicy](https://jobi.cy/apidocs) | Remote jobs | Credit Jobicy with a direct link. Apply buttons must go to the original job URL. | "View on Jobicy" opens the original URL from the feed. Credit link on every job. |
| [Himalayas](https://himalayas.app/api) | Remote jobs (search endpoint) | Credit Himalayas and link back. Don't resubmit jobs to other boards. | "View on Himalayas" plus a credit link. Searches cached for 6 hours. |
| Company careers boards: [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api), [Greenhouse](https://developers.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api) | Live open roles for directory companies that have a `jobBoard` (n8n, Canonical, Celonis, Tines…) | Public, read-only job-board APIs that employers switch on so their openings can be shown elsewhere | Each job links to the official posting and is credited, e.g. "via n8n careers (Ashby)". Cached for 3 hours. |
| Official company websites | Company directory (`public/data/companies.json`) | n/a | Each entry links to the company's own website and careers page. Last reviewed 2026-11-10. |

**Limits:** Startup Radar doesn't cover every startup or vacancy in the world. Hiring, remote and level labels come from the sources or are guessed from titles, so **always confirm on the original listing.**

---

## Run it locally

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)). There's nothing to install, because the project has no dependencies.

```bash
git clone https://github.com/Zayan9484/startup-radar.git
cd startup-radar
npm run dev
```

Open **http://localhost:3000**. The terminal prints each request. Press `Ctrl + C` to stop.

> Port 3000 is busy? Use another one: on Windows PowerShell run `$env:PORT=4000; npm run dev`; on macOS or Linux run `PORT=4000 npm run dev`.

`scripts/dev-server.js` serves `public/` and sends `/api/<name>` to `api/<name>.js`, just like Vercel. If you edit a file in `api/`, restart the server to load the change. Frontend changes only need a browser refresh.

(Optional) If you have the Vercel CLI, `npx vercel dev` also works.

---

## Deploy on Vercel (free Hobby plan)

1. Push this project to a GitHub repository.
2. Sign in at [vercel.com](https://vercel.com) with GitHub, then choose **Add New… → Project** and **Import** the repository.
3. Leave the settings at their defaults. **Framework Preset:** *Other*. **Build Command:** empty. `vercel.json` already sets the output directory to `public`.
4. Click **Deploy**. About a minute later the site is live at `https://<project-name>.vercel.app`.

No environment variables are needed. Every later `git push` to the main branch redeploys automatically.

**CLI alternative:** `npx vercel` (preview) and then `npx vercel --prod`.

---

## Customising

- **Add a niche or region:** add an entry to `NICHES` or `REGIONS` in [`public/js/taxonomy.js`](public/js/taxonomy.js). The chips, dropdown and filters update automatically.
- **Add a company to the directory:** copy an entry in [`public/data/companies.json`](public/data/companies.json). Use region ids from `taxonomy.js`, niche ids `cloud`, `security` or `agentic`, and `kind` set to `startup` or `established`. Optional fields: `ycBatch` (e.g. `"W25"`) labels a YC-backed company even if the YC data doesn't tag it in a niche, and `careersUrl` can be `null` when a company has no public careers page.
- **Show live openings for a company:** add `"jobBoard": { "type": "ashby", "token": "n8n" }` to its entry in `companies.json`. `type` can be `ashby`, `greenhouse` or `lever`, and `token` is the last part of the board URL (`jobs.ashbyhq.com/<token>`, `job-boards.greenhouse.io/<token>`, `jobs.lever.co/<token>`). Restart `npm run dev` to load it.
- **Add a new job feed:** create `api/_lib/sources/<name>.js` that exports `{ id, name, homepage, ttlMs, load() }` returning the common job shape, then add it to `SOURCES` in [`api/jobs.js`](api/jobs.js). Check the feed's terms first.

---

## Security and privacy

- No secrets: the project uses no API keys, and `.gitignore` blocks `.env*` files anyway.
- All text from external sources is HTML-escaped before display, and only `http(s)` links are allowed.
- The watchlist never leaves your browser.
- `vercel.json` adds basic security headers (`nosniff`, `X-Frame-Options`, `Referrer-Policy`).

---

## License

[MIT](LICENSE) © 2026 Muhammad Zayan. You're free to use, change and share this code; please keep the copyright notice.

The licence covers this project's code only. Job listings and company data belong to their original sources and follow those sources' terms (see [Data sources and attribution](#data-sources-and-attribution)).

---

*Startup Radar is an independent project. It is not affiliated with Y Combinator, Remotive, Remote OK, Jobicy, Himalayas, Greenhouse, Canonical, or any company listed.*
