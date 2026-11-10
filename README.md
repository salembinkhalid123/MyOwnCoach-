# MyOwnCoach – Gym Tracker

A free, offline, mobile-first gym tracker you install on your phone's home screen.
No accounts, no servers, no paid APIs. All data is stored on your phone.

- **Workout**: Push → Pull → Legs → Upper → Lower rotation, log weight × reps for each set, see last time, get double-progression suggestions, and get a highlight when you hit a PR.
- **Progress**: weekly breakdown (best set + volume), top-weight chart, and a full workout history you can edit or delete.
- **Calories**: daily counter (2200 kcal by default), food log, End Day, and history.
- **Settings**: calorie goal, next rotation day, add, rename, reorder or remove exercises per day, export/import a backup.

## Deploy for free on GitHub Pages

1. Open the repository on GitHub (`salembinkhalid123/MyOwnCoach-`).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **main** and folder **/ (root)**, then tap **Save**.
5. Wait 1–2 minutes. The page shows your URL, for example
   `https://salembinkhalid123.github.io/MyOwnCoach-/`.

> GitHub Pages is free for **public** repositories. If the repository is private and Pages isn't offered, either make it public (your workout data is NOT in the repo, it only lives on your phone) or use Netlify as described below.

### Alternative: Netlify (free)

1. Sign in at netlify.com with GitHub → **Add new site → Import an existing project**.
2. Pick this repository. Leave the build command empty and set the publish directory to `/`.
3. Tap **Deploy**. You get a free `https://<name>.netlify.app` URL.

## Install on your phone

**iPhone (Safari):** open the URL → tap **Share** → **Add to Home Screen** → **Add**.
**Android (Chrome):** open the URL → tap **⋮** → **Install app** (or **Add to Home screen**).

Open it once while online. After that it works fully offline.

## Your data

- Everything is saved in your browser's local storage **on that phone only**.
- Use **Settings → Export backup** regularly. On a phone this opens the share sheet, where you can pick "Save to Files", Google Drive, etc.
- Use **Settings → Import backup** to restore (e.g. on a new phone). This replaces all current data.
- Open the app from the home-screen icon rather than a browser tab. iOS can clear data for websites you don't visit for a while, but home-screen apps are kept.

## How things work

- **Shared history:** exercises with the same name are one exercise. Lat Pulldown on Pull and on Upper share history, so "Last time" shows the most recent session from either day.
- **Suggestion (double progression):** if you did 12+ reps on every set last time, it suggests +2.5 kg. Otherwise it suggests the same weight and tells you to beat last time's reps. Grey placeholder numbers show the suggestion. If you leave kg empty, the suggested weight is used.
- **PRs:** a set gets a 🏆 badge if it beats your best weight (*Weight PR*), your best weight × reps (*Set PR*), or your best reps at your best weight (*Rep PR*). The first session of an exercise is never counted as a PR.
- **Weeks:** Week 1 is the Monday–Sunday week of your first session for that exercise.
- **Finish workout** saves the session and moves the rotation to the day after the one you trained, so picking a day manually works too.

## Project structure

```
index.html              App shell + bottom navigation
manifest.webmanifest    PWA manifest (name, icons, colors)
sw.js                   Service worker (offline cache), bump CACHE_VERSION after changes
css/styles.css          All styles (dark theme variables at the top)
icons/                  App icons
js/app.js               Entry point + tab router
js/defaults.js          Default days/exercises, calorie goal, progression rule
js/store.js             All data + persistence (localStorage), backup import/export
js/logic.js             History, PRs, suggestions, weekly stats
js/ui.js                Toasts, dialogs, full-screen sheets
js/utils.js             Date/number helpers
js/components/          Sets editor, line chart
js/pages/               workout.js, progress.js, calories.js, settings.js
```

**After changing any file**, increase `CACHE_VERSION` in `sw.js` (e.g. `myowncoach-v2`). Otherwise installed phones keep using the cached old version. Close and reopen the app twice to get the update.

## Run locally

Any static server works, for example:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.
