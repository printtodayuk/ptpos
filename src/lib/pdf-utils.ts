'use client';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Ensures all <img> elements inside the target container are fully loaded and decoded.
 */
async function ensureImagesLoaded(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalHeight !== 0) {
        return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => {
          if (img.decode) {
            img.decode().then(() => resolve()).catch(() => resolve());
          } else {
            resolve();
          }
        };
        img.onload = done;
        img.onerror = () => resolve();
        // Safety fallback timeout
        setTimeout(resolve, 3000);
      });
    })
  );
}

/**
 * Robustly captures an HTML element to an HTML5 canvas:
 * - Temporarily resets any ancestor scroll offsets so the canvas top is never clipped.
 * - Ensures images are fully preloaded and decoded.
 * - Clones images in the onclone hook with exact computed dimensions & base64 conversion
 *   to avoid CORS/network/aspect-ratio clipping in html2canvas.
 */
export async function captureElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  // 1. Temporarily reset any scrolled ancestor so html2canvas doesn't offset the render
  const scrollAncestors: { el: HTMLElement; top: number; left: number }[] = [];
  let curr: HTMLElement | null = element.parentElement;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (curr.scrollTop > 0 || curr.scrollLeft > 0) {
      scrollAncestors.push({ el: curr, top: curr.scrollTop, left: curr.scrollLeft });
      curr.scrollTop = 0;
      curr.scrollLeft = 0;
    }
    curr = curr.parentElement;
  }

  // 2. Ensure all images in DOM are fully loaded
  await ensureImagesLoaded(element);

  const images = Array.from(element.querySelectorAll('img'));

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth || element.offsetWidth,
      windowHeight: element.scrollHeight || element.offsetHeight,
      onclone: (_clonedDoc, clonedElement) => {
        const clonedImages = Array.from(clonedElement.querySelectorAll('img'));
        clonedImages.forEach((clonedImg, idx) => {
          const origImg = images[idx];
          if (origImg && origImg.complete && origImg.naturalWidth > 0) {
            const rect = origImg.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              clonedImg.style.width = `${rect.width}px`;
              clonedImg.style.height = `${rect.height}px`;
              clonedImg.style.maxWidth = 'none';
              clonedImg.style.maxHeight = 'none';
              clonedImg.style.objectFit = 'contain';
            }
            try {
              const offscreen = document.createElement('canvas');
              offscreen.width = origImg.naturalWidth;
              offscreen.height = origImg.naturalHeight;
              const ctx = offscreen.getContext('2d');
              if (ctx) {
                ctx.drawImage(origImg, 0, 0);
                clonedImg.src = offscreen.toDataURL('image/png');
              }
            } catch {
              // If crossOrigin prevents dataURL extraction, clonedImg retains its original src
            }
          }
        });
      },
    });

    return canvas;
  } finally {
    // 3. Restore all ancestor scroll positions
    for (const item of scrollAncestors) {
      item.el.scrollTop = item.top;
      item.el.scrollLeft = item.left;
    }
  }
}

/**
 * Exports an element to standard A4 portrait PDF.
 */
export async function exportToPdfA4(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElementToCanvas(element);
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}

/**
 * Exports a Delivery Note element to standard 4x6 inch portrait PDF.
 */
export async function exportDeliveryNotePdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElementToCanvas(element);
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: [4, 6],
  });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}

/**
 * Exports a Receipt element to thermal printer 80mm PDF.
 */
export async function exportReceiptPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElementToCanvas(element);
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdfWidth = 80;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}
