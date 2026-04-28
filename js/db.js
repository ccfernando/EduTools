const API = "/api/students";

const Student = {
    async add(firstname, lastname, section, year) {
        const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstname, lastname, section, year })
        });
        return await res.json();
    },
    
    async getBySectionYear(section, year) {
        const res = await fetch(`${API}?section=${section}&year=${year}`);
        return await res.json();
    },
    
    async getAll() {
        const res = await fetch(API);
        return await res.json();
    },
    
    async getSectionsByYear(year) {
        const res = await fetch(`/api/sections?year=${year}`);
        return await res.json();
    },
    
    async delete(id) {
        await fetch(`${API}?id=${id}`, { method: "DELETE" });
    },
    
    async update(id, data) {
        await fetch(`${API}?id=${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    }
};