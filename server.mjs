import crypto from "crypto";
import express from "express";
import sqlite3 from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new sqlite3(path.join(__dirname, "edutools.db"));
const sessions = new Map();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const DEFAULT_ADMIN_EMAIL = "admin@edutools.local";
const ADMIN_BOOTSTRAP_PASSWORD_FILE = path.join(__dirname, "admin-password.txt");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function ensureColumn(tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some(column => column.name === columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    const [salt, expectedHash] = String(storedHash || "").split(":");
    if (!salt || !expectedHash) return false;

    const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(
        Buffer.from(actualHash, "hex"),
        Buffer.from(expectedHash, "hex")
    );
}

function sanitizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function fullName(firstname, lastname) {
    return [firstname, lastname].map(value => String(value || "").trim()).filter(Boolean).join(" ");
}

function sanitizeUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name
    };
}

function extractToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return null;
    return authHeader.slice("Bearer ".length).trim();
}

function getSessionUser(req) {
    const token = extractToken(req);
    if (!token) return null;
    return sessions.get(token) || null;
}

function requireAuth(req, res, next) {
    const user = getSessionUser(req);
    if (!user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    req.authUser = user;
    req.authToken = extractToken(req);
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.authUser) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!roles.includes(req.authUser.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
}

function initializeDatabase() {
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        display_name TEXT NOT NULL,
        google_sub TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstname TEXT NOT NULL,
        lastname TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        birth_date TEXT,
        sex TEXT,
        section TEXT NOT NULL,
        year INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    ensureColumn("users", "email", "TEXT UNIQUE");
    ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'student'");
    ensureColumn("users", "display_name", "TEXT NOT NULL DEFAULT 'Student User'");
    ensureColumn("users", "google_sub", "TEXT UNIQUE");

    ensureColumn("students", "email", "TEXT");
    ensureColumn("students", "password_hash", "TEXT");
    ensureColumn("students", "birth_date", "TEXT");
    ensureColumn("students", "sex", "TEXT");
    ensureColumn("students", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");

    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE email IS NOT NULL");
}

function backfillStudentAccounts() {
    const legacyStudents = db.prepare(`
        SELECT id, firstname, lastname, email, password_hash
        FROM students
        WHERE email IS NOT NULL AND TRIM(email) <> ''
    `).all();

    for (const student of legacyStudents) {
        const email = sanitizeEmail(student.email);
        const displayName = fullName(student.firstname, student.lastname) || email;
        const existingUser = db.prepare("SELECT id FROM users WHERE email = ? OR username = ?").get(email, email);

        if (existingUser) {
            db.prepare(`
                UPDATE users
                SET username = ?, email = ?, role = 'student', display_name = ?
                WHERE id = ?
            `).run(email, email, displayName, existingUser.id);
            continue;
        }

        if (!student.password_hash) continue;

        db.prepare(`
            INSERT INTO users (username, email, password_hash, role, display_name)
            VALUES (?, ?, ?, 'student', ?)
        `).run(email, email, student.password_hash, displayName);
    }
}

function seedAdminAccount() {
    const existingAdmin = db.prepare("SELECT id, email FROM users WHERE username = ?").get("admin");
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD
        || (fs.existsSync(ADMIN_BOOTSTRAP_PASSWORD_FILE)
            ? fs.readFileSync(ADMIN_BOOTSTRAP_PASSWORD_FILE, "utf8").trim()
            : "");

    if (!existingAdmin) {
        if (!bootstrapPassword) {
            console.warn("Admin account was not seeded because no ADMIN_BOOTSTRAP_PASSWORD or admin-password.txt was provided.");
            return;
        }

        db.prepare(`
            INSERT INTO users (username, email, password_hash, role, display_name)
            VALUES (?, ?, ?, ?, ?)
        `).run("admin", DEFAULT_ADMIN_EMAIL, hashPassword(bootstrapPassword), "admin", "Administrator");
        return;
    }

    if (!existingAdmin.email) {
        db.prepare("UPDATE users SET email = ? WHERE id = ?").run(DEFAULT_ADMIN_EMAIL, existingAdmin.id);
    }
}

function createSession(user) {
    const token = crypto.randomUUID();
    const sessionUser = sanitizeUser(user);
    sessions.set(token, sessionUser);
    return { token, user: sessionUser };
}

async function verifyGoogleCredential(credential) {
    if (!GOOGLE_CLIENT_ID) {
        throw new Error("Google sign-in is not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
    if (!response.ok) {
        throw new Error("Invalid Google credential");
    }

    const payload = await response.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) {
        throw new Error("Google client ID mismatch");
    }
    if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
        throw new Error("Invalid Google issuer");
    }
    if (!payload.sub || !payload.email || payload.email_verified !== "true") {
        throw new Error("Google account email is not verified");
    }

    return {
        sub: payload.sub,
        email: sanitizeEmail(payload.email),
        displayName: payload.name || payload.email
    };
}

function syncStudentUser({ firstname, lastname, email, passwordHash }) {
    const normalizedEmail = sanitizeEmail(email);
    const displayName = fullName(firstname, lastname) || normalizedEmail;
    const existingUser = db.prepare("SELECT id, password_hash FROM users WHERE email = ? OR username = ?").get(normalizedEmail, normalizedEmail);

    if (existingUser) {
        const nextPasswordHash = passwordHash || existingUser.password_hash;
        db.prepare(`
            UPDATE users
            SET username = ?, email = ?, password_hash = ?, role = 'student', display_name = ?
            WHERE id = ?
        `).run(normalizedEmail, normalizedEmail, nextPasswordHash, displayName, existingUser.id);
        return existingUser.id;
    }

    const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, role, display_name)
        VALUES (?, ?, ?, 'student', ?)
    `).run(normalizedEmail, normalizedEmail, passwordHash, displayName);

    return result.lastInsertRowid;
}

initializeDatabase();
backfillStudentAccounts();
seedAdminAccount();

app.get("/api/auth/google/config", (req, res) => {
    res.json({ clientId: GOOGLE_CLIENT_ID, enabled: Boolean(GOOGLE_CLIENT_ID) });
});

app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body || {};
    const identifier = sanitizeEmail(username);

    if (!identifier || !password) {
        return res.status(400).json({ error: "Email or username and password are required" });
    }

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE lower(username) = ? OR lower(email) = ?
    `).get(identifier, identifier);

    if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid username, email, or password" });
    }

    res.json(createSession(user));
});

app.post("/api/auth/google", async (req, res) => {
    try {
        const { credential } = req.body || {};
        if (!credential) {
            return res.status(400).json({ error: "Google credential is required" });
        }

        const googleUser = await verifyGoogleCredential(credential);

        let user = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(googleUser.sub);
        if (!user) {
            user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(googleUser.email);
        }

        if (!user) {
            return res.status(403).json({ error: "No account is linked to this Google email yet" });
        }

        db.prepare(`
            UPDATE users
            SET google_sub = ?, email = ?, username = ?, display_name = COALESCE(NULLIF(display_name, ''), ?)
            WHERE id = ?
        `).run(googleUser.sub, googleUser.email, user.role === "student" ? googleUser.email : user.username, googleUser.displayName, user.id);

        if (user.role === "student") {
            db.prepare(`
                UPDATE students
                SET email = ?
                WHERE lower(email) = ?
            `).run(googleUser.email, googleUser.email);
        }

        const freshUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        res.json(createSession(freshUser));
    } catch (error) {
        res.status(401).json({ error: error.message || "Google sign-in failed" });
    }
});

app.get("/api/auth/session", requireAuth, (req, res) => {
    res.json({ user: req.authUser });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
    sessions.delete(req.authToken);
    res.json({ success: true });
});

app.get("/api/profile", requireAuth, (req, res) => {
    const baseUser = db.prepare(`
        SELECT id, username, email, role, display_name
        FROM users
        WHERE id = ?
    `).get(req.authUser.id);

    if (!baseUser) {
        return res.status(404).json({ error: "User not found" });
    }

    if (baseUser.role === "student") {
        const student = db.prepare(`
            SELECT firstname, lastname, email, birth_date, sex, section, year
            FROM students
            WHERE lower(email) = ?
        `).get(sanitizeEmail(baseUser.email));

        return res.json({
            user: sanitizeUser(baseUser),
            student: student || null
        });
    }

    res.json({
        user: sanitizeUser(baseUser),
        student: null
    });
});

app.put("/api/profile", requireAuth, (req, res) => {
    const { password, birthDate, sex, section } = req.body || {};
    const baseUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.authUser.id);

    if (!baseUser) {
        return res.status(404).json({ error: "User not found" });
    }

    if (password) {
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), baseUser.id);
    }

    if (baseUser.role === "student") {
        const student = db.prepare("SELECT * FROM students WHERE lower(email) = ?").get(sanitizeEmail(baseUser.email));
        if (!student) {
            return res.status(404).json({ error: "Student profile not found" });
        }

        db.prepare(`
            UPDATE students
            SET birth_date = ?, sex = ?, section = ?, password_hash = COALESCE(?, password_hash)
            WHERE id = ?
        `).run(
            birthDate || null,
            sex || null,
            section ? section.trim() : student.section,
            password ? hashPassword(password) : null,
            student.id
        );
    }

    const refreshedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(baseUser.id);
    const sessionUser = sanitizeUser(refreshedUser);
    sessions.set(req.authToken, sessionUser);
    res.json({ success: true, user: sessionUser });
});

app.get("/api/students", requireAuth, requireRole("admin"), (req, res) => {
    const { section, year } = req.query;
    let query = "SELECT id, firstname, lastname, email, birth_date, sex, section, year, created_at, firstname || ' ' || lastname AS name FROM students";
    const params = [];

    if (section && year) {
        query += " WHERE section = ? AND year = ?";
        params.push(section, year);
    } else if (year) {
        query += " WHERE year = ?";
        params.push(year);
    }

    query += " ORDER BY lastname, firstname";

    const stmt = db.prepare(query);
    const students = params.length ? stmt.all(...params) : stmt.all();
    res.json(students);
});

app.post("/api/students", requireAuth, requireRole("admin"), (req, res) => {
    const { firstname, lastname, email, password, birthDate, sex, section, year } = req.body || {};
    const normalizedYear = Number.parseInt(year, 10);
    const normalizedEmail = sanitizeEmail(email);

    if (!firstname || !lastname || !normalizedEmail || !password || !section || Number.isNaN(normalizedYear)) {
        return res.status(400).json({ error: "Firstname, lastname, email, password, section, and year are required" });
    }

    const passwordHash = hashPassword(password);

    const stmt = db.prepare(`
        INSERT INTO students (firstname, lastname, email, password_hash, birth_date, sex, section, year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        firstname.trim(),
        lastname.trim(),
        normalizedEmail,
        passwordHash,
        birthDate || null,
        sex || null,
        section.trim(),
        normalizedYear
    );

    syncStudentUser({ firstname, lastname, email: normalizedEmail, passwordHash });
    res.json({ id: result.lastInsertRowid });
});

app.delete("/api/students", requireAuth, requireRole("admin"), (req, res) => {
    const { id } = req.query;
    const student = db.prepare("SELECT email FROM students WHERE id = ?").get(id);

    db.prepare("DELETE FROM students WHERE id = ?").run(id);

    if (student?.email) {
        db.prepare("DELETE FROM users WHERE lower(email) = ? AND role = 'student'").run(sanitizeEmail(student.email));
    }

    res.json({ success: true });
});

app.put("/api/students", requireAuth, requireRole("admin"), (req, res) => {
    const { id } = req.query;
    const { firstname, lastname, email, password, birthDate, sex, section, year } = req.body || {};
    const normalizedYear = Number.parseInt(year, 10);
    const normalizedEmail = sanitizeEmail(email);

    if (!id || !firstname || !lastname || !normalizedEmail || !section || Number.isNaN(normalizedYear)) {
        return res.status(400).json({ error: "Student id, firstname, lastname, email, section, and year are required" });
    }

    const existingStudent = db.prepare("SELECT email, password_hash FROM students WHERE id = ?").get(id);
    if (!existingStudent) {
        return res.status(404).json({ error: "Student not found" });
    }

    const passwordHash = password ? hashPassword(password) : existingStudent.password_hash;

    db.prepare(`
        UPDATE students
        SET firstname = ?, lastname = ?, email = ?, password_hash = ?, birth_date = ?, sex = ?, section = ?, year = ?
        WHERE id = ?
    `).run(
        firstname.trim(),
        lastname.trim(),
        normalizedEmail,
        passwordHash,
        birthDate || null,
        sex || null,
        section.trim(),
        normalizedYear,
        id
    );

    if (existingStudent.email && sanitizeEmail(existingStudent.email) !== normalizedEmail) {
        db.prepare("DELETE FROM users WHERE lower(email) = ? AND role = 'student'").run(sanitizeEmail(existingStudent.email));
    }

    syncStudentUser({ firstname, lastname, email: normalizedEmail, passwordHash });
    res.json({ success: true });
});

app.post(
    "/api/students/batch",
    requireAuth,
    requireRole("admin"),
    express.text({ type: "text/csv", limit: "10mb" }),
    (req, res) => {
        try {
            const lines = req.body.trim().split("\n").filter(Boolean);
            if (lines.length === 0) {
                return res.json({ success: true, count: 0 });
            }

            const header = lines[0].split(",").map(s => s.trim().toLowerCase());
            const hasHeader = header.includes("firstname") && header.includes("lastname");
            const yearColumnName = header.includes("year") ? "year" : (header.includes("batch") ? "batch" : null);
            const emailColumnName = header.includes("email") ? "email" : (header.includes("gmail") ? "gmail" : null);
            const passwordColumnName = header.includes("password") ? "password" : null;
            const birthDateColumnName = header.includes("birth_date") ? "birth_date" : (header.includes("birthdate") ? "birthdate" : null);
            const sexColumnName = header.includes("sex") ? "sex" : null;

            const getRowValue = (parts, index, fallback) => {
                if (hasHeader && index >= 0) {
                    return parts[index];
                }
                return parts[fallback];
            };

            const firstnameIndex = header.indexOf("firstname");
            const lastnameIndex = header.indexOf("lastname");
            const emailIndex = emailColumnName ? header.indexOf(emailColumnName) : -1;
            const passwordIndex = passwordColumnName ? header.indexOf(passwordColumnName) : -1;
            const birthDateIndex = birthDateColumnName ? header.indexOf(birthDateColumnName) : -1;
            const sexIndex = sexColumnName ? header.indexOf(sexColumnName) : -1;
            const sectionIndex = header.indexOf("section");
            const yearIndex = yearColumnName ? header.indexOf(yearColumnName) : -1;

            const dataLines = hasHeader ? lines.slice(1) : lines;
            let count = 0;

            for (const line of dataLines) {
                const parts = line.split(",").map(s => s.trim());
                if (parts.length < 6) continue;

                const firstname = getRowValue(parts, firstnameIndex, 0);
                const lastname = getRowValue(parts, lastnameIndex, 1);
                const email = sanitizeEmail(getRowValue(parts, emailIndex, 2));
                const password = getRowValue(parts, passwordIndex, 3);
                const birthDate = birthDateIndex >= 0 ? getRowValue(parts, birthDateIndex, 4) : null;
                const sex = sexIndex >= 0 ? getRowValue(parts, sexIndex, birthDateIndex >= 0 ? 5 : 4) : null;
                const section = getRowValue(parts, sectionIndex, birthDateIndex >= 0 || sexIndex >= 0 ? (sexIndex >= 0 && birthDateIndex >= 0 ? 6 : 5) : 4);
                const yearValue = getRowValue(parts, yearIndex, birthDateIndex >= 0 || sexIndex >= 0 ? (sexIndex >= 0 && birthDateIndex >= 0 ? 7 : 6) : 5);
                const year = Number.parseInt(yearValue, 10);

                if (!firstname || !lastname || !email || !password || !section || Number.isNaN(year)) continue;

                const passwordHash = hashPassword(password);
                const existingStudent = db.prepare("SELECT id FROM students WHERE lower(email) = ?").get(email);

                if (existingStudent) {
                    db.prepare(`
                        UPDATE students
                        SET firstname = ?, lastname = ?, email = ?, password_hash = ?, birth_date = ?, sex = ?, section = ?, year = ?
                        WHERE id = ?
                    `).run(firstname, lastname, email, passwordHash, birthDate || null, sex || null, section, year, existingStudent.id);
                } else {
                    db.prepare(`
                        INSERT INTO students (firstname, lastname, email, password_hash, birth_date, sex, section, year)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(firstname, lastname, email, passwordHash, birthDate || null, sex || null, section, year);
                }

                syncStudentUser({ firstname, lastname, email, passwordHash });
                count++;
            }

            res.json({ success: true, count });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
);

app.get("/api/sections", requireAuth, requireRole("admin"), (req, res) => {
    const { year } = req.query;
    const sections = db.prepare(`
        SELECT DISTINCT section
        FROM students
        WHERE year = ?
        ORDER BY section
    `).all(year);
    res.json(sections.map(section => section.section));
});

app.get("/api/users", requireAuth, requireRole("admin"), (req, res) => {
    const users = db.prepare(`
        SELECT id, username, email, role, display_name, google_sub, created_at
        FROM users
        ORDER BY username
    `).all();
    res.json(users);
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
