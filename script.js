document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // API CONFIGURATION
    // =====================================================
    // Local development uses the FastAPI server started with:
    //   uvicorn main:app --reload
    // After deploying the backend (Render, Railway, etc.),
    // put its public HTTPS address in PRODUCTION_API below.

    const PRODUCTION_API = "https://nursery-rp45.onrender.com/api";

    const isLocal = ["localhost", "127.0.0.1", ""].includes(
        window.location.hostname
    );

    const API_URL = isLocal
        ? "http://localhost:8000/api"
        : PRODUCTION_API;


    // =====================================================
    // ELEMENTS
    // =====================================================

    const $ = (id) => document.getElementById(id);

    const menuBtn = $("menuBtn");
    const mainNav = $("mainNav");
    const plantGrid = $("plantGrid");
    const plantSearch = $("plantSearch");
    const categoryFilter = $("categoryFilter");
    const sunFilter = $("sunFilter");
    const waterFilter = $("waterFilter");
    const recommendBtn = $("recommendBtn");
    const recommendationResult = $("recommendationResult");
    const diagnosisButton = $("diagnoseBtn");
    const diagnosisResult = $("diagnosisResult");
    const seasonResult = $("seasonResult");
    const modal = $("careModal");
    const modalContent = $("modalContent");
    const modalClose = $("modalClose");


    // =====================================================
    // HELPERS
    // =====================================================

    // Plant data comes from our own API, but escaping keeps the page
    // safe if the database is ever edited with unexpected characters.
    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[c]));
    }

    const sunlightText = (v) =>
        ({ low: "Low light", medium: "Partial", high: "Bright" }[v] || v || "Unknown");

    const waterText = (v) =>
        ({ low: "Low water", medium: "Moderate", high: "High water" }[v] || v || "Unknown");

    const cap = (text) =>
        text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

    async function api(path, options) {
        const response = await fetch(`${API_URL}${path}`, options);

        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            // not JSON, handled below
        }

        if (!response.ok || !data || data.success === false) {
            throw new Error(
                (data && data.message) || `Server error: ${response.status}`
            );
        }

        return data;
    }

    function post(path, body) {
        return api(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
    }


    // =====================================================
    // MOBILE MENU
    // =====================================================

    if (menuBtn && mainNav) {
        menuBtn.addEventListener("click", () => {
            mainNav.classList.toggle("open");
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("open");
            });
        });
    }


    // =====================================================
    // CUSTOM CURSOR
    // =====================================================

    const cursor = document.querySelector(".cursor");
    const ring = document.querySelector(".cursor-ring");

    if (window.innerWidth > 700 && cursor && ring) {

        let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

        document.addEventListener("mousemove", (event) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
            cursor.style.left = mouseX + "px";
            cursor.style.top = mouseY + "px";
        });

        (function moveRing() {
            ringX += (mouseX - ringX) * 0.12;
            ringY += (mouseY - ringY) * 0.12;
            ring.style.left = ringX + "px";
            ring.style.top = ringY + "px";
            requestAnimationFrame(moveRing);
        })();
    }


    // =====================================================
    // MODAL
    // =====================================================

    function openModal(html) {
        modalContent.innerHTML = html;
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    if (modal && modalContent) {
        modalClose && modalClose.addEventListener("click", closeModal);

        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeModal();
        });
    }


    // =====================================================
    // PLANT CARDS
    // =====================================================

    function createPlantCard(plant) {

        const tags = Array.isArray(plant.tags) ? plant.tags : [];

        return `
            <article class="plant-card" data-plant-id="${esc(plant.id)}"
                     tabindex="0" role="button"
                     aria-label="View details for ${esc(plant.name)}">

                <div class="plant-image">${esc(plant.emoji || "🌱")}</div>

                <h3>${esc(plant.name || "Unknown Plant")}</h3>

                <div class="scientific">${esc(plant.scientificName || "")}</div>

                <div class="plant-info">
                    <div class="info-pill">☀️ ${esc(sunlightText(plant.sun))}</div>
                    <div class="info-pill">💧 ${esc(waterText(plant.water))}</div>
                </div>

                <div class="tags">
                    ${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
                </div>

            </article>
        `;
    }

    function showPlantDetails(plant) {

        const detail = (label, value) => value
            ? `<div class="detail-row"><span>${label}</span><strong>${esc(value)}</strong></div>`
            : "";

        openModal(`
            <div class="plant-detail">

                <div class="detail-emoji">${esc(plant.emoji || "🌱")}</div>

                <h2>${esc(plant.name)}</h2>
                <div class="scientific">${esc(plant.scientificName)}</div>

                <p class="detail-text">${esc(plant.description)}</p>

                ${detail("☀️ Sunlight", sunlightText(plant.sun))}
                ${detail("💧 Water", waterText(plant.water))}
                ${detail("🌡️ Temperature", plant.temperature)}
                ${detail("🌱 Soil", plant.soil)}
                ${detail("📍 Grows in", (plant.environment || []).map(cap).join(", "))}
                ${detail("🗓️ Best season", (plant.seasons || []).map(cap).join(", "))}
                ${detail("⭐ Difficulty", cap(plant.difficulty))}

                <div class="detail-care">
                    <strong>Care tip</strong>
                    <p>${esc(plant.care)}</p>
                </div>

            </div>
        `);
    }

    // One click handler for every plant card on the page
    // (library, recommendations and seasonal results).
    function handleCardActivate(card) {
        const plant = plantCache.get(Number(card.dataset.plantId));
        if (plant) showPlantDetails(plant);
    }

    document.addEventListener("click", (event) => {
        const card = event.target.closest("[data-plant-id]");
        if (card) handleCardActivate(card);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".plant-card[data-plant-id]");
        if (card) {
            event.preventDefault();
            handleCardActivate(card);
        }
    });

    const plantCache = new Map();

    function remember(plants) {
        plants.forEach((plant) => plantCache.set(plant.id, plant));
    }


    // =====================================================
    // PLANT LIBRARY
    // =====================================================
    // All plants are downloaded once and filtered in the browser,
    // so searching and filtering feel instant.

    let allPlants = [];

    function renderLibrary() {

        const search = plantSearch ? plantSearch.value.toLowerCase().trim() : "";
        const category = categoryFilter ? categoryFilter.value : "all";
        const sun = sunFilter ? sunFilter.value : "all";
        const water = waterFilter ? waterFilter.value : "all";

        const filtered = allPlants.filter((plant) => {

            const searchMatch =
                !search ||
                plant.name.toLowerCase().includes(search) ||
                plant.scientificName.toLowerCase().includes(search) ||
                plant.tags.some((tag) => tag.toLowerCase().includes(search));

            const categoryMatch =
                category === "all" ||
                plant.tags.some((tag) => tag.toLowerCase() === category);

            const sunMatch = sun === "all" || plant.sun === sun;
            const waterMatch = water === "all" || plant.water === water;

            return searchMatch && categoryMatch && sunMatch && waterMatch;
        });

        if (filtered.length === 0) {
            plantGrid.innerHTML = `
                <div class="state-box">
                    <div class="state-emoji">🌱</div>
                    <h3>No plants found</h3>
                    <p>Try different filters.</p>
                </div>
            `;
            return;
        }

        plantGrid.innerHTML = filtered.map(createPlantCard).join("");
    }

    async function loadPlants() {

        if (!plantGrid) return;

        plantGrid.innerHTML = `
            <div class="state-box"><p>🌱 Loading plants...</p></div>
        `;

        try {
            const data = await api("/plants");
            allPlants = data.plants || [];
            remember(allPlants);
            renderLibrary();

        } catch (error) {
            console.error("Plant loading error:", error);

            plantGrid.innerHTML = `
                <div class="state-box">
                    <h3>⚠️ Could not load plants</h3>
                    <p>${esc(error.message)}</p>
                    <button id="retryPlants" class="retry-btn">Try Again</button>
                </div>
            `;

            const retry = $("retryPlants");
            retry && retry.addEventListener("click", loadPlants);
        }
    }

    [plantSearch, categoryFilter, sunFilter, waterFilter].forEach((control) => {
        if (!control) return;
        control.addEventListener(
            control === plantSearch ? "input" : "change",
            renderLibrary
        );
    });

    document.querySelectorAll(".category-grid button").forEach((button) => {
        button.addEventListener("click", () => {
            if (categoryFilter) categoryFilter.value = button.dataset.category;
            renderLibrary();
            $("plants") && $("plants").scrollIntoView({ behavior: "smooth" });
        });
    });

    loadPlants();


    // =====================================================
    // LIVE STATS (counts come from the database)
    // =====================================================

    function animateCount(element, target) {
        const duration = 1200;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            element.textContent = Math.round(target * progress);
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    async function loadStats() {
        let stats = {};

        try {
            stats = await api("/stats");
        } catch (error) {
            console.warn("Using default stats:", error.message);
        }

        // data-stat="plants|categories|problems" is filled from the database;
        // if the API is down, the number written in data-count is used instead.
        document.querySelectorAll("[data-count]").forEach((element) => {
            const live = stats[element.dataset.stat];
            animateCount(element, live != null ? live : Number(element.dataset.count));
        });
    }

    const statsSection = document.querySelector(".stats");

    if (statsSection && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                loadStats();
            }
        }, { threshold: 0.3 });

        observer.observe(statsSection);
    } else {
        loadStats();
    }


    // =====================================================
    // SMART RECOMMENDATION
    // =====================================================

    if (recommendBtn && recommendationResult) {

        recommendBtn.addEventListener("click", async () => {

            recommendBtn.disabled = true;
            recommendationResult.innerHTML = `<p>🌱 Finding suitable plants...</p>`;

            try {
                const data = await post("/recommend", {
                    environment: $("environment")?.value || "all",
                    sunlight: $("finderSun")?.value || "all",
                    water: $("finderWater")?.value || "all",
                    experience: $("experience")?.value || "all"
                });

                const matches = data.plants || [];
                remember(matches);

                if (matches.length === 0) {
                    recommendationResult.innerHTML = `
                        <div class="plant-card">
                            <div class="plant-image">🌱</div>
                            <h3>No match found</h3>
                            <p>${esc(data.message)}</p>
                        </div>
                    `;
                    return;
                }

                const note = data.exact
                    ? ""
                    : `<p class="result-note">${esc(data.message)}</p>`;

                recommendationResult.innerHTML =
                    note + matches.map(createPlantCard).join("");

            } catch (error) {
                console.error("Recommendation error:", error);

                recommendationResult.innerHTML = `
                    <div class="plant-card">
                        <h3>⚠️ Recommendation Error</h3>
                        <p>${esc(error.message)}</p>
                    </div>
                `;

            } finally {
                recommendBtn.disabled = false;
            }
        });
    }


    // =====================================================
    // PLANT DIAGNOSIS
    // =====================================================

    if (diagnosisButton && diagnosisResult) {

        diagnosisButton.addEventListener("click", async () => {

            const selected = [
                ...document.querySelectorAll(".symptom-box input:checked")
            ].map((input) => input.value);

            if (selected.length === 0) {
                diagnosisResult.innerHTML = `
                    <div class="empty-result">
                        <span>⚠️</span>
                        <h3>Select at least one symptom</h3>
                        <p>Choose symptoms to generate a basic report.</p>
                    </div>
                `;
                return;
            }

            diagnosisButton.disabled = true;
            diagnosisResult.innerHTML = `<p>🔍 Analyzing symptoms...</p>`;

            try {
                const data = await post("/diagnose", { symptoms: selected });
                const problems = data.problems || [];

                if (problems.length === 0) {
                    diagnosisResult.innerHTML = `
                        <div class="empty-result">
                            <span>🌱</span>
                            <h3>No matching problem found</h3>
                            <p>Try selecting another symptom.</p>
                        </div>
                    `;
                    return;
                }

                diagnosisResult.innerHTML = problems.map((problem) => `
                    <div class="diagnosis-item">
                        <strong>
                            ${esc(problem.emoji)} ${esc(problem.name)}
                            <span class="severity severity-${esc(problem.severity)}">
                                ${esc(problem.severity)}
                            </span>
                        </strong>
                        <p><b>Matched symptoms:</b> ${esc(problem.matchedSymptoms.join(", "))}</p>
                        <p><b>Likely cause:</b> ${esc(problem.cause)}</p>
                        <p><b>What to do:</b> ${esc(problem.solution)}</p>
                    </div>
                `).join("");

            } catch (error) {
                console.error("Diagnosis error:", error);

                diagnosisResult.innerHTML = `
                    <div class="empty-result">
                        <span>⚠️</span>
                        <h3>Diagnosis Error</h3>
                        <p>${esc(error.message)}</p>
                    </div>
                `;

            } finally {
                diagnosisButton.disabled = false;
            }
        });
    }


    // =====================================================
    // CARE GUIDES (static, so they work even if the API is down)
    // =====================================================

    const careGuides = {
        water: {
            title: "💧 Watering Guide",
            points: [
                "Check the soil with your finger: water when the top 2-3 cm is dry (succulents: when fully dry).",
                "Water deeply until it drains from the bottom, then empty the saucer.",
                "Overwatering kills more plants than underwatering. Yellow leaves and soggy soil are warning signs.",
                "Water in the early morning; in summer, check pots more often, in winter, less.",
                "Pots must have drainage holes."
            ]
        },
        sun: {
            title: "☀️ Sunlight Guide",
            points: [
                "Low light: a room or corner without direct sun, for example snake plant or ZZ plant.",
                "Partial light: 3-5 hours of soft or morning sun, or bright indirect light.",
                "Bright light: 6+ hours of direct sun, for example roses, hibiscus and most fruit and herbs.",
                "Stretched, pale growth means too little light; brown crispy patches mean too much.",
                "Turn pots every week so the plant grows evenly, and move plants to new light levels gradually."
            ]
        },
        soil: {
            title: "🌱 Soil & Fertilizer Guide",
            points: [
                "Good soil holds some moisture but drains quickly. Add sand or perlite for succulents and coco peat or compost for leafy plants.",
                "Mix compost or vermicompost into garden soil to feed plants slowly.",
                "Feed growing plants every 3-4 weeks in the growing season, and reduce in winter.",
                "More fertilizer is not better: over-feeding burns roots. Use half strength if unsure.",
                "Refresh the top layer of soil or repot once a year."
            ]
        },
        environment: {
            title: "🌡️ Environment Guide",
            points: [
                "Most common plants are happy between 18-30°C. Keep them away from AC vents, heaters and cold drafts.",
                "Humidity-loving plants such as ferns and calatheas benefit from grouping, pebble trays or a humidifier.",
                "Good airflow reduces fungal problems; avoid crowding plants.",
                "Protect plants from midday summer heat with partial shade.",
                "Acclimatize plants gradually when moving them between indoors and outdoors."
            ]
        }
    };

    document.querySelectorAll("[data-care]").forEach((button) => {
        button.addEventListener("click", () => {
            const guide = careGuides[button.dataset.care];
            if (!guide) return;

            openModal(`
                <h2>${esc(guide.title)}</h2>
                <ul class="guide-list">
                    ${guide.points.map((p) => `<li>${esc(p)}</li>`).join("")}
                </ul>
            `);
        });
    });


    // =====================================================
    // SEASONAL GUIDE
    // =====================================================

    document.querySelectorAll("[data-season]").forEach((button) => {
        button.addEventListener("click", async () => {

            if (!seasonResult) return;

            const season = button.dataset.season;
            seasonResult.innerHTML = "🌱 Loading ideas...";

            try {
                const data = await api(`/season/${season}`);
                remember(data.plants);

                seasonResult.innerHTML = `
                    <p class="season-summary">
                        ${esc(data.total)} plants grow well when planted in ${esc(season)}.
                        Here are some ideas:
                    </p>
                    <div class="season-list">
                        ${data.plants.map((plant) => `
                            <button type="button" class="season-chip"
                                    data-plant-id="${esc(plant.id)}">
                                ${esc(plant.emoji)} ${esc(plant.name)}
                            </button>
                        `).join("")}
                    </div>
                `;

            } catch (error) {
                console.error("Season error:", error);
                seasonResult.innerHTML = `⚠️ ${esc(error.message)}`;
            }
        });
    });


    // =====================================================
    // CARE REMINDERS (saved in this browser only)
    // =====================================================

    const reminderForm = $("reminderForm");
    const reminderList = $("reminderList");
    const REMINDER_KEY = "nurseryiq_reminders";

    function loadReminders() {
        try {
            return JSON.parse(localStorage.getItem(REMINDER_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveReminders(reminders) {
        try {
            localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders));
        } catch (e) {
            console.warn("Could not save reminders:", e);
        }
    }

    function renderReminders() {
        if (!reminderList) return;

        const reminders = loadReminders()
            .sort((a, b) => a.date.localeCompare(b.date));

        if (reminders.length === 0) {
            reminderList.innerHTML = "";
            return;
        }

        const today = new Date().toISOString().slice(0, 10);

        reminderList.innerHTML = reminders.map((item) => `
            <div class="reminder-item">
                <span>
                    ${item.date < today ? "⏰ " : ""}${esc(item.plant)} · ${esc(item.type)} · ${esc(item.date)}
                </span>
                <button class="delete-reminder" data-id="${esc(item.id)}"
                        aria-label="Delete reminder">✕</button>
            </div>
        `).join("");
    }

    if (reminderForm) {

        reminderForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const plant = $("reminderPlant").value.trim();
            const type = $("reminderType").value;
            const date = $("reminderDate").value;

            if (!plant || !date) return;

            const reminders = loadReminders();
            reminders.push({ id: Date.now().toString(), plant, type, date });
            saveReminders(reminders);

            reminderForm.reset();
            renderReminders();
        });

        reminderList.addEventListener("click", (event) => {
            const button = event.target.closest(".delete-reminder");
            if (!button) return;

            saveReminders(
                loadReminders().filter((item) => item.id !== button.dataset.id)
            );
            renderReminders();
        });

        renderReminders();
    }

});
