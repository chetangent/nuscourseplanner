# NUS Course Planner

Use it as a local website:

1. Run:
   `python3 /Users/Chetan/Documents/New\ project/nus-course-planner/server.py`
2. Open:
   [http://127.0.0.1:4173](http://127.0.0.1:4173)

You can still open [index.html](/Users/Chetan/Documents/New%20project/nus-course-planner/index.html) directly, but the local website route is better for live API requests.

Deploy it as a live website:

- Vercel: import the `nus-course-planner` folder as a project. It is a static site, so no build command is needed.
- Netlify: drag the `nus-course-planner` folder into Netlify Drop or connect it as a repo. `netlify.toml` is already included.
- GitHub Pages: this folder now includes a ready-to-use GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.

GitHub repo setup:

1. `cd /Users/Chetan/Documents/New\ project/nus-course-planner`
2. `git init`
3. `git add .`
4. `git commit -m "Initial NUS course planner"`
5. Create an empty GitHub repo named something like `nus-course-planner`
6. `git remote add origin <your-repo-url>`
7. `git branch -M main`
8. `git push -u origin main`

GitHub Pages publishing:

1. Push the repo to GitHub
2. In GitHub, open `Settings` -> `Pages`
3. Under `Build and deployment`, choose `GitHub Actions`
4. The included workflow will publish the site automatically on pushes to `main`

Notes for live hosting:

- The app fetches live data from `https://api.nusmods.com/v2/...`, and that API currently sends `Access-Control-Allow-Origin: *`, so browser-side fetches are allowed.
- The current default academic year comes from the browser date; you can change it in the UI if you want to plan against a different NUSMods catalog year.

What it does:

- Plans 8 semesters across 4 years.
- Mirrors the spreadsheet's CAP flow with pre-S/U and post-S/U calculations.
- Shows honours classification from the post-S/U CAP.
- Tracks MC progress and requirement buckets.
- Searches live NUSMods data by academic year and lets you add modules straight into a semester.
- Checks semester availability and performs a best-effort prerequisite evaluation using earlier semesters in your plan.

Notes:

- The planner saves into browser `localStorage`.
- Requirement buckets are editable because different NUS programmes have different audit rules.
- Prerequisite parsing is best-effort for complex rules with non-course conditions.
