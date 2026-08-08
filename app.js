(() => {
  const BASE = 149;

  // Mode tabs
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.mode;
      document.getElementById("mode-comfort")?.classList.toggle("hidden", mode !== "comfort");
      document.getElementById("mode-sport")?.classList.toggle("hidden", mode !== "sport");
    });
  });

  const linesEl = document.getElementById("order-lines");
  const totalEl = document.getElementById("order-total");
  const submitTotal = document.getElementById("submit-total");
  const statusEl = document.getElementById("form-status");
  const form = document.getElementById("order-form");

  function formatMoney(n) {
    return `$${n.toLocaleString("en-US")}`;
  }

  function selectedAddons() {
    return [...document.querySelectorAll(".addon-input:checked")].map((el) => ({
      name: el.dataset.name || "Add-on",
      price: Number(el.dataset.price) || 0,
    }));
  }

  function total() {
    return BASE + selectedAddons().reduce((s, a) => s + a.price, 0);
  }

  function renderOrder() {
    if (!linesEl || !totalEl) return;
    const addons = selectedAddons();
    const rows = [
      `<li><span>Base dual-mode tune</span><span>${formatMoney(BASE)}</span></li>`,
      ...addons.map(
        (a) =>
          `<li><span>${escapeHtml(a.name)}</span><span>${formatMoney(a.price)}</span></li>`
      ),
    ];
    linesEl.innerHTML = rows.join("");
    const t = total();
    totalEl.textContent = formatMoney(t);
    if (submitTotal) submitTotal.textContent = String(t);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.querySelectorAll(".addon-input").forEach((el) => {
    el.addEventListener("change", renderOrder);
  });
  renderOrder();

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const addons = selectedAddons();
    const t = total();
    const summary = {
      product: "JC Street Dual-Mode Base",
      base: BASE,
      addons,
      total: t,
      name: fd.get("name"),
      email: fd.get("email"),
      vehicle: fd.get("vehicle"),
      tool: fd.get("tool"),
      notes: fd.get("notes"),
      createdAt: new Date().toISOString(),
    };

    // Persist locally for you to wire to a backend later
    try {
      const key = "jcqt_tune_orders";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push(summary);
      localStorage.setItem(key, JSON.stringify(prev));
    } catch (_) {
      /* ignore */
    }

    // Also copy a plain-text order to clipboard when possible
    const text = [
      "JC QuickTune order request",
      `Total: $${t}`,
      `Base: $${BASE}`,
      ...addons.map((a) => `+ ${a.name}: $${a.price}`),
      `Name: ${summary.name}`,
      `Email: ${summary.email}`,
      `Vehicle: ${summary.vehicle}`,
      `Tool: ${summary.tool}`,
      `Notes: ${summary.notes || "—"}`,
    ].join("\n");

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    if (statusEl) {
      statusEl.textContent =
        `Order saved locally · $${t} · ${summary.email}. Wire this form to Stripe/email when ready.`;
      statusEl.style.color = "#3ecf8e";
    }

    form.reset();
    document.querySelectorAll(".addon-input").forEach((el) => {
      el.checked = false;
    });
    renderOrder();
  });
})();
