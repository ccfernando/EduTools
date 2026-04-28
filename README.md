# EduTools

EduTools is a browser-based school utility app built with Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript. It includes role-based access for admins and students, student account management, profile settings, and optional Google sign-in.

## Features

- Role-based access control
  - `admin`: dashboard, student management, timer, flashcards, settings
  - `student`: dashboard and settings only
- Student management
  - add, edit, delete, and batch upload student records
  - student records include email, password, section, batch/year, birth date, and sex
- Student profile settings
  - update password
  - update birth date, sex, and section
- Authentication
  - username/email + password login
  - optional Google sign-in via Google Identity Services
- SQLite-backed persistence for users and students

## Tech Stack

- Node.js
- Express
- SQLite via `better-sqlite3`
- Vanilla HTML, CSS, and JavaScript

## Project Structure

```text
EduTools/
|-- css/
|   `-- style.css
|-- js/
|   |-- auth.js
|   `-- theme.js
|-- tools/
|   |-- flashcards.html
|   |-- flashcards.css
|   |-- flashcards.js
|   |-- students.html
|   |-- students.css
|   |-- students.js
|   |-- timer.html
|   |-- timer.css
|   |-- timer.js
|   |-- settings.html
|   |-- settings.css
|   `-- settings.js
|-- index.html
|-- login.html
|-- server.mjs
|-- run.bat
|-- package.json
`-- edutools.db
```

## Requirements

- Node.js 20+ recommended
- npm
- Windows is assumed for `run.bat`, but the app itself is standard Node/Express

## Installation

1. Install dependencies:

```bash
npm install
```

2. Optional: create the bootstrap password file for the first admin account:

```text
admin-password.txt
```

Put the admin password you want inside the file as plain text on one line.

3. Optional: enable Google sign-in by creating:

```text
google-client-id.txt
```

Place your Google OAuth Web Client ID inside the file as one line of text.

## Running the App

### Option 1: Windows batch launcher

```bat
run.bat
```

This will:

- load `admin-password.txt` if present
- load `google-client-id.txt` if present
- start the Express server

### Option 2: npm

If you want to run it manually:

```bash
npm start
```

## Default Login Behavior

The app no longer hardcodes an admin password in source code.

- If the database does not yet contain an `admin` user:
  - the server will create one only if `ADMIN_BOOTSTRAP_PASSWORD` or `admin-password.txt` is provided
- If no bootstrap password is provided:
  - the app will not seed a new admin account automatically

## Student CSV Import Format

The batch upload accepts CSV with this header:

```csv
firstname,lastname,gmail,password,section,year
John,Smith,john.smith@gmail.com,johnpass123,A,2026
Jane,Doe,jane.doe@gmail.com,janepass123,B,2026
```

It also supports:

- `email` instead of `gmail`
- `batch` instead of `year`
- optional `birth_date` and `sex` columns when present

Example extended format:

```csv
firstname,lastname,email,password,birth_date,sex,section,year
John,Smith,john.smith@gmail.com,johnpass123,2008-01-14,Male,A,2026
```

## Authentication Notes

### Password login

- users can sign in with email or username
- students are synced into the `users` table for authentication

### Remembered login

- the app remembers only the email/username on the device
- it no longer stores the raw password for auto-fill persistence

### Google sign-in

Google sign-in is optional.

To enable it:

1. Create a Google Cloud project
2. Configure OAuth consent screen
3. Create a Web application OAuth client
4. Add your development and production origins
5. Put the Web Client ID in `google-client-id.txt`

Important:

- Google sign-in only works for accounts already linked by email in the system
- the current implementation uses Google's `tokeninfo` endpoint and should be upgraded to library-based verification before real production deployment

## Database

The SQLite database file is:

```text
edutools.db
```

Main tables:

- `users`
  - username
  - email
  - password hash
  - role
  - display name
  - optional Google subject id
- `students`
  - first name
  - last name
  - email
  - password hash
  - birth date
  - sex
  - section
  - year

## Security and Current Status

This project is functional, but it should still be treated as a school/internal prototype unless you finish the remaining hardening work.

Already improved:

- removed hardcoded admin password from source
- removed remembered raw passwords in the browser
- removed the most obvious student-table XSS sink

Still recommended before public deployment:

- move auth from localStorage bearer tokens to HTTP-only secure cookies
- add CSRF protection if cookie auth is introduced
- replace Google `tokeninfo` verification with official token verification
- add stricter server-side validation
- add rate limiting for login endpoints
- add automated tests
- add logging and error monitoring

## Development Notes

- Frontend is intentionally lightweight and framework-free
- Data access and business rules currently live mostly in `server.mjs`
- Some UI markup is duplicated across pages and could be refactored if the app grows

## Suggested Next Improvements

1. Move session management to secure cookie-based auth
2. Add admin UI for viewing/editing users directly
3. Add password reset flow
4. Add validation and form-level feedback
5. Add automated test coverage for auth and student CRUD

## License

No license file is included yet. Add one before publishing publicly if you want to define usage rights clearly.
