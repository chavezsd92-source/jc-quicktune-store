(() => {
  const BASE = 149;

  const linesEl = document.getElementById("order-lines");
  const totalEl = document.getElementById("order-total");
  const submitTotal = document.getElementById("submit-total");
  const statusEl = document.getElementById("form-status");
  const form = document.getElementById("order-form");

  function money(n) {
    return "$" + n.toLocaleString("en-US");
  }

  function addons() {
    return [...document.querySelectorAll(".addon-input:checked")].map((el) => ({
      name: el.dataset.name || "Add-on",
      price: Number(el.dataset.price) || 0,
    }));
  }

  function total() {
    return BASE + addons().reduce((s, a) => s + a.price, 0);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    const list = addons();
    if (linesEl) {
      linesEl.innerHTML = list
        .map(
          (a) =>
            `<li><span>${esc(a.name)}</span><span>${money(a.price)}</span></li>`
        )
        .join("");
    }
    const t = total();
    if (totalEl) totalEl.textContent = money(t);
    if (submitTotal) submitTotal.textContent = String(t);
  }

  document.querySelectorAll(".addon-input").forEach((el) => {
    el.addEventListener("change", render);
  });
  render();

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const unlock = String(fd.get("unlock") || "");

    if (unlock === "not-unlocked") {
      if (statusEl) {
        statusEl.className = "status err";
        statusEl.textContent =
          "Hold up — the DME must already be unlocked (B48 Quickflash or similar) before ordering a full-flash BIN.";
      }
      return;
    }

    if (!fd.get("fullflash") || !fd.get("backup")) {
      if (statusEl) {
        statusEl.className = "status err";
        statusEl.textContent =
          "Check both boxes: full BIN flash + stock backup.";
      }
      return;
    }

    const list = addons();
    const t = total();
    const hardware = String(fd.get("hardware") || "");
    const notes = String(fd.get("notes") || "").trim();
    if (hardware === "modified" && notes.length < 8) {
      if (statusEl) {
        statusEl.className = "status err";
        statusEl.textContent =
          "Modified car — list every mod in Notes (intake, DP, IC, exhaust, fuel, etc.).";
      }
      return;
    }

    const order = {
      product: "JC dual-mode full flash base",
      base: BASE,
      addons: list,
      total: t,
      name: fd.get("name"),
      email: fd.get("email"),
      vehicle: fd.get("vehicle"),
      software: fd.get("software"),
      unlock: unlock,
      tool: fd.get("tool"),
      hardware: hardware,
      notes: notes,
      fullFlashAcknowledged: true,
      stockBackupAcknowledged: true,
      stockBaseline: hardware === "all-stock",
      createdAt: new Date().toISOString(),
    };

    try {
      const key = "jcqt_tune_orders";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push(order);
      localStorage.setItem(key, JSON.stringify(prev));
    } catch (_) {
      /* ignore */
    }

    const text = [
      "JC QuickTune — order request",
      "===========================",
      `Total: $${t}`,
      `Base dual-mode full flash: $${BASE}`,
      ...list.map((a) => `Add-on: ${a.name} (+$${a.price})`),
      "",
      `Name: ${order.name}`,
      `Email: ${order.email}`,
      `Vehicle: ${order.vehicle}`,
      `SWFL/SWFK: ${order.software}`,
      `DME unlock status: ${order.unlock}`,
      `Flash tool: ${order.tool}`,
      `Hardware: ${order.hardware}`,
      `Notes / mods: ${order.notes || "—"}`,
      "",
      "Customer confirmed: full BIN flash required",
      "Customer confirmed: stock BIN backup",
      "DME must already be unlocked (B48 Quickflash or similar) — not provided by this product",
      "Power figures on site are for all-stock hardware (JC Street Dyno verified + datalogs)",
    ].join("\n");

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    // Offer a downloadable .txt as a human fallback
    try {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jc-quicktune-order.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      /* ignore */
    }

    if (statusEl) {
      statusEl.className = "status ok";
      statusEl.textContent =
        `Order text ready (copied if browser allowed) · $${t}. Email that file/text to complete payment offline until checkout is wired.`;
    }

    form.reset();
    document.querySelectorAll(".addon-input").forEach((el) => {
      el.checked = false;
    });
    render();
  });
})();
