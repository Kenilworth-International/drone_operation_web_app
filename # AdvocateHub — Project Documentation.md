# AdvocateHub — Project Documentation

Law chambers management SaaS (Sri Lanka) — case management, staff hierarchy, attendance/payroll, client portal, customizable public portfolio, mobile app with OTP login.

---

## 1. Tech Stack (Final)

| Layer | Tech |
|---|---|
| Backend | Node.js + Express (or NestJS) + MySQL |
| Web (Dashboard) | Next.js |
| Portfolio (Public site) | Next.js — customizable per firm |
| Mobile App | React Native |
| Auth | Mobile number + OTP → JWT |
| File storage | Local disk (dev) → S3-compatible bucket (prod) |
| SMS OTP | Notify.lk / Dialog SMS API |
| Hosting (later) | VPS + web hosting package |

Dev order: **local first** (backend on localhost, MySQL local, web/mobile pointing to `localhost:PORT`) → later move to VPS with domain + wildcard subdomain.

---

## 2. Folder Structure

```
AdvocateHub/
├── Backend/
│   ├── src/
│   │   ├── config/          # db.js, env.js, jwt.js
│   │   ├── middleware/      # auth.js, roleCheck.js, tenant.js
│   │   ├── modules/
│   │   │   ├── auth/        # OTP send/verify, login
│   │   │   ├── firms/       # firm CRUD, subdomain settings
│   │   │   ├── users/       # staff (roles: main, senior, associate, intern, clerk)
│   │   │   ├── clients/     # client CRUD
│   │   │   ├── cases/       # case CRUD, case tasks, case documents
│   │   │   ├── attendance/  # check-in/out, leave
│   │   │   ├── payroll/     # salary calc, payslip
│   │   │   ├── invoices/    # billing
│   │   │   ├── appointments/# booking
│   │   │   └── portfolio/   # public firm profile content (customizable fields)
│   │   ├── routes/          # route index, mounts each module's router
│   │   ├── utils/           # response helpers, validators
│   │   └── app.js
│   ├── uploads/              # local file storage (dev)
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── WebApp/                   # Next.js — staff/client dashboard
│   ├── app/ (or pages/)
│   │   ├── login/
│   │   ├── dashboard/
│   │   │   ├── cases/
│   │   │   ├── tasks/
│   │   │   ├── attendance/
│   │   │   ├── payroll/
│   │   │   ├── clients/
│   │   │   └── invoices/
│   │   └── api/ (only if you later merge backend here — not used in Option B)
│   ├── components/
│   ├── lib/api.ts             # axios/fetch wrapper calling Backend
│   ├── middleware.ts          # subdomain detection (for later multi-tenant routing)
│   └── package.json
│
├── Portfolio/                 # Next.js — public firm site (SEO-friendly, per-firm customizable)
│   ├── app/
│   │   ├── [firm]/             # or subdomain-based routing later
│   │   │   ├── page.tsx        # firm home: about, lawyers, specializations
│   │   │   ├── lawyers/
│   │   │   ├── booking/
│   │   │   └── contact/
│   ├── components/
│   ├── lib/api.ts
│   └── package.json
│
├── MobileApp/                 # React Native
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Auth/          # mobile number entry, OTP verify
│   │   │   ├── Dashboard/
│   │   │   ├── Cases/
│   │   │   ├── Tasks/
│   │   │   ├── Attendance/
│   │   │   └── Profile/
│   │   ├── navigation/
│   │   ├── services/api.ts    # calls Backend REST API
│   │   ├── context/AuthContext.tsx
│   │   └── App.tsx
│   ├── android/
│   └── package.json
│
└── README.md
```

---

## 3. Database Schema (MySQL)

```sql
CREATE TABLE firms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  logo_url VARCHAR(255),
  about TEXT,
  theme_color VARCHAR(20),        -- for portfolio customization
  subscription_plan ENUM('starter','pro','enterprise') DEFAULT 'starter',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (                -- staff
  id INT AUTO_INCREMENT PRIMARY KEY,
  firm_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(15) UNIQUE NOT NULL,
  role ENUM('main_lawyer','senior_lawyer','associate','intern','clerk') NOT NULL,
  photo_url VARCHAR(255),
  bio TEXT,
  specialization VARCHAR(150),
  is_active BOOLEAN DEFAULT TRUE,
  joined_date DATE,
  base_salary DECIMAL(10,2),
  show_on_portfolio BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firm_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(15) UNIQUE NOT NULL,
  nic VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE TABLE cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firm_id INT NOT NULL,
  client_id INT NOT NULL,
  assigned_lawyer_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  case_type VARCHAR(100),
  court VARCHAR(150),
  status ENUM('open','hearing','judgment','closed') DEFAULT 'open',
  next_hearing_date DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (assigned_lawyer_id) REFERENCES users(id)
);

CREATE TABLE case_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  assigned_to INT NOT NULL,       -- users.id
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  status ENUM('pending','in_progress','done') DEFAULT 'pending',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE case_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  file_name VARCHAR(255),
  file_url VARCHAR(255),
  visibility ENUM('staff_only','client_visible') DEFAULT 'staff_only',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  check_in DATETIME,
  check_out DATETIME,
  status ENUM('present','absent','half_day','leave') DEFAULT 'present',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE salaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month VARCHAR(7),               -- '2026-08'
  base_salary DECIMAL(10,2),
  epf_deduction DECIMAL(10,2),
  etf_deduction DECIMAL(10,2),
  other_deductions DECIMAL(10,2) DEFAULT 0,
  net_pay DECIMAL(10,2),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  client_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('due','paid','overdue') DEFAULT 'due',
  due_date DATE,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firm_id INT NOT NULL,
  lawyer_id INT NOT NULL,
  client_id INT,                  -- nullable: public booking before account exists
  guest_name VARCHAR(150),
  guest_mobile VARCHAR(15),
  date_time DATETIME NOT NULL,
  status ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (lawyer_id) REFERENCES users(id)
);

CREATE TABLE otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mobile VARCHAR(15) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Role Permission Matrix

| Action | Main Lawyer | Senior | Associate/Intern | Clerk | Client |
|---|---|---|---|---|---|
| View all firm cases | ✅ | Own cases | Assigned only | ❌ | ❌ |
| Create/assign case | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign tasks | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload case documents | ✅ | ✅ | ✅ | ❌ | View only (if `client_visible`) |
| Manage attendance | ✅ | ❌ | ❌ | ✅ | ❌ |
| View/generate payroll | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage clients | ✅ | ✅ | ❌ | ✅ (data entry) | Own profile only |
| View/create invoices | ✅ | Own cases | ❌ | ✅ (create) | Own only |
| Edit portfolio content | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage appointments | ✅ | Own | ❌ | ✅ | Book only |

Enforce this server-side via middleware reading `role` from the JWT — never trust the client app to hide buttons only.

---

## 5. Auth Flow (Mobile Number + OTP)

```
1. POST /api/auth/send-otp        { mobile }
   → generate 6-digit OTP, save to otp_verifications, send via SMS gateway

2. POST /api/auth/verify-otp      { mobile, otp }
   → check otp_verifications, mark verified
   → look up mobile in users (staff) or clients table
   → if found: issue JWT { user_id, firm_id, role, type: 'staff'|'client' }
   → if not found: reject (no self-signup for staff; client self-signup optional)

3. Every protected API call:
   Header: Authorization: Bearer <JWT>
   Middleware decodes JWT → attaches req.firm_id, req.role, req.user_id
   → all queries automatically filtered by firm_id (multi-tenant isolation)
```

JWT payload example:
```json
{ "user_id": 12, "firm_id": 3, "role": "associate", "type": "staff" }
```

---

## 6. Core API Routes

```
Auth
POST   /api/auth/send-otp
POST   /api/auth/verify-otp

Firms / Portfolio
GET    /api/firms/:subdomain              (public — portfolio data)
PUT    /api/firms/:id                     (main lawyer only — customize portfolio)

Users (staff)
GET    /api/users                         (firm-scoped)
POST   /api/users                         (main lawyer only)
PUT    /api/users/:id

Clients
GET    /api/clients
POST   /api/clients
GET    /api/clients/:id/cases

Cases
GET    /api/cases
POST   /api/cases
GET    /api/cases/:id
PUT    /api/cases/:id
GET    /api/cases/:id/tasks
POST   /api/cases/:id/tasks
GET    /api/cases/:id/documents
POST   /api/cases/:id/documents

Attendance
POST   /api/attendance/check-in
POST   /api/attendance/check-out
GET    /api/attendance?user_id=&month=

Payroll
POST   /api/payroll/generate              (main lawyer only, monthly)
GET    /api/payroll/:user_id

Invoices
GET    /api/invoices
POST   /api/invoices

Appointments
GET    /api/appointments
POST   /api/appointments/book             (public — from portfolio site)
PUT    /api/appointments/:id/status
```

---

## 7. Multi-Tenancy Strategy

- **Web (Portfolio + Dashboard):** subdomain-based — `firmname.advocatehub.lk`. `middleware.ts` in Next.js reads the subdomain, resolves `firm_id`, scopes public portfolio data. Dashboard routes still require JWT on top of this.
- **Mobile App:** single APK, no subdomain concept. `firm_id` comes entirely from the JWT after OTP login — every API call is scoped that way.
- **Backend:** one Express/NestJS deployment serves all firms. Every query filters by `firm_id` (from JWT or resolved subdomain). Never a separate deployment per firm.

---

## 8. Environment Variables (Backend `.env`)

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=advocatehub
JWT_SECRET=your_jwt_secret_here
SMS_API_KEY=your_notify_lk_or_dialog_key
SMS_SENDER_ID=AdvocateHub
FILE_UPLOAD_DIR=./uploads
```

---

## 9. Build Order (Recommended)

1. Backend: DB schema + auth (OTP + JWT) + users/firms module
2. Backend: cases + tasks + documents module
3. WebApp: login → dashboard shell → cases module UI
4. Backend: attendance + payroll module
5. WebApp: attendance/payroll UI
6. Portfolio: public firm page (static-ish, pulls from `firms` + `users` where `show_on_portfolio=true`)
7. Portfolio: booking flow → `appointments` table
8. MobileApp: OTP login → dashboard → cases/tasks/attendance (reuse Backend APIs from step 1–5)
9. Deploy: VPS + MySQL + wildcard DNS + SSL, point domain there

---

## 10. Cursor Build Prompts

Paste these into Cursor **one at a time**, in each respective folder, after `cd`-ing into it.

### Backend prompt
```
Build a Node.js + Express + MySQL backend for a law firm management SaaS called AdvocateHub.

Requirements:
- Multi-tenant: every table has a firm_id, every query scoped by it
- Auth: mobile number + OTP login (mock SMS sending via console.log for now), returns JWT containing user_id, firm_id, role, type
- Roles: main_lawyer, senior_lawyer, associate, intern, clerk (staff) and client
- Modules: auth, firms, users, clients, cases, case_tasks, case_documents, attendance, salaries, invoices, appointments
- Use the MySQL schema I'll provide in /Backend/schema.sql
- Middleware: verifyJWT (decodes token, attaches req.user), requireRole(['main_lawyer', ...]) for role-gated routes
- File structure: src/config, src/middleware, src/modules/<name>/{controller.js, routes.js, model.js}, src/app.js, server.js
- Use mysql2 with connection pool
- Return consistent JSON response shape: { success, data, message }
- Add input validation on all POST/PUT routes
- Set up .env for DB creds, JWT secret, PORT

Start by scaffolding the folder structure and auth module (send-otp, verify-otp) fully working with a local MySQL database.
```

### WebApp (dashboard) prompt
```
Build a Next.js (App Router) dashboard web app called AdvocateHub WebApp for law firm staff and clients.

Requirements:
- Login page: mobile number input → OTP input → stores JWT (httpOnly cookie or secure storage)
- After login, role-based dashboard layout (sidebar differs for main_lawyer/senior/associate/intern/clerk/client)
- Pages: /dashboard/cases (list + detail + tasks + documents), /dashboard/attendance, /dashboard/payroll (main_lawyer only), /dashboard/clients, /dashboard/invoices
- API calls go to a separate Node backend at process.env.NEXT_PUBLIC_API_URL (not Next.js API routes)
- Use a clean, professional legal-industry look — not generic SaaS blue, think trustworthy/traditional but modern (deep navy, gold/brass accent, serif headings optional)
- Responsive, works on tablet/desktop
- Use React Context or Zustand for auth state

Start by scaffolding the folder structure, the login flow, and the dashboard shell with role-based sidebar navigation.
```

### Portfolio prompt
```
Build a Next.js public-facing portfolio site called AdvocateHub Portfolio for law firms to showcase themselves and take bookings.

Requirements:
- Dynamic per firm: route structure supports /[firm]/ for now (subdomain routing added later), pulling firm data from GET /api/firms/:subdomain on the backend
- Each firm's page shows: firm name/logo/about, list of lawyers (photo, name, role, specialization, bio) where show_on_portfolio=true, a booking section
- Booking flow: pick a lawyer → pick date/time → enter name + mobile → POST /api/appointments/book (no login required, guest booking)
- Make it visually customizable per firm using firm.theme_color from the API (e.g. as a CSS variable for accents)
- SEO-friendly: proper meta tags, server-rendered
- Clean, professional, trustworthy legal aesthetic

Start by scaffolding the folder structure and the firm home page pulling live data from the backend, plus the booking flow.
```

### MobileApp prompt
```
Build a React Native app called AdvocateHub MobileApp for law firm staff and clients.

Requirements:
- Auth flow: enter mobile number screen → OTP verification screen → store JWT securely (react-native-keychain or AsyncStorage for MVP)
- After login, role-based navigation: staff (main_lawyer/senior/associate/intern/clerk) see Cases, Tasks, Attendance, Profile tabs; clients see My Cases, Documents, Invoices, Profile tabs
- All API calls to a shared Node backend base URL from an env config file
- Screens: Login, OTP Verify, Dashboard/Home, Case List, Case Detail (with tasks + documents), Attendance (check-in/check-out button with timestamp), Profile
- Use React Navigation, Axios for API calls, Context API for auth state
- Clean, simple UI — prioritize functionality over animation for MVP

Start by scaffolding the folder structure, navigation setup, and the full OTP login flow connected to the backend.
```

---

## 11. Notes for Later (Not MVP, but plan for)

- EPF/ETF percentage rules should be configurable per firm (rates can change)
- Add audit log table (`activity_log`) once you have real users — who viewed/edited what
- Add conflict-of-interest check when creating a new case (does client_id or case details overlap with an existing case at the firm?)
- Wildcard SSL + DNS setup only needed once you move off `localhost` to the VPS