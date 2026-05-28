/**
 * InvoiceSpark — pdf-export.js
 * Handles PDF generation via jsPDF + html2canvas, PNG download, and Print
 */

'use strict';

const { showToast, escapeHtml } = window.InvoiceUtils;

/**
 * Get the current invoice inner element for export
 * @returns {HTMLElement|null}
 */
function getExportTarget() {
  return document.getElementById('invoicePreview');
}

/**
 * Export the invoice as a high-quality PDF using html2canvas + jsPDF
 */
async function exportPDF() {
  const target = getExportTarget();
  if (!target) {
    showToast('Invoice preview not found.', 'error');
    return;
  }

  showToast('Generating PDF…', 'info', 2500);

  try {
    // Wait a tick to let the toast render
    await new Promise(r => setTimeout(r, 80));

    const canvas = await html2canvas(target, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    // A4 dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / imgHeight;

    // Calculate dimensions to fit A4
    let renderWidth = pdfWidth;
    let renderHeight = pdfWidth / ratio;

    // If taller than A4, scale down
    if (renderHeight > pdfHeight) {
      renderHeight = pdfHeight;
      renderWidth = pdfHeight * ratio;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: renderHeight > renderWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Center on page
    const xOffset = (pdfWidth - renderWidth) / 2;
    const yOffset = (pdfHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight);

    // Get invoice number for filename
    const invNumber = document.getElementById('invoiceNumber')?.value || 'invoice';
    const safeNum = invNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
    pdf.save(`${safeNum}.pdf`);

    showToast('PDF downloaded successfully! ✓', 'success');
  } catch (err) {
    console.error('PDF export failed:', err);
    showToast('PDF export failed. Please try again.', 'error');
  }
}

/**
 * Export the invoice as a PNG image
 */
async function exportPNG() {
  const target = getExportTarget();
  if (!target) {
    showToast('Invoice preview not found.', 'error');
    return;
  }

  showToast('Generating PNG…', 'info', 2000);

  try {
    await new Promise(r => setTimeout(r, 80));

    const canvas = await html2canvas(target, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    // Create download link
    const link = document.createElement('a');
    const invNumber = document.getElementById('invoiceNumber')?.value || 'invoice';
    const safeNum = invNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
    link.download = `${safeNum}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('PNG downloaded successfully! ✓', 'success');
  } catch (err) {
    console.error('PNG export failed:', err);
    showToast('PNG export failed. Please try again.', 'error');
  }
}

/**
 * Trigger browser print dialog with the invoice
 */
function printInvoice() {
  const target = getExportTarget();
  if (!target) {
    showToast('Invoice preview not found.', 'error');
    return;
  }

  // Temporarily reveal print container with invoice clone
  const printContainer = document.getElementById('printContainer');
  const clone = target.cloneNode(true);
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';

  printContainer.innerHTML = '';
  printContainer.appendChild(clone);

  // Trigger print
  window.print();

  showToast('Print dialog opened.', 'info');
}

/* ─── Export ─── */
window.InvoiceExport = { exportPDF, exportPNG, printInvoice };
