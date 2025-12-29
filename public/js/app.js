const app = {
  apiBase: "/api",
  state: {
    user: null,
    token: localStorage.getItem("token"),
    currentView: "dashboard",
    isLoginMode: true,
    bakeries: [],
    favorites: [], // Store favorite bakery IDs
    page: 1,
    limit: 6,
  },

  init: async () => {
    // Check auth
    if (app.state.token) {
      try {
        const res = await fetch(`${app.apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${app.state.token}` },
        });
        const data = await res.json();
        if (data.success) {
          app.state.user = data.user;
        } else {
          app.logout();
        }
      } catch (e) {
        app.logout();
      }
    }

    app.updateUI();
    // Load favorites if user is logged in
    if (app.state.user) {
      await app.loadFavorites();
    }
    app.navigate("dashboard");

    // Event Listeners
    document
      .getElementById("auth-form")
      .addEventListener("submit", app.handleAuth);
    document
      .getElementById("bakery-form")
      .addEventListener("submit", app.handleBakerySubmit);
    document
      .getElementById("search-input")
      .addEventListener("input", app.debounce(app.fetchBakeries, 500));
    document
      .getElementById("status-filter")
      .addEventListener("change", app.fetchBakeries);
    document
      .getElementById("scraping-form")
      .addEventListener("submit", app.handleScrapingSubmit);
  },

  updateUI: () => {
    const isAuth = !!app.state.user;
    document
      .querySelectorAll(".auth-only")
      .forEach((el) => el.classList.toggle("hidden", !isAuth));
    document
      .querySelectorAll(".guest-only")
      .forEach((el) => el.classList.toggle("hidden", isAuth));
  },

  navigate: (viewId) => {
    app.state.currentView = viewId;
    document
      .querySelectorAll(".view")
      .forEach((el) => el.classList.add("hidden"));

    // Handle views
    if (viewId === "dashboard") {
      document.getElementById("dashboard-view").classList.remove("hidden");
      app.fetchBakeries();
    } else if (viewId === "login") {
      document.getElementById("auth-view").classList.remove("hidden");
    } else if (viewId === "favorites") {
      if (!app.state.user) return app.navigate("login");
      document.getElementById("favorites-view").classList.remove("hidden");
      app.fetchFavorites();
    } else if (viewId === "add-bakery") {
      if (!app.state.user) return app.navigate("login");
      document.getElementById("item-form-view").classList.remove("hidden");
      document.getElementById("form-title").innerText = "Add New Bakery";
      document.getElementById("bakery-form").reset();
      document.getElementById("bakery-id").value = "";
    } else if (viewId === "scraping") {
      if (!app.state.user) return app.navigate("login");
      document.getElementById("scraping-view").classList.remove("hidden");
    }
  },

  editItem: (id) => {
    const item = app.state.bakeries.find((b) => b.id === id);
    if (!item) return;

    app.navigate("add-bakery"); // Re-use the form view (we'll customize it below)
    document.getElementById("item-form-view").classList.remove("hidden"); // Ensure it's visible (navigate does this, but clarifying intent)
    document.getElementById("form-title").innerText = "Edit Bakery";

    document.getElementById("bakery-id").value = item.id;
    document.getElementById("bakery-name").value = item.name;
    document.getElementById("bakery-city").value = item.city;
    document.getElementById("bakery-specialties").value =
      item.specialties || "";
    document.getElementById("bakery-price").value = item.average_price || "";
    document.getElementById("bakery-status").value = item.status;
    document.getElementById("bakery-image").value = item.image_url || "";
  },

  toggleAuthMode: () => {
    app.state.isLoginMode = !app.state.isLoginMode;
    document.getElementById("auth-title").innerText = app.state.isLoginMode
      ? "Welcome Back"
      : "Create Account";
    document.getElementById("auth-submit").innerText = app.state.isLoginMode
      ? "Login"
      : "Register";
    document.getElementById("auth-switch-text").innerText = app.state
      .isLoginMode
      ? "Don't have an account?"
      : "Already have an account?";
    document.getElementById("auth-switch-link").innerText = app.state
      .isLoginMode
      ? "Sign up"
      : "Login";
    document.getElementById("username-group").style.display = app.state
      .isLoginMode
      ? "none"
      : "block";
  },

  handleAuth: async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const username = document.getElementById("username").value;

    const endpoint = app.state.isLoginMode ? "/auth/login" : "/auth/register";
    const body = app.state.isLoginMode
      ? { email, password }
      : { email, password, username };

    try {
      const res = await fetch(`${app.apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        app.state.token = data.token;
        app.state.user = data.user;
        localStorage.setItem("token", data.token);
        app.updateUI();
        app.navigate("dashboard");
        app.notify("Success", "Welcome back!");
      } else {
        app.notify("Error", data.message);
      }
    } catch (err) {
      app.notify("Error", "Something went wrong");
    }
  },

  logout: () => {
    app.state.user = null;
    app.state.token = null;
    app.state.favorites = []; // Clear favorites on logout
    localStorage.removeItem("token");
    app.updateUI();
    app.navigate("dashboard");
  },

  fetchBakeries: async () => {
    const query = document.getElementById("search-input").value;
    const status = document.getElementById("status-filter").value;

    // Add auth header if available for getting user-specific data logic
    const headers = {};
    if (app.state.token) headers["Authorization"] = `Bearer ${app.state.token}`;

    try {
      const res = await fetch(
        `${app.apiBase}/items?page=${app.state.page}&limit=${app.state.limit}&search=${query}&status=${status}`,
        { headers }
      );
      const data = await res.json();

      if (data.success) {
        app.state.bakeries = data.data; // Store locally for edit lookup
        app.renderGrid(data.data, "bakery-grid");
        document.getElementById(
          "page-info"
        ).innerText = `Page ${data.pagination.page} of ${data.pagination.totalPages}`;
      }
    } catch (err) {
      console.error(err);
    }
  },

  loadFavorites: async () => {
    try {
      const res = await fetch(`${app.apiBase}/favorites/my-favorites`, {
        headers: { Authorization: `Bearer ${app.state.token}` },
      });
      const data = await res.json();
      if (data.success) {
        // Store favorite IDs in state
        app.state.favorites = data.data.map((item) => item.id);
      }
    } catch (err) {
      console.error(err);
    }
  },

  fetchFavorites: async () => {
    await app.loadFavorites();
    try {
      const res = await fetch(`${app.apiBase}/favorites/my-favorites`, {
        headers: { Authorization: `Bearer ${app.state.token}` },
      });
      const data = await res.json();
      if (data.success) {
        app.renderGrid(data.data, "favorites-grid", true);
      }
    } catch (err) {
      console.error(err);
    }
  },

  renderGrid: (items, targetId, isFavView = false) => {
    const container = document.getElementById(targetId);
    container.innerHTML = "";

    if (items.length === 0) {
      container.innerHTML =
        '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No bakeries found.</p>';
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
                <img src="${
                  item.image_url ||
                  "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop"
                }" class="card-img" alt="${item.name}">
                <button class="fav-btn ${
                  isFavView || app.state.favorites.includes(item.id)
                    ? "active"
                    : ""
                }" onclick="app.toggleFavorite('${item.id}')">
                    <i class="fa-solid fa-heart"></i>
                </button>
                <div class="card-body">
                    <div class="card-meta">
                        <span class="badge ${item.status}">${item.status}</span>
                        <div class="star-rating" data-id="${
                          item.id
                        }" data-rating="${item.rating || 0}">
                             ${app.renderStars(item.rating || 0, item.id)}
                        </div>
                    </div>
                    <h3>${item.name}</h3>
                    <p style="color:var(--text-muted); font-size: 0.9em; margin-bottom: 10px;">${
                      item.city
                    } • ${item.specialties || "General"}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold;">$${
                          item.average_price || "N/A"
                        }</span>
                        ${
                          app.state.user &&
                          item.created_by === app.state.user.id
                            ? `
                            <div style="display:flex; gap:5px;">
                                <button class="btn-outline" style="padding: 5px 10px; font-size:0.8rem; border-color: var(--primary); color: var(--primary);" onclick="app.editItem('${item.id}')">Edit</button>
                                <button class="btn-outline" style="padding: 5px 10px; font-size:0.8rem; border-color: #ef4444; color: #ef4444;" onclick="app.deleteItem('${item.id}')">Delete</button>
                            </div>
                            `
                            : ""
                        }
                    </div>
                </div>
            `;
      container.appendChild(card);
    });
  },

  toggleFavorite: async (itemId) => {
    if (!app.state.user)
      return app.notify("Info", "Please login to add favorites");

    // Simple toggle logic (optimistic UI could be better but simplified here)
    // Check if we are in fav view or list view
    // For now, assume "Add" unless error "Already favorite" -> then "Remove"
    // THIS LOGIC IS FLAWED without knowing current state.
    // Better: Favorites API should toggle or we check state.
    // For simplicity: Try Add, if 400 'Aleady a favorite', try Remove.

    try {
      const res = await fetch(`${app.apiBase}/favorites/${itemId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${app.state.token}` },
      });
      const data = await res.json();

      if (data.success) {
        app.notify("Success", "Added to favorites");
        // Add to local state
        app.state.favorites.push(itemId);
        // Update UI immediately on dashboard
        if (app.state.currentView === "dashboard") app.fetchBakeries();
      } else if (data.message === "Already a favorite") {
        // Remove
        const del = await fetch(`${app.apiBase}/favorites/${itemId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${app.state.token}` },
        });
        const delData = await del.json();
        if (delData.success) {
          app.notify("Success", "Removed from favorites");
          // Remove from local state
          app.state.favorites = app.state.favorites.filter(
            (id) => id !== itemId
          );
          // Update UI
          if (app.state.currentView === "favorites") {
            app.fetchFavorites();
          } else if (app.state.currentView === "dashboard") {
            app.fetchBakeries();
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  handleBakerySubmit: async (e) => {
    e.preventDefault();
    const name = document.getElementById("bakery-name").value;
    const city = document.getElementById("bakery-city").value;
    const specialties = document.getElementById("bakery-specialties").value;
    const average_price = document.getElementById("bakery-price").value;
    const status = document.getElementById("bakery-status").value;
    const image_url = document.getElementById("bakery-image").value;

    const id = document.getElementById("bakery-id").value;
    const method = id ? "PUT" : "POST";
    const url = id ? `${app.apiBase}/items/${id}` : `${app.apiBase}/items`;

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${app.state.token}`,
        },
        body: JSON.stringify({
          name,
          city,
          specialties,
          average_price,
          status,
          image_url,
        }),
      });
      const data = await res.json();
      if (data.success) {
        app.notify("Success", id ? "Bakery updated!" : "Bakery added!");
        app.navigate("dashboard");
      } else {
        app.notify("Error", data.message);
      }
    } catch (err) {
      app.notify("Error", "Failed to add bakery");
    }
  },

  deleteItem: async (id) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`${app.apiBase}/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${app.state.token}` },
      });
      const data = await res.json();
      if (data.success) {
        app.fetchBakeries();
      } else {
        app.notify("Error", data.message);
      }
    } catch (err) {
      console.error(err);
    }
  },

  handleScrapingSubmit: async (e) => {
    e.preventDefault();
    const businessType = document.getElementById("scrap-type").value;
    const city = document.getElementById("scrap-city").value;
    const country = document.getElementById("scrap-country").value;
    const maxLeads = document.getElementById("scrap-max").value;

    app.triggerScraping({ businessType, city, country, maxLeads });
  },

  triggerScraping: async (payload) => {
    // Loading State
    const btn = document.getElementById("btn-scrape");
    const originalText = btn ? btn.innerHTML : "Start Scraping";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    }

    try {
      const res = await fetch(`${app.apiBase}/scraping/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${app.state.token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Show Success Modal
        const modal = document.getElementById("success-modal");
        const linkBtn = document.getElementById("open-sheet-btn");

        // Use user provided hardcoded link
        linkBtn.href =
          "https://docs.google.com/spreadsheets/d/1UJMpuMOlUHp1COWJsYyvBUlbNEec2yzfo_k39Q-1cnk/edit?gid=0#gid=0";

        modal.classList.add("active");
        app.notify("Success", "Scraping completed successfully!");
      } else {
        app.notify("Error", data.message);
      }
    } catch (err) {
      console.error(err);
      app.notify("Error", "Failed to trigger scraping");
    } finally {
      // Reset Button
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  closeModal: () => {
    document.getElementById("success-modal").classList.remove("active");
  },

  notify: (type, msg) => {
    const area = document.getElementById("notification-area");
    const notif = document.createElement("div");

    // Classes
    notif.className = `toast toast-${type === "Error" ? "error" : "success"}`;
    if (type === "Info") notif.className = "toast toast-info";

    // Icon
    let icon = "fa-check-circle";
    if (type === "Error") icon = "fa-exclamation-circle";
    if (type === "Info") icon = "fa-info-circle";

    notif.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${msg}</span>
    `;

    area.appendChild(notif);

    // Auto remove with animation
    setTimeout(() => {
      notif.classList.add("slide-out");
      notif.addEventListener("animationend", () => {
        if (notif.parentNode) notif.remove();
      });
    }, 3000);
  },

  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  nextPage: () => {
    app.state.page++;
    app.fetchBakeries();
  },

  prevPage: () => {
    if (app.state.page > 1) {
      app.state.page--;
      app.fetchBakeries();
    }
  },

  renderStars: (rating, itemId) => {
    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
      let starClass = "fa-regular fa-star"; // Empty
      if (i <= Math.round(rating)) starClass = "fa-solid fa-star"; // Full

      // Add onclick to trigger rating
      starsHtml += `<i class="${starClass}" style="color:var(--primary); cursor:pointer;" onclick="app.rateBakery('${itemId}', ${i}); event.stopPropagation();"></i>`;
    }
    return `<span>${starsHtml} <span style="font-size:0.8em; color:var(--text-muted)">(${
      rating ? rating : 0
    })</span></span>`;
  },

  rateBakery: async (bakeryId, score) => {
    if (!app.state.user) return app.notify("Info", "Login to rate!");

    try {
      const res = await fetch(`${app.apiBase}/ratings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${app.state.token}`,
        },
        body: JSON.stringify({ bakeryId, score }),
      });

      const data = await res.json();
      if (data.success) {
        app.notify("Success", "Rating submitted!");
        // Update local state and re-render
        const bakery = app.state.bakeries.find((b) => b.id === bakeryId);
        if (bakery) {
          bakery.rating = data.newRating;
          app.renderGrid(app.state.bakeries, "bakery-grid");
        }
      } else {
        app.notify("Error", data.message);
      }
    } catch (err) {
      app.notify("Error", "Failed to rate");
    }
  },
};

// Mobile Menu Toggle
window.toggleMenu = () => {
  const navLinks = document.querySelector(".nav-links");
  navLinks.classList.toggle("active");
};

// Start
document.addEventListener("DOMContentLoaded", app.init);
