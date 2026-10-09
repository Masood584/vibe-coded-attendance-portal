# Attendance Portal (MERN — Express + MongoDB, vanilla JS frontend)

Simple office attendance system: login, then mark Check In → Break In → Break Out → Check Out for the day.

## Run it locally

1. Install deps:
   ```
   cd attendance-portal
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values:
   ```
   cp .env.example .env
   ```
   - `MONGO_URI` — local MongoDB (`mongodb://127.0.0.1:27017/attendance_portal`) or an Atlas connection string.
   - `JWT_SECRET` — any long random string.
3. Start MongoDB (if local): `mongod`
4. Start the app:
   ```
   npm start
   ```
5. Open http://localhost:5000 → it'll redirect to login → click "Create an account" for the first employee.

## How the daily flow works

- One attendance record is auto-created per user per day (`date` field, `YYYY-MM-DD`).
- Buttons enable/disable based on state: can't Break Out before Break In, can't Check Out while on break, can't Check In twice, etc. — this is enforced on the **backend** (routes/attendanceRoutes.js), not just the UI, so it can't be bypassed via devtools.
- Employees can take multiple break sessions in a single day; the system records each break window and subtracts the total break duration from the final work time.
- `totalWorkMinutes` is computed on Check Out = (checkOut - checkIn) - sum(all break session durations).

## Admin dashboard

- Admin accounts are routed to `admin.html` after login; employee accounts continue to use `index.html`.
- The admin area uses a navigation drawer with separate pages for employees, office schedule, leave requests, attendance history, and the attendance edit audit log. The history page shows all employees and provides an employee dropdown filter.
- Admins can create employee accounts from the employee overview page; the server assigns the `employee` role and rejects duplicate email addresses.
- Admins can edit an employee's name and department from the employee overview page.
- Admins can correct employee check-in, break-in, break-out, and check-out times from the attendance history page; total work time is recalculated when saved.
- Attendance time corrections are recorded with the editing admin and before/after values in the admin audit log.
- Admins can export attendance as CSV by date range and optional employee filter; the history page defaults the report dates to the current month.
- Admins can configure office start/end times, grace period, and working days (defaults: 09:00–17:00, no grace, Monday–Friday). The employee overview marks people late/absent after the configured start cutoff and marks completed shifts as early checkout when checkout is before the configured end time. Employees can still check out early; overtime is not calculated.
- Employees can submit dated leave requests and view their status; admins can approve or reject pending requests.
- On an approved leave date, employees see a notice and cannot start attendance; if they had already checked in before the leave was approved, they can finish their current attendance flow.
- Employees use a shared navigation drawer to access separate Attendance, Leave Requests, and Attendance History pages.
- To grant an account admin access, update its role in MongoDB (for example, in `mongosh`, run `db.users.updateOne({ email: "admin@company.com" }, { $set: { role: "admin" } })`). Public registration never accepts a role from the client.
- Admin roster and history endpoints require a valid login token and the `admin` role.

## Project structure

```
attendance-portal/
├── server.js              # entry point, serves API + static frontend
├── config/db.js           # mongoose connection
├── models/User.js         # bcrypt password hashing built in
├── models/Attendance.js   # unique index on (user, date)
├── models/AttendanceAudit.js # before/after log for admin time corrections
├── models/OfficeSettings.js # admin-configured work schedule
├── models/LeaveRequest.js  # employee leave requests and approvals
├── middleware/auth.js     # JWT verification
├── routes/authRoutes.js   # /api/auth/register, /login
├── routes/attendanceRoutes.js  # /api/attendance/*
└── public/                # plain HTML/CSS/JS — no build step needed
    ├── login.html + login.js
    ├── index.html + app.js   (employee attendance)
    ├── employee-leaves.html + employee-leaves.js (employee leave requests)
    ├── employee-history.html + employee-history.js (employee attendance history)
    ├── employee-shell.js (employee authorization, account actions, and navigation drawer)
    ├── admin.html + admin.js (employee overview)
    ├── admin-schedule.html + admin-schedule.js (office hours and working days)
    ├── admin-leaves.html + admin-leaves.js (leave approvals)
    ├── admin-history.html + admin-history.js (attendance history and CSV export)
    ├── admin-audit.html + admin-audit.js (attendance edit audit log)
    ├── admin-shell.js (admin authorization, account actions, and navigation drawer)
    └── style.css
```

## Turning this into a full MERN (React) app later

Right now the frontend is plain JS so you can run it with zero build tooling — good for an internal office tool. When you're ready to practice more React:
- Keep this exact backend as-is (it's a clean REST API already).
- Build a React app that calls the same `/api/auth/*` and `/api/attendance/*` endpoints.
- Swap `localStorage` token handling for a `Context` + `axios` interceptor.

## Next steps worth adding

- Prevent Check In from unexpected IP ranges (office-only) if needed.
- Password reset flow.
