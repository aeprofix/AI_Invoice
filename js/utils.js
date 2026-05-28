/**
 * InvoiceSpark — utils.js
 * Shared utility functions: formatting, toasts, local storage, color helpers
 */

'use strict';

/* ─── Currency Formatting ─── */
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥',
  CAD: 'CA$', AUD: 'A$', MYR: 'RM ', SGD: 'S$'
};

/**
 * Format a number as currency
 * @param {number} amount
 * @param {string} currency - ISO currency code
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD') {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol}${formatted}`;
}

/* ─── Date Formatting ─── */

/**
 * Format a date string to a human-readable format
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Get today's date as YYYY-MM-DD
 * @returns {string}
 */
function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Get a date N days from now as YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
function getFutureDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ─── Toast Notifications ─── */

const toastContainer = () => document.getElementById('toastContainer');

/**
 * Show a beautiful toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - ms
 */
function showToast(message, type = 'info', duration = 3500) {
  const icons = {
    success: '✓',
    error: '✕',
    info: '✦',
    warning: '⚠'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
    <span>${message}</span>
  `;
  toast.setAttribute('role', 'alert');

  const container = toastContainer();
  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/* ─── Local Storage Helpers ─── */

const STORAGE_KEY = 'invoicespark_v1';

/**
 * Load saved invoices from localStorage
 * @returns {Array}
 */
function loadSavedInvoices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save an invoice to localStorage
 * @param {Object} invoice
 */
function saveInvoice(invoice) {
  const invoices = loadSavedInvoices();
  const existingIdx = invoices.findIndex(i => i.id === invoice.id);
  if (existingIdx >= 0) {
    invoices[existingIdx] = invoice;
  } else {
    invoices.unshift(invoice); // newest first
  }
  // Keep max 50
  if (invoices.length > 50) invoices.splice(50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

/**
 * Delete an invoice from localStorage
 * @param {string} id
 */
function deleteInvoice(id) {
  const invoices = loadSavedInvoices().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

/* ─── Color Helpers ─── */

/**
 * Darken a hex color by a percentage
 * @param {string} hex
 * @param {number} pct - 0 to 1
 * @returns {string}
 */
function darkenColor(hex, pct) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * pct));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * pct));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Get a semi-transparent version of a color
 * @param {string} hex
 * @param {number} alpha - 0 to 1
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Determine if a color is light or dark
 * @param {string} hex
 * @returns {boolean} true if light
 */
function isLightColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

/* ─── ID Generation ─── */

/**
 * Generate a short unique ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Generate an invoice number like INV-042
 * @returns {string}
 */
function generateInvoiceNumber() {
  const invoices = loadSavedInvoices();
  const num = (invoices.length + 1).toString().padStart(3, '0');
  return `INV-${num}`;
}

/* ─── Debounce ─── */

/**
 * Debounce a function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ─── Escape HTML ─── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Nl2Br ─── */
function nl2br(str) {
  if (!str) return '';
  return escapeHtml(str).replace(/\n/g, '<br>');
}

/* ─── Export ─── */
window.InvoiceUtils = {
  formatCurrency,
  formatDate,
  getTodayString,
  getFutureDateString,
  showToast,
  loadSavedInvoices,
  saveInvoice,
  deleteInvoice,
  darkenColor,
  hexToRgba,
  isLightColor,
  generateId,
  generateInvoiceNumber,
  debounce,
  escapeHtml,
  nl2br,
  CURRENCY_SYMBOLS
};
