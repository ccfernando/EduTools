const settingsMessage = document.getElementById("settings-message");
const securityForm = document.getElementById("security-form");
const profileForm = document.getElementById("profile-form");
const studentProfileCard = document.getElementById("student-profile-card");

function setMessage(text, type = "") {
    settingsMessage.textContent = text;
    settingsMessage.className = "settings-message";
    if (type) {
        settingsMessage.classList.add(type);
    }
}

function fillProfile(data) {
    document.getElementById("account-email").value = data.user.email || "";

    if (!data.student) {
        studentProfileCard.hidden = true;
        return;
    }

    studentProfileCard.hidden = false;
    document.getElementById("profile-firstname").value = data.student.firstname || "";
    document.getElementById("profile-lastname").value = data.student.lastname || "";
    document.getElementById("profile-section").value = data.student.section || "";
    document.getElementById("profile-sex").value = data.student.sex || "";
    document.getElementById("profile-birthdate").value = data.student.birth_date || "";
    document.getElementById("profile-year").value = data.student.year || "";
}

async function loadProfile() {
    const response = await Auth.api("/api/profile");
    const data = await response.json();
    fillProfile(data);
}

securityForm.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.getElementById("new-password").value;

    if (!password) {
        setMessage("Enter a new password to save.", "error");
        return;
    }

    await Auth.api("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });

    document.getElementById("new-password").value = "";
    setMessage("Password updated.", "success");
});

profileForm.addEventListener("submit", async event => {
    event.preventDefault();

    await Auth.api("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            birthDate: document.getElementById("profile-birthdate").value || null,
            sex: document.getElementById("profile-sex").value || null,
            section: document.getElementById("profile-section").value.trim()
        })
    });

    setMessage("Profile updated.", "success");
    await loadProfile();
});

loadProfile().catch(() => {
    setMessage("Unable to load profile settings.", "error");
});
