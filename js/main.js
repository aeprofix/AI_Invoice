/**
 * AI Invoice — main.js
 * Application bootstrap, state management, event binding,
 * ambient canvas animation, and saved invoices drawer.
 */

"use strict";

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const state = {
  template: "minimal",
  accentColor: "#6366f1",
  logoSrc: null,
  currentId: null,

  // Form data
  fromName: "",
  fromEmail: "",
  fromAddress: "",
  fromPhone: "",
  toName: "",
  toCompany: "",
  toEmail: "",
  toAddress: "",
  invoiceNumber: "",
  currency: "USD",
  issueDate: "",
  dueDate: "",
  taxRate: 0,
  notes: "",
  terms: "",
  isPaid: false,
  paidAt: "",

  // Line items
  items: [],

  // Computed
  get subtotal() {
    return this.items.reduce(
      (sum, i) => sum + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0),
      0,
    );
  },
  get taxAmount() {
    return this.subtotal * ((parseFloat(this.taxRate) || 0) / 100);
  },
  get total() {
    return this.subtotal + this.taxAmount;
  },
};

/* ═══════════════════════════════════════════════════════════════
   IMPORTS
   ═══════════════════════════════════════════════════════════════ */
const { renderInvoice } = window.InvoiceGenerator;
const { exportPDF, exportPNG, printInvoice } = window.InvoiceExport;
const {
  formatCurrency,
  getTodayString,
  getFutureDateString,
  showToast,
  loadSavedInvoices,
  saveInvoice,
  deleteInvoice,
  darkenColor,
  hexToRgba,
  generateId,
  generateInvoiceNumber,
  debounce,
} = window.InvoiceUtils;

/* ═══════════════════════════════════════════════════════════════
   COLOUR THEMING
   ═══════════════════════════════════════════════════════════════ */
function applyAccentColor(hex) {
  state.accentColor = hex;
  const dark = darkenColor(hex, 0.15);
  const light = darkenColor(hex, -0.1);
  const glow = hexToRgba(hex, 0.25);
  const ultra = hexToRgba(hex, 0.07);

  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-dark", dark);
  document.documentElement.style.setProperty("--accent-light", light);
  document.documentElement.style.setProperty("--accent-glow", glow);
  document.documentElement.style.setProperty("--accent-ultra", ultra);

  // Update ambient canvas color
  if (window._ambientCtx) {
    window._ambientColor = hex;
  }
}

/* ═══════════════════════════════════════════════════════════════
   AMBIENT CANVAS — Floating particle background
   ═══════════════════════════════════════════════════════════════ */
function initAmbientCanvas() {
  const canvas = document.getElementById("ambientCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  window._ambientCtx = ctx;
  window._ambientColor = state.accentColor;

  let W, H, particles;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.4 + 0.05,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function initParticles() {
    const count = Math.min(60, Math.floor((W * H) / 20000));
    particles = Array.from({ length: count }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const hex = window._ambientColor || "#6366f1";
    const num = parseInt(hex.replace("#", ""), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;

    particles.forEach((p) => {
      p.pulse += 0.008;
      p.x += p.vx;
      p.y += p.vy;
      const pulse = Math.sin(p.pulse) * 0.15 + 0.85;
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha * pulse})`;
      ctx.fill();
    });

    // Soft gradient orbs
    const orbColor = (alpha) => `rgba(${r},${g},${b},${alpha})`;
    const grad1 = ctx.createRadialGradient(
      W * 0.15,
      H * 0.2,
      0,
      W * 0.15,
      H * 0.2,
      W * 0.35,
    );
    grad1.addColorStop(0, orbColor(0.04));
    grad1.addColorStop(1, orbColor(0));
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, W, H);

    const grad2 = ctx.createRadialGradient(
      W * 0.85,
      H * 0.75,
      0,
      W * 0.85,
      H * 0.75,
      W * 0.3,
    );
    grad2.addColorStop(0, orbColor(0.05));
    grad2.addColorStop(1, orbColor(0));
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(draw);
  }

  resize();
  initParticles();
  draw();
  window.addEventListener("resize", () => {
    resize();
    initParticles();
  });
}

/* ═══════════════════════════════════════════════════════════════
   LINE ITEMS
   ═══════════════════════════════════════════════════════════════ */
function createItem() {
  return { id: generateId(), description: "", qty: 1, price: 0 };
}

function renderItemsList() {
  const list = document.getElementById("itemsList");
  if (!list) return;

  list.innerHTML = state.items
    .map(
      (item, idx) => `
    <div class="line-item-row" data-id="${item.id}">
      <input
        type="text"
        class="spark-input text-sm py-2"
        placeholder="Item description"
        value="${item.description.replace(/"/g, "&quot;")}"
        data-item-field="description"
        data-item-id="${item.id}"
        aria-label="Item description"
      />
      <input
        type="number"
        class="spark-input text-sm py-2 text-center font-mono"
        min="0" step="0.5"
        value="${item.qty}"
        data-item-field="qty"
        data-item-id="${item.id}"
        aria-label="Quantity"
      />
      <input
        type="number"
        class="spark-input text-sm py-2 text-right font-mono"
        min="0" step="0.01"
        value="${item.price}"
        data-item-field="price"
        data-item-id="${item.id}"
        aria-label="Unit price"
      />
      <button
        class="line-item-delete"
        data-delete-id="${item.id}"
        aria-label="Remove item"
        title="Remove item"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  `,
    )
    .join("");

  // Bind item events
  list.querySelectorAll("[data-item-field]").forEach((input) => {
    input.addEventListener("input", onItemChange);
    input.addEventListener("change", onItemChange);
  });
  list.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", onDeleteItem);
  });
}

function onItemChange(e) {
  const { itemId, itemField } = e.target.dataset;
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  item[itemField] = e.target.value;
  updateTotalsDisplay();
  debouncedRender();
}

function onDeleteItem(e) {
  const id = e.currentTarget.dataset.deleteId;
  state.items = state.items.filter((i) => i.id !== id);
  renderItemsList();
  updateTotalsDisplay();
  debouncedRender();
}

function addItem() {
  const item = createItem();
  state.items.push(item);
  renderItemsList();

  // Focus the new item's description
  const newRow = document.querySelector(
    `[data-id="${item.id}"] input[data-item-field="description"]`,
  );
  if (newRow) {
    setTimeout(() => newRow.focus(), 50);
  }
  updateTotalsDisplay();
  debouncedRender();
}

/* ═══════════════════════════════════════════════════════════════
   TOTALS DISPLAY
   ═══════════════════════════════════════════════════════════════ */
function updateTotalsDisplay() {
  const { currency } = state;
  document.getElementById("subtotalDisplay").textContent = formatCurrency(
    state.subtotal,
    currency,
  );
  document.getElementById("taxDisplay").textContent = formatCurrency(
    state.taxAmount,
    currency,
  );
  document.getElementById("totalDisplay").textContent = formatCurrency(
    state.total,
    currency,
  );
}


/* ═══════════════════════════════════════════════════════════════
   PAID VERIFIED STAMP
   ═══════════════════════════════════════════════════════════════ */
function applyPaidStamp() {
  const preview = document.getElementById("invoicePreview");
  if (!preview) return;

  preview.classList.toggle("is-paid", Boolean(state.isPaid));
  preview.querySelectorAll(".paid-verified-stamp").forEach((stamp) => stamp.remove());

  if (!state.isPaid) return;

  const stampTarget =
    preview.querySelector(
      "#invoiceInner, .invoice-template-minimal, .invoice-template-modern, .invoice-template-elegant, .invoice-template-bold, .invoice-template-luxury, .receipt-template-clean, .receipt-template-premium, .receipt-template-compact, .invoice-page, .invoice-paper, .invoice-sheet, .invoice-document, .invoice-template",
    ) ||
    preview.firstElementChild ||
    preview;

  const currentPosition = window.getComputedStyle(stampTarget).position;
  if (currentPosition === "static") stampTarget.style.position = "relative";
  stampTarget.style.overflow = "visible";

  const stamp = document.createElement("div");
  stamp.className = "paid-verified-stamp";
  stamp.setAttribute("aria-label", "Paid verified stamp");
  stamp.innerHTML = `
    <span class="paid-word">PAID</span>
    <span class="verified-word">VERIFIED</span>
  `;

  stampTarget.appendChild(stamp);
}

/* ═══════════════════════════════════════════════════════════════
   LIVE RENDER
   ═══════════════════════════════════════════════════════════════ */
function getRenderData() {
  return {
    ...state,
    accentColor: state.accentColor,
    subtotal: state.subtotal,
    taxAmount: state.taxAmount,
    total: state.total,
  };
}

function doRender() {
  renderInvoice(state.template, getRenderData());
}

const debouncedRender = debounce(doRender, 120);

/* ═══════════════════════════════════════════════════════════════
   FORM BINDING
   ═══════════════════════════════════════════════════════════════ */
function bindFormInputs() {
  document.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("input", onFieldChange);
    el.addEventListener("change", onFieldChange);
  });
}

function onFieldChange(e) {
  const field = e.target.dataset.field;
  let value = e.target.value;

  if (e.target.type === "checkbox") {
    value = e.target.checked;
  }
  if (field === "taxRate") value = parseFloat(value) || 0;

  state[field] = value;

  if (field === "isPaid") {
    state.paidAt = value ? new Date().toISOString() : "";
    showToast(value ? "Payment marked as PAID VERIFIED." : "Paid stamp removed.", value ? "success" : "info", 2200);
    doRender();
    return;
  }

  if (field === "taxRate" || field === "currency") updateTotalsDisplay();
  debouncedRender();
}

/* ═══════════════════════════════════════════════════════════════
   LOGO UPLOAD
   ═══════════════════════════════════════════════════════════════ */
function initLogoUpload() {
  const zone = document.getElementById("logoUploadZone");
  const input = document.getElementById("logoInput");
  const preview = document.getElementById("logoPreview");
  const placeholder = document.getElementById("logoPlaceholder");

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) processLogoFile(file);
  });

  input.addEventListener("change", () => {
    if (input.files[0]) processLogoFile(input.files[0]);
  });

  function processLogoFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.logoSrc = ev.target.result;
      preview.src = ev.target.result;
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
      debouncedRender();
      showToast("Logo uploaded! ✓", "success");
    };
    reader.readAsDataURL(file);
  }
}

/* ═══════════════════════════════════════════════════════════════
   TEMPLATE SELECTOR
   ═══════════════════════════════════════════════════════════════ */
function initTemplateSelector() {
  document.getElementById("templateSelector").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-template]");
    if (!btn) return;

    document
      .querySelectorAll(".template-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.template = btn.dataset.template;
    doRender();
    showToast(
      `Template: ${btn.dataset.template.charAt(0).toUpperCase() + btn.dataset.template.slice(1)}`,
      "info",
      2000,
    );
  });
}

/* ═══════════════════════════════════════════════════════════════
   COLOR PICKER
   ═══════════════════════════════════════════════════════════════ */
function initColorPicker() {
  document.getElementById("colorPresets").addEventListener("click", (e) => {
    const swatch = e.target.closest("[data-color]");
    if (!swatch) return;
    document
      .querySelectorAll(".color-swatch")
      .forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
    applyAccentColor(swatch.dataset.color);
    debouncedRender();
  });

  const customColor = document.getElementById("customColor");
  customColor.addEventListener("input", (e) => {
    document
      .querySelectorAll(".color-swatch")
      .forEach((s) => s.classList.remove("active"));
    customColor.closest(".color-swatch").classList.add("active");
    applyAccentColor(e.target.value);
    debouncedRender();
  });
}

/* ═══════════════════════════════════════════════════════════════
   DARK / LIGHT TOGGLE
   ═══════════════════════════════════════════════════════════════ */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const moon = document.getElementById("moonIcon");
  const sun = document.getElementById("sunIcon");
  const html = document.documentElement;

  // Check saved preference
  const saved = localStorage.getItem("invoicespark_theme");
  if (saved === "light") {
    html.classList.replace("dark", "light");
    moon.classList.add("hidden");
    sun.classList.remove("hidden");
  }

  btn.addEventListener("click", () => {
    if (html.classList.contains("dark")) {
      html.classList.replace("dark", "light");
      moon.classList.add("hidden");
      sun.classList.remove("hidden");
      localStorage.setItem("invoicespark_theme", "light");
    } else {
      html.classList.replace("light", "dark");
      sun.classList.add("hidden");
      moon.classList.remove("hidden");
      localStorage.setItem("invoicespark_theme", "dark");
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SAVE / LOAD INVOICES
   ═══════════════════════════════════════════════════════════════ */
function serializeState() {
  return {
    id: state.currentId || generateId(),
    savedAt: new Date().toISOString(),
    template: state.template,
    accentColor: state.accentColor,
    logoSrc: state.logoSrc,
    fromName: state.fromName,
    fromEmail: state.fromEmail,
    fromAddress: state.fromAddress,
    fromPhone: state.fromPhone,
    toName: state.toName,
    toCompany: state.toCompany,
    toEmail: state.toEmail,
    toAddress: state.toAddress,
    invoiceNumber: state.invoiceNumber,
    currency: state.currency,
    issueDate: state.issueDate,
    dueDate: state.dueDate,
    taxRate: state.taxRate,
    notes: state.notes,
    terms: state.terms,
    isPaid: state.isPaid,
    paidAt: state.paidAt,
    items: [...state.items],
    total: state.total,
  };
}

function loadStateFromSaved(saved) {
  const fields = [
    "template",
    "accentColor",
    "logoSrc",
    "fromName",
    "fromEmail",
    "fromAddress",
    "fromPhone",
    "toName",
    "toCompany",
    "toEmail",
    "toAddress",
    "invoiceNumber",
    "currency",
    "issueDate",
    "dueDate",
    "taxRate",
    "notes",
    "terms",
    "isPaid",
    "paidAt",
    "items",
  ];
  fields.forEach((f) => {
    if (saved[f] !== undefined) state[f] = saved[f];
  });
  state.currentId = saved.id;

  // Sync form inputs
  document.querySelectorAll("[data-field]").forEach((el) => {
    const field = el.dataset.field;
    if (state[field] !== undefined) {
      if (el.type === "checkbox") {
        el.checked = Boolean(state[field]);
      } else {
        el.value = state[field];
      }
    }
  });

  // Sync logo
  if (state.logoSrc) {
    const preview = document.getElementById("logoPreview");
    const placeholder = document.getElementById("logoPlaceholder");
    preview.src = state.logoSrc;
    preview.classList.remove("hidden");
    placeholder.classList.add("hidden");
  }

  // Sync template buttons
  document.querySelectorAll(".template-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.template === state.template);
  });

  // Sync color swatches
  document.querySelectorAll("[data-color]").forEach((sw) => {
    sw.classList.toggle("active", sw.dataset.color === state.accentColor);
  });
  applyAccentColor(state.accentColor);

  renderItemsList();
  updateTotalsDisplay();
  doRender();
}

function initSaveLoad() {
  document.getElementById("saveInvoiceBtn").addEventListener("click", () => {
    const data = serializeState();
    if (!data.invoiceNumber && !data.toName) {
      showToast("Add an invoice number or client name first.", "warning");
      return;
    }
    state.currentId = data.id;
    saveInvoice(data);
    renderSavedList();
    showToast("Invoice saved! ✦", "success");
  });
}

let savedSearchQuery = "";

function getSavedSearchHaystack(inv) {
  const isReceipt = Boolean(inv.isPaid || inv.paidAt);
  return [
    inv.invoiceNumber,
    inv.toName,
    inv.toCompany,
    inv.toEmail,
    inv.toAddress,
    inv.currency,
    formatCurrency(inv.total || 0, inv.currency || "USD"),
    inv.savedAt ? new Date(inv.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    isReceipt ? "paid receipt official paid verified" : "invoice unpaid",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderSavedList() {
  const list = document.getElementById("savedInvoicesList");
  const allInvoices = loadSavedInvoices();
  const searchInput = document.getElementById("savedSearchInput");
  const query = (searchInput?.value || savedSearchQuery || "").trim().toLowerCase();
  savedSearchQuery = query;
  const invoices = query
    ? allInvoices.filter((inv) => getSavedSearchHaystack(inv).includes(query))
    : allInvoices;

  // Update badge
  document.getElementById("savedCount").textContent = allInvoices.length;

  if (!allInvoices.length) {
    list.innerHTML = `<p class="text-spark-muted text-sm text-center py-8">No saved invoices yet.<br>Fill in your invoice and click Save.</p>`;
    return;
  }

  if (!invoices.length) {
    list.innerHTML = `<p class="text-spark-muted text-sm text-center py-8">No saved invoice or receipt found.</p>`;
    return;
  }

  list.innerHTML = invoices
    .map(
      (inv) => `
    <div class="saved-invoice-item" data-load-id="${inv.id}">
      <div class="flex flex-col gap-0.5 flex-1 min-w-0 cursor-pointer">
        <div class="si-number">${inv.invoiceNumber || "No #"}</div>
        <div class="si-client line-clamp-1">${inv.toName || "No client"}</div>
        ${(inv.isPaid || inv.paidAt) ? `<div class="si-paid-badge">Paid</div>` : ""}
        <div class="si-date">${new Date(inv.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="si-amount" style="color:var(--accent)">${formatCurrency(inv.total || 0, inv.currency || "USD")}</div>
        <button class="si-delete" data-delete-saved="${inv.id}" aria-label="Delete saved invoice" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `,
    )
    .join("");

  // Bind load events
  list.querySelectorAll("[data-load-id]").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete-saved]")) return;
      const inv = loadSavedInvoices().find((i) => i.id === item.dataset.loadId);
      if (inv) {
        loadStateFromSaved(inv);
        closeDrawer();
        showToast(`Loaded: ${inv.invoiceNumber || inv.toName}`, "success");
      }
    });
  });

  list.querySelectorAll("[data-delete-saved]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteInvoice(btn.dataset.deleteSaved);
      renderSavedList();
      showToast("Invoice deleted.", "info", 2000);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   SAVED INVOICES DRAWER
   ═══════════════════════════════════════════════════════════════ */
function openDrawer() {
  const drawer = document.getElementById("savedDrawer");
  const overlay = document.getElementById("savedDrawerOverlay");
  drawer.classList.remove("translate-x-full");
  overlay.classList.remove("hidden");
  setTimeout(() => overlay.classList.add("opacity-100"), 10);
  renderSavedList();
}

function closeDrawer() {
  const drawer = document.getElementById("savedDrawer");
  const overlay = document.getElementById("savedDrawerOverlay");
  drawer.classList.add("translate-x-full");
  overlay.classList.remove("opacity-100");
  setTimeout(() => overlay.classList.add("hidden"), 300);
}

function initDrawer() {
  document
    .getElementById("savedInvoicesBtn")
    .addEventListener("click", openDrawer);
  document
    .getElementById("closeDrawerBtn")
    .addEventListener("click", closeDrawer);
  document
    .getElementById("savedDrawerOverlay")
    .addEventListener("click", closeDrawer);

  const searchInput = document.getElementById("savedSearchInput");
  const searchBtn = document.getElementById("savedSearchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      savedSearchQuery = (searchInput?.value || "").trim().toLowerCase();
      renderSavedList();
    });
  }
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        savedSearchQuery = searchInput.value.trim().toLowerCase();
        renderSavedList();
      }
    });
    searchInput.addEventListener("input", () => {
      if (!searchInput.value.trim()) {
        savedSearchQuery = "";
        renderSavedList();
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT BUTTONS
   ═══════════════════════════════════════════════════════════════ */
function initExportButtons() {
  document.getElementById("exportPdfBtn").addEventListener("click", exportPDF);
  document.getElementById("exportPngBtn").addEventListener("click", exportPNG);
  document.getElementById("printBtn").addEventListener("click", printInvoice);
}

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════ */
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Cmd/Ctrl + S = Save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      document.getElementById("saveInvoiceBtn").click();
    }
    // Cmd/Ctrl + P = Print
    if ((e.metaKey || e.ctrlKey) && e.key === "p") {
      e.preventDefault();
      printInvoice();
    }
    // Escape = close drawer
    if (e.key === "Escape") {
      closeDrawer();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   DEFAULT STATE POPULATION
   ═══════════════════════════════════════════════════════════════ */
function setDefaults() {
  // Keep the invoice clean on first load.
  // No sample business, client, note, tax, or line item data is inserted.
  const today = getTodayString();
  const due = getFutureDateString(30);

  state.fromName = "";
  state.fromEmail = "";
  state.fromAddress = "";
  state.fromPhone = "";

  state.toName = "";
  state.toCompany = "";
  state.toEmail = "";
  state.toAddress = "";

  state.invoiceNumber = generateInvoiceNumber();
  state.currency = "USD";
  state.issueDate = today;
  state.dueDate = due;
  state.taxRate = 0;
  state.notes = "";
  state.terms = "";
  state.isPaid = false;
  state.paidAt = "";
  state.items = [];

  // Populate form fields
  document.getElementById("fromName").value = state.fromName;
  document.getElementById("fromEmail").value = state.fromEmail;
  document.getElementById("fromAddress").value = state.fromAddress;
  document.getElementById("fromPhone").value = state.fromPhone;

  document.getElementById("toName").value = state.toName;
  document.getElementById("toCompany").value = state.toCompany;
  document.getElementById("toEmail").value = state.toEmail;
  document.getElementById("toAddress").value = state.toAddress;

  document.getElementById("invoiceNumber").value = state.invoiceNumber;
  document.getElementById("currency").value = state.currency;
  document.getElementById("issueDate").value = today;
  document.getElementById("dueDate").value = due;
  document.getElementById("taxRate").value = state.taxRate;
  document.getElementById("notes").value = state.notes;
  document.getElementById("terms").value = state.terms;
  const paidCheckbox = document.getElementById("isPaid");
  if (paidCheckbox) paidCheckbox.checked = state.isPaid;

  // Render empty item list and update totals
  renderItemsList();
  updateTotalsDisplay();
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════ */
function init() {
  // Ambient background
  initAmbientCanvas();

  // Theme
  initThemeToggle();

  // Apply default accent color
  applyAccentColor(state.accentColor);

  // Set form defaults
  setDefaults();

  // Bind all form inputs
  bindFormInputs();

  // Line items
  document.getElementById("addItemBtn").addEventListener("click", addItem);

  // Logo upload
  initLogoUpload();

  // Template selector
  initTemplateSelector();

  // Color picker
  initColorPicker();

  // Save / load
  initSaveLoad();
  renderSavedList();

  // Drawer
  initDrawer();

  // Export buttons
  initExportButtons();

  // Keyboard shortcuts
  initKeyboardShortcuts();

  // Initial render
  doRender();

  // Welcome toast
  setTimeout(() => {
    showToast(
      "Welcome to AI Invoice ✦ Start filling in your invoice!",
      "info",
      4000,
    );
  }, 600);
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
