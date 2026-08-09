/**
 * JC QuickTune Stage 1 builder chat
 * - Offline guided builder (works on GitHub Pages)
 * - Optional Grok via POST /api/chat (Cloudflare Pages Function + XAI_API_KEY)
 */
(() => {
  const BASE = 149;
  const ADDONS = {
    cooling: { name: "Texas Max Cooling", price: 49, key: "cooling" },
    burble: { name: "Extra Crackle Burble", price: 39, key: "burble" },
    spicy: { name: "Spicy Pedal Sport", price: 59, key: "spicy" },
    torque: { name: "High Torque Package", price: 79, key: "torque" },
    logs: { name: "Log Review Session", price: 29, key: "logs" },
    priority: { name: "Priority Custom Revision", price: 99, key: "priority" },
  };

  const state = {
    messages: [],
    profile: {
      vehicle: "",
      hardware: "", // all-stock | modified
      mods: "",
      fuel: "93",
      goals: [],
      unlock: "",
      software: "",
      transmission: "",
      addons: {
        cooling: false,
        burble: false,
        spicy: false,
        torque: false,
        logs: false,
        priority: false,
      },
    },
    step: "intro",
    usingGrok: false,
  };

  const logEl = document.getElementById("chat-log");
  const suggestEl = document.getElementById("suggest-row");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("chat-input");
  const modeLabel = document.getElementById("chat-mode-label");
  const resetBtn = document.getElementById("chat-reset");

  // ——— UI helpers ———
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function appendMessage(role, text, suggestions) {
    if (!logEl) return;
    const row = el("div", `msg msg-${role}`);
    const bubble = el("div", "msg-bubble");
    // simple paragraphs
    String(text)
      .split(/\n+/)
      .filter(Boolean)
      .forEach((p) => {
        const para = el("p", null, p);
        bubble.appendChild(para);
      });
    row.appendChild(bubble);
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;

    state.messages.push({ role, content: text });
    if (suggestions) renderSuggestions(suggestions);
  }

  function renderSuggestions(items) {
    if (!suggestEl) return;
    suggestEl.innerHTML = "";
    (items || []).forEach((s) => {
      const b = el("button", "chip", typeof s === "string" ? s : s.label);
      b.type = "button";
      b.addEventListener("click", () => {
        const val = typeof s === "string" ? s : s.value || s.label;
        inputEl.value = val;
        formEl.requestSubmit();
      });
      suggestEl.appendChild(b);
    });
  }

  function setTyping(on) {
    let t = document.getElementById("typing-row");
    if (on) {
      if (t) return;
      t = el("div", "msg msg-assistant");
      t.id = "typing-row";
      t.appendChild(el("div", "msg-bubble typing", "Thinking…"));
      logEl.appendChild(t);
      logEl.scrollTop = logEl.scrollHeight;
    } else if (t) {
      t.remove();
    }
  }

  // ——— Package UI sync ———
  function packageTotal() {
    let t = BASE;
    Object.keys(state.profile.addons).forEach((k) => {
      if (state.profile.addons[k] && ADDONS[k]) t += ADDONS[k].price;
    });
    return t;
  }

  function syncPackageUI() {
    const lines = document.getElementById("pkg-lines");
    const total = document.getElementById("pkg-total");
    if (lines) {
      const items = [`<li><span>Stage 1 dual-mode base</span><span>$149</span></li>`];
      Object.keys(state.profile.addons).forEach((k) => {
        if (state.profile.addons[k] && ADDONS[k]) {
          items.push(
            `<li><span>${ADDONS[k].name}</span><span>+$${ADDONS[k].price}</span></li>`
          );
        }
      });
      lines.innerHTML = items.join("");
    }
    if (total) total.textContent = "$" + packageTotal();

    // checkboxes
    document.querySelectorAll(".addon-input").forEach((cb) => {
      const key = cb.dataset.key;
      if (key && key in state.profile.addons) {
        cb.checked = !!state.profile.addons[key];
      }
    });

    // facts
    const set = (id, v) => {
      const n = document.getElementById(id);
      if (n) n.textContent = v || "—";
    };
    set("fact-vehicle", state.profile.vehicle || "—");
    set(
      "fact-hardware",
      state.profile.hardware === "all-stock"
        ? "All stock"
        : state.profile.hardware === "modified"
          ? "Modified: " + (state.profile.mods || "list mods")
          : "—"
    );
    set("fact-fuel", state.profile.fuel ? state.profile.fuel + " AKI" : "—");
    set(
      "fact-goals",
      state.profile.goals.length ? state.profile.goals.join(", ") : "—"
    );
    set(
      "fact-unlock",
      state.profile.unlock === "unlocked-quickflash"
        ? "DME unlocked · Quickflash"
        : state.profile.unlock === "unlocked-other"
          ? "DME unlocked · other tool"
          : state.profile.unlock === "not-unlocked"
            ? "Not unlocked yet"
            : "—"
    );
    set("fact-software", state.profile.software || "—");

    // order form
    const ov = document.getElementById("order-vehicle");
    const os = document.getElementById("order-software");
    const ou = document.getElementById("order-unlock");
    const oh = document.getElementById("order-hardware");
    const on = document.getElementById("order-notes");
    if (ov && state.profile.vehicle) ov.value = state.profile.vehicle;
    if (os && state.profile.software) os.value = state.profile.software;
    if (ou && state.profile.unlock) ou.value = state.profile.unlock;
    if (oh && state.profile.hardware) oh.value = state.profile.hardware;
    if (on) {
      const bits = [];
      if (state.profile.mods) bits.push("Mods: " + state.profile.mods);
      if (state.profile.goals.length) bits.push("Goals: " + state.profile.goals.join(", "));
      if (state.profile.fuel) bits.push("Fuel: " + state.profile.fuel);
      if (bits.length) on.value = bits.join(" · ");
    }

    // notify pricing
    window.dispatchEvent(new CustomEvent("jcqt-package-change", { detail: state.profile }));
  }

  // ——— Extractors from free text ———
  function absorb(text) {
    const t = text.toLowerCase();
    const p = state.profile;

    if (/\b(230i|330i|430i|x3|x4|m240|b48|b46|f22|f30|f32|g20|g01)\b/i.test(text)) {
      if (!p.vehicle || p.vehicle.length < text.length) {
        // keep richer vehicle strings
        if (/20\d{2}/.test(text) || /230i|b48|b46/i.test(text)) {
          p.vehicle = p.vehicle && p.vehicle.length > 12 ? p.vehicle : text.trim().slice(0, 120);
        }
      }
    }
    if (/all\s*stock|bone stock|stock car|completely stock|oem stock/.test(t)) {
      p.hardware = "all-stock";
    }
    if (/modif|downpipe|catless|intake|intercooler|charge.?pipe|exhaust|ethanol|e85|hybrid|turbo upgrade/.test(t)) {
      p.hardware = "modified";
      p.mods = text.trim().slice(0, 200);
    }
    if (/\b93\b|premium|aki/.test(t)) p.fuel = "93";
    if (/\b91\b/.test(t)) p.fuel = "91";
    if (/e85|flex/.test(t)) p.fuel = "E85 mix";

    if (/auto|zf8|zf 8|automatic|dct|8hp/.test(t)) p.transmission = "auto";
    if (/\bmt\b|manual|6.?speed manual/.test(t)) p.transmission = "mt";

    if (/quickflash|b48 quickflash/.test(t) && /unlock/.test(t)) {
      p.unlock = "unlocked-quickflash";
    } else if (/already unlock|dme unlock|unlocked/.test(t) && !/not unlock/.test(t)) {
      p.unlock = p.unlock || "unlocked-other";
    }
    if (/not unlock|still locked|locked dme|haven't unlock|havent unlock/.test(t)) {
      p.unlock = "not-unlocked";
    }

    if (/080[._\s]?017|3076|437f|swfl|swfk/i.test(text)) {
      p.software = text.trim().slice(0, 100);
    }

    if (/cool|texas|heat|hot climate|fan/.test(t)) {
      p.addons.cooling = true;
      if (!p.goals.includes("cooling")) p.goals.push("cooling");
    }
    if (/burble|crackle|pop|bang|sound/.test(t)) {
      p.addons.burble = /extra|loud|aggressive|max/.test(t) ? true : p.addons.burble;
      if (!p.goals.includes("sport burble")) p.goals.push("sport burble");
    }
    if (/spicy|sharp tip|hard tip|aggressive pedal/.test(t)) {
      p.addons.spicy = true;
      if (!p.goals.includes("spicy pedal")) p.goals.push("spicy pedal");
    }
    if (/high torque|more torque|torque package|max torque/.test(t)) {
      p.addons.torque = true;
      if (!p.goals.includes("high torque")) p.goals.push("high torque");
    }
    if (/log review|review my log|datalog review/.test(t)) {
      p.addons.logs = true;
    }
    if (/mpg|economy|efficient|daily|commute|comfort/.test(t)) {
      if (!p.goals.includes("comfort economy")) p.goals.push("comfort economy");
    }
    if (/sport|fast|throttle|response|acceleration|pull/.test(t)) {
      if (!p.goals.includes("sport feel")) p.goals.push("sport feel");
    }

    // plain vehicle capture if empty
    if (!p.vehicle && /230i|b48|b46|bmw/i.test(text) && text.length < 80) {
      p.vehicle = text.trim();
    }
  }

  function nextSuggestions() {
    const p = state.profile;
    const chips = [];
    if (!p.vehicle) {
      return [
        "2017 230i auto, all stock",
        "2018 230i manual, all stock",
        "F30 330i B48, all stock",
      ];
    }
    if (!p.hardware) {
      return ["All stock hardware", "Modified — I'll list parts", "Stock turbo, aftermarket intake only"];
    }
    if (p.hardware === "modified" && !p.mods) {
      return ["Catless downpipe + intake", "Intake + charge pipe", "List my mods in one message"];
    }
    if (!p.unlock) {
      return [
        "DME unlocked with B48 Quickflash",
        "DME unlocked with another tool",
        "DME not unlocked yet",
      ];
    }
    if (p.unlock === "not-unlocked") {
      return ["I'll unlock with Quickflash first", "What tool do I need?", "Start over"];
    }
    if (!p.software) {
      return [
        "I'll paste SWFL/SWFK next",
        "SWFL 3076 v080_017_003",
        "Skip software for now",
      ];
    }
    // package / goals
    chips.push("Just base Stage 1 dual-mode");
    if (!p.addons.cooling) chips.push("Add Texas Max Cooling");
    if (!p.addons.burble) chips.push("Louder Sport burbles");
    if (!p.addons.spicy) chips.push("Spicy Sport pedal");
    if (!p.addons.torque) chips.push("High Torque Package");
    chips.push("Looks good — show my package");
    chips.push("Continue to order");
    return chips.slice(0, 6);
  }

  function offlineReply(userText) {
    absorb(userText);
    const p = state.profile;
    const t = userText.toLowerCase().trim();

    if (t === "start over" || t === "reset") {
      return intro(true);
    }

    if (p.unlock === "not-unlocked" && state.step !== "blocked") {
      state.step = "blocked";
      return {
        text:
          "Hold up — this is a full BIN flash. The DME has to be unlocked first with B48 Quickflash (or similar). " +
          "I can’t put unlock into the file. Once Quickflash shows unlock detected / full-flash capable, come back and we’ll finish the Stage 1 package.",
        suggestions: nextSuggestions(),
      };
    }

    if (!p.vehicle) {
      state.step = "vehicle";
      return {
        text:
          "Got it. What’s the car? Year, model (e.g. 230i), auto or manual helps. " +
          "Base Stage 1 assumes B46/B48 MG1.",
        suggestions: nextSuggestions(),
      };
    }

    if (!p.hardware) {
      state.step = "hardware";
      return {
        text:
          `Noted: **${p.vehicle}**. Is the car all stock (intake/turbo/exhaust/cooling/fuel), or modified? ` +
          `Power numbers on the site are for all-stock — mods change how we build the file.`,
        suggestions: nextSuggestions(),
      };
    }

    if (p.hardware === "modified" && (!p.mods || p.mods.length < 6) && !/list|intake|pipe|exhaust|down/i.test(userText)) {
      state.step = "mods";
      return {
        text: "List every mod you can think of (intake, downpipe, IC, exhaust, ethanol, turbo, clutch…). One message is fine.",
        suggestions: nextSuggestions(),
      };
    }

    if (!p.unlock) {
      state.step = "unlock";
      return {
        text:
          "Is the DME already unlocked for full flash (B48 Quickflash or another full-flash tool)? " +
          "Required before we send a BIN.",
        suggestions: nextSuggestions(),
      };
    }

    if (p.unlock === "not-unlocked") {
      return {
        text:
          "Unlock the DME first, then we can build the Stage 1 dual-mode package. " +
          "Nothing else to configure until that path is open.",
        suggestions: nextSuggestions(),
      };
    }

    if (!p.software && state.step !== "goals" && state.step !== "package") {
      // soft ask once
      if (state.step !== "software") {
        state.step = "software";
        return {
          text:
            "If you have it, paste SWFL / SWFK from Quickflash (example: 3076 v080_017_003). " +
            "Or say “skip software” and we’ll collect it before delivery.",
          suggestions: nextSuggestions(),
        };
      }
    }

    if (/skip software/.test(t)) {
      p.software = p.software || "(to be confirmed before delivery)";
    }

    // Goals / package
    if (/show my package|looks good|what.?s my total|package|order/.test(t) || state.step === "package") {
      state.step = "package";
      return packageSummary();
    }

    if (/just base|base only|dual-mode only|stock stage 1/.test(t)) {
      Object.keys(p.addons).forEach((k) => {
        p.addons[k] = false;
      });
      state.step = "package";
      return packageSummary(
        "Base Stage 1 dual-mode only — Comfort for daily, Sport for throttle and noise."
      );
    }

    if (/add texas|cooling|max cool/.test(t)) p.addons.cooling = true;
    if (/louder|extra crackle|burble\+/.test(t)) p.addons.burble = true;
    if (/spicy/.test(t)) p.addons.spicy = true;
    if (/high torque/.test(t)) p.addons.torque = true;

    if (/continue to order/.test(t)) {
      state.step = "package";
      const sum = packageSummary("Package locked in. Scroll to Order and confirm the form — I’ll have prefilled what I know.");
      setTimeout(() => {
        document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
      }, 400);
      return sum;
    }

    // default progress into goals
    state.step = "goals";
    absorb(userText);
    const want = [];
    if (p.addons.cooling) want.push("Texas cooling");
    if (p.addons.burble) want.push("extra burble");
    if (p.addons.spicy) want.push("spicy pedal");
    if (p.addons.torque) want.push("high torque");

    return {
      text:
        `Building a Stage 1 dual-mode for ${p.vehicle || "your B46/B48"}` +
        (p.hardware === "all-stock" ? " (all stock)" : " (modified — we’ll use your mod list)") +
        ` on ${p.fuel || "93"} AKI.\n\n` +
        `Sport side: immediate tip-in and hard acceleration when you dig in; Comfort stays quieter for the week. ` +
        `Switch personality on the fly with drive mode.\n\n` +
        (want.length ? `Add-ons so far: ${want.join(", ")}.\n\n` : "") +
        `Want extra cooling, louder Sport burble, spicier pedal, or high-torque ceilings — or just base Stage 1?`,
      suggestions: nextSuggestions(),
    };
  }

  function packageSummary(prefix) {
    const p = state.profile;
    const lines = [`Stage 1 dual-mode base — $149`];
    let total = BASE;
    Object.keys(p.addons).forEach((k) => {
      if (p.addons[k] && ADDONS[k]) {
        lines.push(`${ADDONS[k].name} — +$${ADDONS[k].price}`);
        total += ADDONS[k].price;
      }
    });
    const text =
      (prefix ? prefix + "\n\n" : "") +
      `Your Stage 1 package (all-stock figures: ~285–295 rwhp · ~335–355 lb-ft wheels):\n` +
      lines.map((l) => "• " + l).join("\n") +
      `\n\nTotal: $${total}\n\n` +
      `Next: confirm DME unlock + SWFL/SWFK on the order form, stock backup, then generate the order text.`;
    return {
      text,
      suggestions: [
        "Continue to order",
        "Add Texas Max Cooling",
        "Louder Sport burbles",
        "Just base Stage 1 dual-mode",
        "Start over",
      ],
    };
  }

  function intro(isReset) {
    state.step = "intro";
    if (isReset) {
      state.profile = {
        vehicle: "",
        hardware: "",
        mods: "",
        fuel: "93",
        goals: [],
        unlock: "",
        software: "",
        transmission: "",
        addons: {
          cooling: false,
          burble: false,
          spicy: false,
          torque: false,
          logs: false,
          priority: false,
        },
      };
      state.messages = [];
      if (logEl) logEl.innerHTML = "";
    }
    syncPackageUI();
    return {
      text:
        "Hey — let’s build your Stage 1 dual-mode flash the same way we tune in chat.\n\n" +
        "Base is $149: Comfort for the week, Sport when you want noise — throttle response and acceleration you feel immediately in Sport, quieter daily manners in Comfort. " +
        "All-stock baseline: ~285–295 rwhp / ~335–355 lb-ft at the wheels.\n\n" +
        "What’s the car? (year, model, auto/manual)",
      suggestions: nextSuggestions(),
    };
  }

  // ——— Grok API (optional) ———
  const SYSTEM = `You are JC QuickTune's Stage 1 dual-mode MG1 (BMW B46/B48) calibration assistant.
You help customers configure a full-flash Stage 1 BIN package by chatting like a tuner.

Product facts:
- Base Stage 1 dual-mode: $149. Comfort = quieter/efficient daily; Sport/Sport+ = immediate tip-in, hard acceleration, burbles. Mode switch changes personality on the fly.
- Wheel figures on stock car: ~285-295 rwhp, ~335-355 lb-ft wheels. All-stock baseline.
- Full BIN flash only. DME must already be unlocked (B48 Quickflash or similar). You do NOT unlock DMEs in the file.
- Add-ons: Texas Max Cooling +$49, Extra Crackle Burble+ +$39, Spicy Pedal Sport +$59, High Torque Package +$79, Log review +$29, Priority revision +$99.
- 93 AKI. List mods if not stock.

Behavior:
- Short, human, direct. No fake dyno certificates.
- Always end with 2-4 concrete next-step suggestions as a line: NEXT: suggestion1 | suggestion2 | suggestion3
- When package is clear, state total and tell them to use the Order form.
- If DME not unlocked, stop configuration and insist on unlock first.
- Never invent SWFL addresses; ask the customer for SWFL/SWFK from Quickflash.`;

  async function tryGrok(userText) {
    const endpoint = window.JCQT_CHAT_API || "/api/chat";
    const body = {
      model: "grok-4.5",
      messages: [
        { role: "system", content: SYSTEM },
        ...state.messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-12),
        { role: "user", content: userText },
      ],
      temperature: 0.5,
    };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("chat api " + res.status);
    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.output_text ||
      data.content ||
      "";
    if (!content) throw new Error("empty");
    return content;
  }

  function parseNext(content) {
    const m = content.match(/NEXT:\s*(.+)$/im);
    let suggestions = nextSuggestions();
    let text = content;
    if (m) {
      text = content.replace(/\n*NEXT:\s*.+$/im, "").trim();
      suggestions = m[1]
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    return { text, suggestions };
  }

  async function handleUser(text) {
    const cleaned = text.trim();
    if (!cleaned) return;
    appendMessage("user", cleaned);
    inputEl.value = "";
    renderSuggestions([]);
    setTyping(true);

    absorb(cleaned);
    syncPackageUI();

    try {
      if (state.usingGrok) {
        const raw = await tryGrok(cleaned);
        setTyping(false);
        const { text, suggestions } = parseNext(raw);
        appendMessage("assistant", text, suggestions);
        absorb(cleaned);
        syncPackageUI();
        return;
      }
    } catch (_) {
      state.usingGrok = false;
      if (modeLabel) modeLabel.textContent = "Offline builder · Grok API not connected";
    }

    setTyping(false);
    const reply = offlineReply(cleaned);
    // strip markdown-ish ** for plain display
    const plain = reply.text.replace(/\*\*/g, "");
    appendMessage("assistant", plain, reply.suggestions);
    syncPackageUI();
  }

  async function probeGrok() {
    try {
      const endpoint = window.JCQT_CHAT_API || "/api/chat";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "grok-4.5",
          messages: [
            { role: "system", content: "Reply with exactly: ok" },
            { role: "user", content: "ping" },
          ],
          max_tokens: 8,
        }),
      });
      if (res.ok) {
        state.usingGrok = true;
        if (modeLabel) modeLabel.textContent = "Grok (SpaceXAI) connected · build by chat";
        return;
      }
    } catch (_) {
      /* offline */
    }
    state.usingGrok = false;
    if (modeLabel) modeLabel.textContent = "Offline builder · same Stage 1 rules + next steps";
  }

  // manual addon toggles
  document.querySelectorAll(".addon-input").forEach((cb) => {
    cb.addEventListener("change", () => {
      const key = cb.dataset.key;
      if (key && key in state.profile.addons) {
        state.profile.addons[key] = cb.checked;
        syncPackageUI();
      }
    });
  });

  formEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleUser(inputEl.value);
  });

  resetBtn?.addEventListener("click", () => {
    const r = intro(true);
    appendMessage("assistant", r.text.replace(/\*\*/g, ""), r.suggestions);
  });

  // boot
  probeGrok().finally(() => {
    const r = intro(false);
    appendMessage("assistant", r.text.replace(/\*\*/g, ""), r.suggestions);
    syncPackageUI();
  });

  // expose for order form
  window.JCQT_BUILDER = {
    getProfile: () => state.profile,
    getTotal: packageTotal,
  };
})();
