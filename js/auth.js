const Auth = {
    tokenKey: "edutools_auth_token",
    userKey: "edutools_auth_user",
    rememberKey: "edutools_saved_login",

    getToken() {
        return localStorage.getItem(this.tokenKey);
    },

    getUser() {
        const raw = localStorage.getItem(this.userKey);
        return raw ? JSON.parse(raw) : null;
    },

    saveSession(token, user) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
    },

    clearSession() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    },

    saveRememberedLogin(username, remember) {
        if (!remember) {
            localStorage.removeItem(this.rememberKey);
            return;
        }

        localStorage.setItem(this.rememberKey, JSON.stringify({ username, remember: true }));
    },

    getRememberedLogin() {
        const raw = localStorage.getItem(this.rememberKey);
        return raw ? JSON.parse(raw) : null;
    },

    async api(url, options = {}) {
        const headers = new Headers(options.headers || {});
        const token = this.getToken();

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        if (options.body && !headers.has("Content-Type") && typeof options.body !== "string") {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            this.clearSession();
            if (!document.body.dataset.authPage) {
                window.location.href = "/login.html";
            }
            throw new Error("Authentication required");
        }

        return response;
    },

    async login(username, password) {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Login failed");
        }

        this.saveSession(data.token, data.user);
        return data.user;
    },

    async loginWithGoogle(credential) {
        const response = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Google sign-in failed");
        }

        this.saveSession(data.token, data.user);
        return data.user;
    },

    async restoreSession() {
        const token = this.getToken();
        if (!token) return null;

        const response = await this.api("/api/auth/session");
        const data = await response.json();
        this.saveSession(token, data.user);
        return data.user;
    },

    getInitials(name) {
        return String(name || "User")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    },

    renderUser(user) {
        document.querySelectorAll(".user-name").forEach(node => {
            node.textContent = user.displayName;
        });

        document.querySelectorAll(".user-role").forEach(node => {
            node.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        });

        document.querySelectorAll(".user-avatar").forEach(node => {
            node.textContent = this.getInitials(user.displayName);
        });
    },

    applyRoleAccess(user) {
        document.querySelectorAll("[data-requires-role]").forEach(node => {
            const allowedRoles = node.dataset.requiresRole.split(",").map(role => role.trim());
            node.hidden = !allowedRoles.includes(user.role);
        });
    },

    attachLogout() {
        document.querySelectorAll('[data-action="logout"]').forEach(button => {
            button.addEventListener("click", async () => {
                try {
                    await this.api("/api/auth/logout", { method: "POST" });
                } catch (error) {
                    // Ignore logout failures and clear the client session anyway.
                }

                this.clearSession();
                window.location.href = "/login.html";
            });
        });
    },

    async waitForGoogleIdentity(maxAttempts = 20) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (window.google?.accounts?.id) {
                return true;
            }
            await new Promise(resolve => window.setTimeout(resolve, 150));
        }
        return false;
    },

    async initGoogleLogin(errorBox) {
        const container = document.getElementById("google-signin");
        if (!container) return;

        const response = await fetch("/api/auth/google/config");
        const config = await response.json();
        const googleReady = await this.waitForGoogleIdentity();

        if (!config.enabled || !config.clientId || !googleReady) {
            container.hidden = true;
            const note = document.getElementById("google-signin-note");
            if (note) {
                note.textContent = "Google sign-in is not configured on this server yet.";
            }
            return;
        }

        google.accounts.id.initialize({
            client_id: config.clientId,
            callback: async ({ credential }) => {
                try {
                    await this.loginWithGoogle(credential);
                    window.location.href = "/index.html";
                } catch (error) {
                    if (errorBox) {
                        errorBox.textContent = error.message;
                    }
                }
            }
        });

        google.accounts.id.renderButton(container, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: 280
        });
    },

    async init() {
        const body = document.body;

        if (body.dataset.authPage === "login") {
            await this.initLoginPage();
            return;
        }

        const allowedRoles = (body.dataset.allowedRoles || "admin,student")
            .split(",")
            .map(role => role.trim())
            .filter(Boolean);

        const user = await this.restoreSession().catch(() => null);
        if (!user) {
            window.location.href = "/login.html";
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            window.location.href = "/index.html";
            return;
        }

        this.renderUser(user);
        this.applyRoleAccess(user);
        this.attachLogout();
    },

    async initLoginPage() {
        const existingUser = await this.restoreSession().catch(() => null);
        if (existingUser) {
            window.location.href = "/index.html";
            return;
        }

        const form = document.getElementById("login-form");
        const errorBox = document.getElementById("login-error");
        const rememberCheckbox = document.getElementById("remember-password");
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        if (!form) return;

        const remembered = this.getRememberedLogin();
        if (remembered?.remember) {
            usernameInput.value = remembered.username || "";
            rememberCheckbox.checked = true;
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();
            errorBox.textContent = "";

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            try {
                await this.login(username, password);
                this.saveRememberedLogin(username, rememberCheckbox.checked);
                window.location.href = "/index.html";
            } catch (error) {
                errorBox.textContent = error.message;
            }
        });

        rememberCheckbox.addEventListener("change", () => {
            if (!rememberCheckbox.checked) {
                localStorage.removeItem(this.rememberKey);
            }
        });

        await this.initGoogleLogin(errorBox);
    }
};

window.Auth = Auth;

document.addEventListener("DOMContentLoaded", () => {
    Auth.init();
});
