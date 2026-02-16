/**
 * XLSX Rebuilder Service
 * Writes translated text back into XML nodes and keeps all untouched workbook parts intact.
 */

import type { ParsedXlsx, XlsxTranslationTarget } from '../types';

const S_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface RebuiltXlsxResult {
  dataUrl: string;
  appliedCount: number;
  missingTargetCount: number;
}

/**
 * Rebuild an XLSX file with translated text applied to mapped XML targets.
 */
export async function rebuildXlsx(
  parsedXlsx: ParsedXlsx,
  translations: Map<string, string>
): Promise<RebuiltXlsxResult> {
  const { zipInstance: zip, xmlDocuments, targetMap } = parsedXlsx;
  const touchedPaths = new Set<string>();

  let appliedCount = 0;
  let missingTargetCount = 0;

  for (const [segmentId, target] of targetMap.entries()) {
    const translation = translations.get(segmentId);
    if (translation === undefined) continue;

    const doc = xmlDocuments.get(target.xmlPath);
    if (!doc) {
      missingTargetCount++;
      continue;
    }

    const textElement =
      target.textElement.ownerDocument === doc
        ? target.textElement
        : findTextElementInDocument(doc, target);

    if (!textElement) {
      missingTargetCount++;
      continue;
    }

    setCellTextPreservingWhitespace(textElement, translation);
    touchedPaths.add(target.xmlPath);
    appliedCount++;
  }

  const serializer = new XMLSerializer();
  for (const xmlPath of touchedPaths) {
    const doc = xmlDocuments.get(xmlPath);
    if (!doc) continue;
    zip.file(xmlPath, serializer.serializeToString(doc));
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: XLSX_MIME,
  });

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, appliedCount, missingTargetCount };
}

function findTextElementInDocument(doc: Document, target: XlsxTranslationTarget): Element | null {
  if (target.kind === 'shared-string') {
    if (typeof target.sharedStringIndex !== 'number') return null;
    const sharedItems = doc.getElementsByTagNameNS(S_NS, 'si');
    const si = sharedItems[target.sharedStringIndex];
    if (!si) return null;
    if (si.getElementsByTagNameNS(S_NS, 'r').length > 0) return null;
    return getDirectChildByLocalName(si, 't') || si.getElementsByTagNameNS(S_NS, 't')[0] || null;
  }

  const cell = findCellByAddress(doc, target.cellAddress);
  if (!cell) return null;

  if (target.kind === 'inline-string') {
    const isEl = getDirectChildByLocalName(cell, 'is');
    if (!isEl) return null;
    if (isEl.getElementsByTagNameNS(S_NS, 'r').length > 0) return null;
    return getDirectChildByLocalName(isEl, 't') || isEl.getElementsByTagNameNS(S_NS, 't')[0] || null;
  }

  return getDirectChildByLocalName(cell, 'v');
}

function findCellByAddress(doc: Document, cellAddress: string): Element | null {
  const cells = doc.getElementsByTagNameNS(S_NS, 'c');
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].getAttribute('r') === cellAddress) {
      return cells[i];
    }
  }
  return null;
}

function setCellTextPreservingWhitespace(textElement: Element, value: string): void {
  textElement.textContent = value;

  const shouldPreserveSpace = /^\s|\s$|\s{2,}|\n|\t/.test(value);
  if (shouldPreserveSpace) {
    textElement.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    return;
  }

  if (textElement.hasAttributeNS(XML_NS, 'space')) {
    textElement.removeAttributeNS(XML_NS, 'space');
  }
  if (textElement.hasAttribute('xml:space')) {
    textElement.removeAttribute('xml:space');
  }
}

function getDirectChildByLocalName(parent: Element, localName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName) {
      return child;
    }
  }
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

