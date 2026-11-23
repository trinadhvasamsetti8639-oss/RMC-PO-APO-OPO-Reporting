# Polling Duty Attendance App (GitHub Pages + Google Sheets)

All data (users, passwords, attendance, assignments, distribution, geofence, uploaded employee data) is stored permanently in **your own Google Sheet**, through a small Google Apps Script web app (`Code.gs`). The front end is static and hosted on GitHub Pages.

## 1. Set up the Google Sheet backend
1. Create a new Google Sheet (any name).
2. Open **Extensions > Apps Script**, delete the sample code, paste the whole of `Code.gs`, and save.
3. Click **Deploy > New deployment > Web app**. Set *Execute as*: **Me**, *Who has access*: **Anyone**. Deploy and authorise when asked.
4. Copy the **Web app URL** (ends with `/exec`).
5. Open the web app URL once in a browser - it should say "Attendance API is running". The tabs Users, Settings, Attendance, Assignments, Datasets and Distribution are created automatically on first use, with the login `admin` / `admin123`.
6. After you edit `Code.gs` later: **Deploy > Manage deployments > Edit > New version > Deploy**.

Passwords are stored only as salted SHA-256 hashes in the Users tab. Do not edit the Attendance/Assignments/Distribution tabs by hand while polling is in progress.

## 2. Publish the front end
1. Edit `config.js`: paste the Web app URL into `API_URL` (and an optional Google Maps key into `GOOGLE_MAPS_KEY`).
2. Upload all files to a GitHub repo root; Settings > Pages > deploy from `main` / root.
3. Log in as `admin` / `admin123` and **change that password immediately** (Admin > Users).

Leave `API_URL` empty for demo mode (data kept only in that browser): `admin/admin123`, `user/user123`, `ro/ro123` (stations 1-5), `sec/sec123`, `dist/dist123`, `display/led123`.

## Roles
| Role | Can do |
|---|---|
| admin | Everything: capture, assign reserve, distribution, geofence, users, clear attendance, replace/update employee database |
| user | Capture attendance (team / reserve), reports, dashboard, distribution (view) |
| ro | Reports, dashboard and distribution for the stations assigned by admin only; call buttons for absentees |
| sec (Administrative Secretary) | Assign attended reserve staff to teams, update distribution, reports, dashboard |
| dist (Distribution Officer) | Update distribution status, reports, dashboard |
| display (LED Display) | Dashboard / LED screens only |

## LED screens (two separate dashboards)
- `team-dashboard.html` - Team attendance, 25 polling stations per slide.
- `reserve-dashboard.html` - Reserve staff attendance, 50 staff per slide.

Create a user with role **LED Display** in Admin, open each page full-screen on its own LED screen/computer, log in once (remembered on that device). Slides change every **2 minutes**, data refreshes every 10 seconds. Keys: arrows = previous/next, space = pause, double-click or `f` = fullscreen.

## Distribution module
Per polling station, three stages: EVM/VVPAT issued, Polling material issued, Team dispatched (edit the `STAGES` list in `index.html` to rename). Pending (red) / In progress (yellow) / Completed (green) with totals, filters, who/when. Admin can clear it separately (Admin > Fresh attendance > Distribution status only).

## Colours
Green = present (or reserve assigned, with a ✕ badge), yellow = not attended with a reason, red = absent / not reported.

## Notes
- Google Apps Script has daily quotas (about 90 minutes of script runtime per day on free Google accounts, 6 hours on Workspace). The server caches the live data for 10 s and clears the cache on every write, so many screens share one read; still, prefer a Workspace account for election day, and avoid opening many unused dashboard tabs.
- Geofence is enforced in the browser and on the server. Phones need HTTPS (Pages is) and location permission.
- `data.json` / `reserve.json` are the starting employee data and are public on a public Pages site; after the admin uploads an Excel file, the data is served from the Sheet instead. Use a private repo if the bundled files are sensitive.
