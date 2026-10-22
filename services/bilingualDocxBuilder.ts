/**
 * Bilingual DOCX Builder
 * Merges an original DOCX and its in-place translation into one bilingual
 * contract. The translation pipeline only rewrites text, so both packages have
 * the same body structure and can be paired element by element.
 *
 * Layouts:
 * - side-by-side: every body block becomes a row of a two-column table, the
 *   original on one side and its translation on the other.
 * - alternating: every paragraph (also inside table cells) is followed, or
 *   preceded, by its translation.
 *
 * The original package is the base, so styles, headers, footers, images and
 * relationships stay exactly as uploaded. Translated copies get their own
 * numbering instances so list and clause numbers count the same in both
 * languages instead of continuing from one into the other.
 */

import JSZip from 'jszip';
import type { BilingualContractLayout, BilingualContractOrder } from '../types';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface BilingualMergeOptions {
  layout: BilingualContractLayout;
  order: BilingualContractOrder;
  columnHeaders: boolean;
  columnDivider: boolean;
  italicTranslation: boolean;
  /** Column heading for the original language, e.g. "English". */
  sourceLabel: string;
  /** Column heading for the translation, e.g. "Deutsch". */
  targetLabel: string;
  /** Translated list labels keyed by the original, e.g. "Article %1." → "Artikel %1.". */
  numberingLabels?: Record<string, string>;
}

export interface BilingualMergeResult {
  bytes: Uint8Array;
  warnings: string[];
}

export interface XmlImplementation {
  DOMParser: { new (): DOMParser };
  XMLSerializer: { new (): XMLSerializer };
}

/** Elements that can stand as a block in a body or table cell. */
const BLOCK_ELEMENTS = new Set(['p', 'tbl', 'sdt', 'customXml']);
/** Containers whose children are paired and interleaved in the alternating layout. */
const NESTED_CONTAINERS = new Set(['tbl', 'tr', 'tc', 'sdt', 'sdtContent', 'customXml']);
/** Markup that must not be duplicated into the translated copy. */
const STRIP_FROM_TRANSLATION = new Set([
  'bookmarkStart', 'bookmarkEnd', 'commentRangeStart', 'commentRangeEnd', 'commentReference',
  'permStart', 'permEnd', 'footnoteReference', 'endnoteReference', 'drawing', 'pict', 'object',
]);
/** pPr children that precede numPr, in schema order. */
const PPR_BEFORE_NUMPR = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl'];
/** rPr children that precede i/iCs, in schema order. */
const RPR_BEFORE_ITALIC = ['rStyle', 'rFonts', 'b', 'bCs'];

// A4 portrait with 2.54 cm margins, used when a section omits its page size.
const DEFAULT_TEXT_WIDTH = 11906 - 1440 * 2;
/** Left and right padding of each side-by-side cell, in twips. */
const CELL_MARGIN = 170;

export async function mergeBilingualDocx(
  original: ArrayBuffer | Uint8Array,
  translated: ArrayBuffer | Uint8Array,
  options: BilingualMergeOptions,
  xml: XmlImplementation = { DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer }
): Promise<BilingualMergeResult> {
  const [originalZip, translatedZip] = await Promise.all([JSZip.loadAsync(original), JSZip.loadAsync(translated)]);
  const parse = async (zip: JSZip, path: string): Promise<Document | null> => {
    const file = zip.file(path);
    if (!file) return null;
    const doc = new xml.DOMParser().parseFromString(await file.async('string'), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error(`The Word file has unreadable XML in ${path}.`);
    }
    return doc;
  };

  const originalDoc = await parse(originalZip, 'word/document.xml');
  const translatedDoc = await parse(translatedZip, 'word/document.xml');
  if (!originalDoc || !translatedDoc) {
    throw new Error('The contract is not a valid Word document.');
  }
  const numberingDoc = await parse(originalZip, 'word/numbering.xml');
  const stylesDoc = await parse(originalZip, 'word/styles.xml');

  const originalBody = firstChild(originalDoc.documentElement, 'body');
  const translatedBody = firstChild(translatedDoc.documentElement, 'body');
  if (!originalBody || !translatedBody) {
    throw new Error('The contract has no document body.');
  }

  const builder = new BilingualBuilder(originalDoc, options, new NumberingCloner(numberingDoc, stylesDoc, options.numberingLabels));
  if (options.layout === 'side-by-side') {
    builder.buildSideBySide(originalBody, translatedBody);
  } else {
    builder.interleave(originalBody, translatedBody);
  }

  const serializer = new xml.XMLSerializer();
  originalZip.file('word/document.xml', serializer.serializeToString(originalDoc));
  if (numberingDoc && builder.numbering.changed) {
    originalZip.file('word/numbering.xml', serializer.serializeToString(numberingDoc));
  }

  const warnings: string[] = [];
  if (builder.untranslatedParagraphs > 0) {
    warnings.push(
      `${builder.untranslatedParagraphs} paragraph${builder.untranslatedParagraphs === 1 ? '' : 's'} came back unchanged from translation. Review ${builder.untranslatedParagraphs === 1 ? 'it' : 'them'} before signing.`
    );
  }
  const textBoxes = originalBody.getElementsByTagNameNS(W_NS, 'txbxContent').length;
  if (textBoxes > 0) {
    warnings.push(
      `Text inside ${textBoxes} text box${textBoxes === 1 ? '' : 'es'} or shape${textBoxes === 1 ? '' : 's'} is kept in the original language only.`
    );
  }

  const bytes = await originalZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, warnings };
}

/**
 * List labels with words in them, e.g. "Article %1." or "Član %1.", which
 * need translating for the translated copy. Bullets and bare numbers do not.
 */
export async function collectNumberingLabels(
  docx: ArrayBuffer | Uint8Array,
  xml: XmlImplementation = { DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer }
): Promise<string[]> {
  const zip = await JSZip.loadAsync(docx);
  const file = zip.file('word/numbering.xml');
  if (!file) return [];
  const doc = new xml.DOMParser().parseFromString(await file.async('string'), 'application/xml');
  const labels = new Set<string>();
  for (const lvlText of elementsByName(doc, 'lvlText')) {
    const label = attrOf(lvlText);
    if (label && /\p{L}{2}/u.test(label.replace(/%\d/g, ''))) labels.add(label);
  }
  return [...labels];
}

// ============================================================================
// Builder
// ============================================================================

class BilingualBuilder {
  untranslatedParagraphs = 0;
  private textWidths: number[] = [];

  constructor(
    private doc: Document,
    private options: BilingualMergeOptions,
    readonly numbering: NumberingCloner
  ) {}

  // --------------------------------------------------------------------------
  // Alternating layout
  // --------------------------------------------------------------------------

  interleave(originalContainer: Element, translatedContainer: Element): void {
    // Pair first: inserting translations changes the child list being walked.
    for (const [original, translated] of pairChildren(originalContainer, translatedContainer)) {
      if (!translated) continue;
      if (original.localName === 'p') {
        this.interleaveParagraph(original, translated);
      } else if (NESTED_CONTAINERS.has(original.localName)) {
        this.interleave(original, translated);
      }
    }
  }

  private interleaveParagraph(original: Element, translated: Element): void {
    const originalText = normalizeText(ownText(original));
    const translatedText = normalizeText(ownText(translated));
    this.countUnchanged(originalText, translatedText);
    // Repeating text the translation left as-is (names, numbers, signature
    // lines) would only duplicate it.
    if (!translatedText || translatedText === originalText) return;

    const copy = this.prepareTranslation(translated);
    const parent = original.parentNode!;
    // The pair must stay on one page: the break goes before the first
    // paragraph of the pair or after the last, never between them.
    const pageBreak = pageBreakPosition(original);
    removePageBreaks(copy);
    if (this.options.order === 'translation-first') {
      if (pageBreak === 'before') {
        removePageBreaks(original);
        setPageBreakBefore(copy);
      }
      setKeepNext(copy);
      parent.insertBefore(copy, original);
      return;
    }
    setKeepNext(original);
    if (pageBreak === 'after') {
      removePageBreaks(original);
      copy.appendChild(this.pageBreakRun());
    }
    parent.insertBefore(copy, original.nextSibling);
    // A section break belongs on the last paragraph of its section.
    const sectPr = paragraphSectPr(original);
    if (sectPr) {
      sectPr.parentNode!.removeChild(sectPr);
      appendSectPr(this.doc, copy, sectPr);
    }
  }

  // --------------------------------------------------------------------------
  // Side-by-side layout
  // --------------------------------------------------------------------------

  buildSideBySide(originalBody: Element, translatedBody: Element): void {
    const pairs = pairChildren(originalBody, translatedBody);
    this.textWidths = sectionTextWidths(originalBody);
    for (const [original] of pairs) originalBody.removeChild(original);

    let section = 0;
    let rows: Element[] = [];
    let pendingMarkup: Element[] = [];
    let finalSectPr: Element | null = null;

    const flushTable = () => {
      if (rows.length === 0) return;
      originalBody.appendChild(this.createTable(rows, this.textWidths[section] ?? DEFAULT_TEXT_WIDTH));
      rows = [];
    };
    const addRow = (original: Element, translated: Element | null) => {
      if (original.localName === 'p') this.countUnchanged(normalizeText(ownText(original)), normalizeText(translated ? ownText(translated) : ''));
      const translatedCopy = translated ? this.prepareTranslation(translated) : this.el('p');
      const columnWidth = Math.floor((this.textWidths[section] ?? DEFAULT_TEXT_WIDTH) / 2) - CELL_MARGIN * 2;
      for (const block of [original, translatedCopy]) fitToColumn(block, columnWidth);
      const originalCell = [...pendingMarkup, original];
      pendingMarkup = [];
      rows.push(this.options.order === 'translation-first'
        ? this.createRow([translatedCopy], originalCell, section)
        : this.createRow(originalCell, [translatedCopy], section));
    };

    for (const [original, translated] of pairs) {
      if (original.localName === 'sectPr') {
        finalSectPr = original;
        continue;
      }
      if (!BLOCK_ELEMENTS.has(original.localName)) {
        // Body-level bookmarks and similar markers ride along into the next cell.
        pendingMarkup.push(original);
        continue;
      }
      if (original.localName !== 'p') {
        addRow(original, translated);
        continue;
      }

      const sectPr = paragraphSectPr(original);
      if (sectPr) sectPr.parentNode!.removeChild(sectPr);
      const hasText = normalizeText(ownText(original)).length > 0;
      const pageBreak = pageBreakPosition(original);

      if (pageBreak && !hasText) {
        // A paragraph that only breaks the page stays outside the table.
        flushTable();
        originalBody.appendChild(original);
      } else {
        if (pageBreak) {
          removePageBreaks(original);
          if (translated) removePageBreaks(translated);
          if (pageBreak === 'before') {
            flushTable();
            originalBody.appendChild(this.pageBreakParagraph());
          }
        }
        addRow(original, translated);
        if (pageBreak === 'after') {
          flushTable();
          originalBody.appendChild(this.pageBreakParagraph());
        }
      }

      if (sectPr) {
        flushTable();
        const breakParagraph = this.el('p');
        appendSectPr(this.doc, breakParagraph, sectPr);
        originalBody.appendChild(breakParagraph);
        section += 1;
      }
    }

    flushTable();
    for (const markup of pendingMarkup) originalBody.appendChild(markup);
    // Word expects a paragraph between a closing table and the section end.
    if (lastElementChild(originalBody)?.localName === 'tbl') {
      originalBody.appendChild(this.spacerParagraph());
    }
    if (finalSectPr) originalBody.appendChild(finalSectPr);
  }

  private createTable(rows: Element[], textWidth: number): Element {
    const columnWidth = Math.floor(textWidth / 2);
    const table = this.el('tbl');
    const tblPr = this.el('tblPr');
    tblPr.appendChild(this.el('tblW', { w: String(columnWidth * 2), type: 'dxa' }));
    const borders = this.el('tblBorders');
    for (const side of ['top', 'left', 'bottom', 'right', 'insideH']) {
      borders.appendChild(this.el(side, { val: 'nil' }));
    }
    borders.appendChild(this.options.columnDivider
      ? this.el('insideV', { val: 'single', sz: '4', space: '0', color: '808080' })
      : this.el('insideV', { val: 'nil' }));
    tblPr.appendChild(borders);
    tblPr.appendChild(this.el('tblLayout', { type: 'fixed' }));
    const margins = this.el('tblCellMar');
    margins.appendChild(this.el('left', { w: String(CELL_MARGIN), type: 'dxa' }));
    margins.appendChild(this.el('right', { w: String(CELL_MARGIN), type: 'dxa' }));
    tblPr.appendChild(margins);
    tblPr.appendChild(this.el('tblLook', { val: '0000', firstRow: '0', lastRow: '0', firstColumn: '0', lastColumn: '0', noHBand: '1', noVBand: '1' }));
    table.appendChild(tblPr);

    const grid = this.el('tblGrid');
    grid.appendChild(this.el('gridCol', { w: String(columnWidth) }));
    grid.appendChild(this.el('gridCol', { w: String(columnWidth) }));
    table.appendChild(grid);

    if (this.options.columnHeaders) table.appendChild(this.createHeaderRow(columnWidth));
    for (const row of rows) table.appendChild(row);
    return table;
  }

  private createHeaderRow(columnWidth: number): Element {
    const labels = this.options.order === 'translation-first'
      ? [this.options.targetLabel, this.options.sourceLabel]
      : [this.options.sourceLabel, this.options.targetLabel];
    const row = this.el('tr');
    const trPr = this.el('trPr');
    trPr.appendChild(this.el('cantSplit'));
    trPr.appendChild(this.el('tblHeader'));
    row.appendChild(trPr);
    for (const label of labels) {
      const cell = this.el('tc');
      const tcPr = this.el('tcPr');
      tcPr.appendChild(this.el('tcW', { w: String(columnWidth), type: 'dxa' }));
      const borders = this.el('tcBorders');
      borders.appendChild(this.el('bottom', { val: 'single', sz: '8', space: '0', color: 'auto' }));
      tcPr.appendChild(borders);
      cell.appendChild(tcPr);

      const paragraph = this.el('p');
      const pPr = this.el('pPr');
      pPr.appendChild(this.el('keepNext'));
      pPr.appendChild(this.el('spacing', { before: '0', after: '120' }));
      pPr.appendChild(this.el('jc', { val: 'center' }));
      paragraph.appendChild(pPr);
      const run = this.el('r');
      const rPr = this.el('rPr');
      rPr.appendChild(this.el('b'));
      rPr.appendChild(this.el('caps'));
      run.appendChild(rPr);
      const text = this.el('t');
      text.appendChild(this.doc.createTextNode(label));
      run.appendChild(text);
      paragraph.appendChild(run);
      cell.appendChild(paragraph);
      row.appendChild(cell);
    }
    return row;
  }

  private createRow(left: Element[], right: Element[], section: number): Element {
    const columnWidth = Math.floor((this.textWidths[section] ?? DEFAULT_TEXT_WIDTH) / 2);
    const row = this.el('tr');
    for (const content of [left, right]) {
      const cell = this.el('tc');
      const tcPr = this.el('tcPr');
      tcPr.appendChild(this.el('tcW', { w: String(columnWidth), type: 'dxa' }));
      cell.appendChild(tcPr);
      for (const block of content) cell.appendChild(block);
      // A table cell must end with a paragraph.
      if (lastElementChild(cell)?.localName !== 'p') cell.appendChild(this.el('p'));
      row.appendChild(cell);
    }
    return row;
  }

  private pageBreakRun(): Element {
    const run = this.el('r');
    run.appendChild(this.el('br', { type: 'page' }));
    return run;
  }

  private pageBreakParagraph(): Element {
    const paragraph = this.el('p');
    paragraph.appendChild(this.pageBreakRun());
    return paragraph;
  }

  private spacerParagraph(): Element {
    const paragraph = this.el('p');
    const pPr = this.el('pPr');
    pPr.appendChild(this.el('spacing', { before: '0', after: '0', line: '20', lineRule: 'exact' }));
    const rPr = this.el('rPr');
    rPr.appendChild(this.el('sz', { val: '2' }));
    pPr.appendChild(rPr);
    paragraph.appendChild(pPr);
    return paragraph;
  }

  // --------------------------------------------------------------------------
  // Shared
  // --------------------------------------------------------------------------

  /** Import a translated block and make it safe to sit beside the original. */
  private prepareTranslation(translated: Element): Element {
    const copy = this.doc.importNode(translated, true) as Element;
    stripDuplicateMarkup(copy);
    for (const paragraph of selfAndDescendants(copy, 'p')) {
      const sectPr = paragraphSectPr(paragraph);
      if (sectPr) sectPr.parentNode!.removeChild(sectPr);
      this.numbering.retarget(paragraph);
      if (this.options.italicTranslation) italicize(paragraph);
    }
    return copy;
  }

  private countUnchanged(originalText: string, translatedText: string): void {
    if (originalText.length >= 40 && /\p{L}{3}/u.test(originalText) && originalText === translatedText) {
      this.untranslatedParagraphs += 1;
    }
  }

  private el(name: string, attributes: Record<string, string> = {}): Element {
    return createW(this.doc, name, attributes);
  }
}

// ============================================================================
// Numbering
// ============================================================================

/**
 * Gives translated paragraphs their own copies of the numbering definitions.
 * Word keeps one counter per abstract list, so a translation that reused the
 * original's list would number "1." then "2." for the same clause.
 */
class NumberingCloner {
  changed = false;
  private numIdMap = new Map<string, string>();
  private nextNumId = 1;
  private nextAbstractId = 0;
  private styleNumbering = new Map<string, { numId: string; ilvl: string | null } | null>();
  private styles = new Map<string, Element>();

  constructor(
    private numberingDoc: Document | null,
    stylesDoc: Document | null,
    private labels: Record<string, string> = {}
  ) {
    if (numberingDoc) {
      for (const num of elementsByName(numberingDoc, 'num')) {
        this.nextNumId = Math.max(this.nextNumId, Number(attr(num, 'numId')) + 1 || 1);
      }
      for (const abstractNum of elementsByName(numberingDoc, 'abstractNum')) {
        this.nextAbstractId = Math.max(this.nextAbstractId, Number(attr(abstractNum, 'abstractNumId')) + 1 || 0);
      }
    }
    if (stylesDoc) {
      for (const style of elementsByName(stylesDoc, 'style')) {
        const id = attr(style, 'styleId');
        if (id) this.styles.set(id, style);
      }
    }
  }

  /** Point a translated paragraph's list numbering at the cloned list. */
  retarget(paragraph: Element): void {
    if (!this.numberingDoc) return;
    const pPr = firstChild(paragraph, 'pPr');
    const explicit = pPr ? firstChild(pPr, 'numPr') : null;
    const explicitNumId = explicit ? attrOf(firstChild(explicit, 'numId')) : null;
    const explicitIlvl = explicit ? attrOf(firstChild(explicit, 'ilvl')) : null;
    const styleId = pPr ? attrOf(firstChild(pPr, 'pStyle')) : null;
    const fromStyle = styleId ? this.resolveStyleNumbering(styleId) : null;

    const numId = explicitNumId ?? fromStyle?.numId ?? null;
    if (!numId || numId === '0') return;
    const ilvl = explicitIlvl
      ?? (fromStyle && fromStyle.numId === numId ? fromStyle.ilvl ?? this.levelLinkedToStyle(numId, styleId) : null)
      ?? '0';
    const cloneId = this.cloneFor(numId);
    if (!cloneId) return;

    const doc = paragraph.ownerDocument!;
    const ownPPr = pPr ?? paragraph.insertBefore(createW(doc, 'pPr'), paragraph.firstChild);
    const numPr = createW(doc, 'numPr');
    numPr.appendChild(createW(doc, 'ilvl', { val: ilvl }));
    numPr.appendChild(createW(doc, 'numId', { val: cloneId }));
    if (explicit) {
      ownPPr.replaceChild(numPr, explicit);
    } else {
      insertInOrder(ownPPr, numPr, PPR_BEFORE_NUMPR);
    }
  }

  private resolveStyleNumbering(styleId: string, depth = 0): { numId: string; ilvl: string | null } | null {
    if (this.styleNumbering.has(styleId)) return this.styleNumbering.get(styleId)!;
    const style = this.styles.get(styleId);
    let result: { numId: string; ilvl: string | null } | null = null;
    if (style && depth < 10) {
      const pPr = firstChild(style, 'pPr');
      const numPr = pPr ? firstChild(pPr, 'numPr') : null;
      const numId = numPr ? attrOf(firstChild(numPr, 'numId')) : null;
      if (numId) {
        result = { numId, ilvl: attrOf(firstChild(numPr!, 'ilvl')) };
      } else {
        const basedOn = attrOf(firstChild(style, 'basedOn'));
        result = basedOn ? this.resolveStyleNumbering(basedOn, depth + 1) : null;
      }
    }
    this.styleNumbering.set(styleId, result);
    return result;
  }

  /** A list level can name the paragraph style that uses it (e.g. Heading 2 → level 1). */
  private levelLinkedToStyle(numId: string, styleId: string | null): string | null {
    if (!styleId) return null;
    const abstractNum = this.abstractFor(numId);
    for (const lvl of abstractNum ? childrenByName(abstractNum, 'lvl') : []) {
      if (attrOf(firstChild(lvl, 'pStyle')) === styleId) return attr(lvl, 'ilvl');
    }
    return null;
  }

  private cloneFor(numId: string): string | null {
    const known = this.numIdMap.get(numId);
    if (known) return known;
    const doc = this.numberingDoc!;
    const num = elementsByName(doc, 'num').find((candidate) => attr(candidate, 'numId') === numId);
    const abstractNum = this.abstractFor(numId);
    if (!num || !abstractNum) return null;

    const root = doc.documentElement;
    const abstractCopy = abstractNum.cloneNode(true) as Element;
    const abstractId = String(this.nextAbstractId++);
    setAttr(abstractCopy, 'abstractNumId', abstractId);
    for (const name of ['nsid', 'tmpl', 'styleLink', 'numStyleLink']) {
      const child = firstChild(abstractCopy, name);
      if (child) abstractCopy.removeChild(child);
    }
    for (const lvl of childrenByName(abstractCopy, 'lvl')) {
      // Leave style links on the original list only.
      const pStyle = firstChild(lvl, 'pStyle');
      if (pStyle) lvl.removeChild(pStyle);
      const lvlText = firstChild(lvl, 'lvlText');
      const label = attrOf(lvlText);
      if (lvlText && label && this.labels[label]) setAttr(lvlText, 'val', this.labels[label]);
    }
    // Every abstractNum must precede every num.
    const firstNum = childrenByName(root, 'num')[0] ?? null;
    root.insertBefore(abstractCopy, firstNum);

    const numCopy = num.cloneNode(true) as Element;
    const cloneId = String(this.nextNumId++);
    setAttr(numCopy, 'numId', cloneId);
    setAttr(firstChild(numCopy, 'abstractNumId')!, 'val', abstractId);
    const cleanup = firstChild(root, 'numIdMacAtCleanup');
    root.insertBefore(numCopy, cleanup);

    this.numIdMap.set(numId, cloneId);
    this.changed = true;
    return cloneId;
  }

  /** The abstract list behind a num, following a list style link if there is one. */
  private abstractFor(numId: string): Element | null {
    const doc = this.numberingDoc!;
    const findAbstract = (id: string | null) => elementsByName(doc, 'abstractNum').find((candidate) => attr(candidate, 'abstractNumId') === id) ?? null;
    const num = elementsByName(doc, 'num').find((candidate) => attr(candidate, 'numId') === numId);
    const abstractNum = findAbstract(num ? attrOf(firstChild(num, 'abstractNumId')) : null);
    const styleLink = abstractNum ? attrOf(firstChild(abstractNum, 'numStyleLink')) : null;
    if (!styleLink) return abstractNum;
    const linkedNumId = this.resolveStyleNumbering(styleLink)?.numId;
    const linkedNum = linkedNumId ? elementsByName(doc, 'num').find((candidate) => attr(candidate, 'numId') === linkedNumId) : null;
    return findAbstract(linkedNum ? attrOf(firstChild(linkedNum, 'abstractNumId')) : null) ?? abstractNum;
  }
}

// ============================================================================
// XML helpers
// ============================================================================

function createW(doc: Document, name: string, attributes: Record<string, string> = {}): Element {
  const element = doc.createElementNS(W_NS, `w:${name}`);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttributeNS(W_NS, `w:${key}`, value);
  }
  return element;
}

function isW(node: Node | null, name?: string): boolean {
  return !!node && node.nodeType === 1 && (node as Element).namespaceURI === W_NS && (!name || (node as Element).localName === name);
}

function elementChildren(element: Element): Element[] {
  const result: Element[] = [];
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1) result.push(node as Element);
  }
  return result;
}

function childrenByName(element: Element, name: string): Element[] {
  return elementChildren(element).filter((child) => isW(child, name));
}

function firstChild(element: Element, name: string): Element | null {
  return childrenByName(element, name)[0] ?? null;
}

function lastElementChild(element: Element): Element | null {
  const children = elementChildren(element);
  return children[children.length - 1] ?? null;
}

function elementsByName(doc: Document, name: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS(W_NS, name));
}

function selfAndDescendants(element: Element, name: string): Element[] {
  const found = Array.from(element.getElementsByTagNameNS(W_NS, name));
  return isW(element, name) ? [element, ...found] : found;
}

function attr(element: Element, name: string): string | null {
  return element.getAttributeNS(W_NS, name) || element.getAttribute(`w:${name}`) || null;
}

function attrOf(element: Element | null, name = 'val'): string | null {
  return element ? attr(element, name) : null;
}

function setAttr(element: Element, name: string, value: string): void {
  element.setAttributeNS(W_NS, `w:${name}`, value);
}

/** Insert a child after any siblings that must precede it in schema order. */
function insertInOrder(parent: Element, child: Element, precedingNames: string[]): void {
  const next = elementChildren(parent).find((candidate) => !isW(candidate) || !precedingNames.includes(candidate.localName));
  parent.insertBefore(child, next ?? null);
}

/** Pair each child of the original container with the same child of the translation. */
function pairChildren(original: Element, translated: Element): Array<[Element, Element | null]> {
  const translatedChildren = elementChildren(translated);
  return elementChildren(original).map((child, index) => {
    const counterpart = translatedChildren[index];
    const matches = counterpart && counterpart.localName === child.localName && counterpart.namespaceURI === child.namespaceURI;
    return [child, matches ? counterpart : null];
  });
}

/** Text of the paragraph itself, leaving out text boxes anchored in it. */
function ownText(element: Element): string {
  let text = '';
  const walk = (node: Element) => {
    for (const child of elementChildren(node)) {
      if (isW(child, 'txbxContent')) continue;
      if (child.localName === 'AlternateContent') {
        // Choice and Fallback hold the same content twice; read one.
        const choice = elementChildren(child)[0];
        if (choice) walk(choice);
        continue;
      }
      if (isW(child, 't')) text += child.textContent || '';
      else if (isW(child, 'tab')) text += ' ';
      else walk(child);
    }
  };
  walk(element);
  return text;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function paragraphSectPr(paragraph: Element): Element | null {
  const pPr = firstChild(paragraph, 'pPr');
  return pPr ? firstChild(pPr, 'sectPr') : null;
}

/** sectPr sits near the end of pPr, before any pPrChange. */
function appendSectPr(doc: Document, paragraph: Element, sectPr: Element): void {
  const pPr = firstChild(paragraph, 'pPr') ?? paragraph.insertBefore(createW(doc, 'pPr'), paragraph.firstChild);
  pPr.insertBefore(sectPr, firstChild(pPr, 'pPrChange'));
}

function stripDuplicateMarkup(element: Element): void {
  const doomed: Element[] = [];
  // Paragraph and content-control ids must stay unique in the document.
  const dropIds = (node: Element) => {
    for (const name of ['paraId', 'textId']) {
      const attribute = Array.from(node.attributes).find((candidate) => candidate.localName === name);
      if (attribute) node.removeAttributeNode(attribute);
    }
    if (isW(node, 'sdtPr')) {
      const id = firstChild(node, 'id');
      if (id) doomed.push(id);
    }
  };
  const walk = (node: Element) => {
    for (const child of elementChildren(node)) {
      if ((isW(child) && STRIP_FROM_TRANSLATION.has(child.localName)) || child.localName === 'AlternateContent') {
        doomed.push(child);
        continue;
      }
      dropIds(child);
      walk(child);
    }
  };
  dropIds(element);
  walk(element);
  for (const node of doomed) node.parentNode?.removeChild(node);
}

function italicize(paragraph: Element): void {
  const doc = paragraph.ownerDocument!;
  for (const run of Array.from(paragraph.getElementsByTagNameNS(W_NS, 'r'))) {
    const rPr = firstChild(run, 'rPr') ?? run.insertBefore(createW(doc, 'rPr'), run.firstChild);
    for (const name of ['i', 'iCs']) {
      const existing = firstChild(rPr, name);
      if (existing) rPr.removeChild(existing);
    }
    insertInOrder(rPr, createW(doc, 'iCs'), RPR_BEFORE_ITALIC);
    insertInOrder(rPr, createW(doc, 'i'), RPR_BEFORE_ITALIC);
  }
}

/**
 * Make a block fit half the page. Frames and floating tables would escape
 * their column, so they flow; tables and deep indents laid out for the full
 * text width are scaled down to the column.
 */
function fitToColumn(block: Element, columnWidth: number): void {
  for (const pPr of selfAndDescendants(block, 'pPr')) {
    const framePr = firstChild(pPr, 'framePr');
    if (framePr) pPr.removeChild(framePr);
    const ind = firstChild(pPr, 'ind');
    if (ind) {
      const sides = ['left', 'start', 'right', 'end'];
      const total = sides.reduce((sum, side) => sum + Math.max(0, Number(attr(ind, side)) || 0), 0);
      const limit = columnWidth / 2;
      if (total > limit) scaleAttributes(ind, [...sides, 'hanging', 'firstLine'], limit / total);
    }
  }
  for (const tblPr of selfAndDescendants(block, 'tblPr')) {
    const tblpPr = firstChild(tblPr, 'tblpPr');
    if (tblpPr) tblPr.removeChild(tblpPr);
  }

  // Scale outermost tables by their own grid; nested tables shrink with them.
  const outerTables = selfAndDescendants(block, 'tbl').filter((table) => {
    for (let node = table.parentNode; node && node !== block; node = node.parentNode) {
      if (isW(node, 'tbl')) return false;
    }
    return true;
  });
  for (const table of outerTables) {
    const grid = firstChild(table, 'tblGrid');
    const gridWidth = grid ? childrenByName(grid, 'gridCol').reduce((sum, col) => sum + (Number(attr(col, 'w')) || 0), 0) : 0;
    if (gridWidth <= columnWidth) continue;
    const factor = columnWidth / gridWidth;
    for (const col of selfAndDescendants(table, 'gridCol')) scaleAttributes(col, ['w'], factor);
    for (const name of ['tblW', 'tcW', 'tblInd']) {
      for (const width of selfAndDescendants(table, name)) {
        if (attr(width, 'type') === 'dxa') scaleAttributes(width, ['w'], factor);
      }
    }
  }
}

function scaleAttributes(element: Element, names: string[], factor: number): void {
  for (const name of names) {
    const value = Number(attr(element, name));
    if (Number.isFinite(value) && attr(element, name) !== null) setAttr(element, name, String(Math.round(value * factor)));
  }
}

/** Whether a paragraph forces a page break, and whether before or after its text. */
function pageBreakPosition(paragraph: Element): 'before' | 'after' | null {
  const pPr = firstChild(paragraph, 'pPr');
  const breakBefore = pPr ? firstChild(pPr, 'pageBreakBefore') : null;
  if (breakBefore && !['0', 'false', 'off'].includes(attrOf(breakBefore) ?? '')) return 'before';

  let seenText = false;
  let position: 'before' | 'after' | null = null;
  const walk = (node: Element) => {
    for (const child of elementChildren(node)) {
      if (isW(child, 'txbxContent') || child.localName === 'AlternateContent') continue;
      if (isW(child, 't') && (child.textContent || '').trim()) seenText = true;
      else if (isW(child, 'br') && attr(child, 'type') === 'page' && !position) position = seenText ? 'after' : 'before';
      else walk(child);
    }
  };
  walk(paragraph);
  return position;
}

/** Keep a paragraph on the same page as the start of the next one. */
function setKeepNext(paragraph: Element): void {
  const doc = paragraph.ownerDocument!;
  const pPr = firstChild(paragraph, 'pPr') ?? paragraph.insertBefore(createW(doc, 'pPr'), paragraph.firstChild);
  if (!firstChild(pPr, 'keepNext')) insertInOrder(pPr, createW(doc, 'keepNext'), ['pStyle']);
}

function setPageBreakBefore(paragraph: Element): void {
  const doc = paragraph.ownerDocument!;
  const pPr = firstChild(paragraph, 'pPr') ?? paragraph.insertBefore(createW(doc, 'pPr'), paragraph.firstChild);
  insertInOrder(pPr, createW(doc, 'pageBreakBefore'), ['pStyle', 'keepNext', 'keepLines']);
}

function removePageBreaks(paragraph: Element): void {
  const pPr = firstChild(paragraph, 'pPr');
  const breakBefore = pPr ? firstChild(pPr, 'pageBreakBefore') : null;
  if (breakBefore) pPr!.removeChild(breakBefore);
  for (const br of Array.from(paragraph.getElementsByTagNameNS(W_NS, 'br'))) {
    if (attr(br, 'type') === 'page') br.parentNode?.removeChild(br);
  }
}

/** Usable text width of each section in twips, in body order. */
function sectionTextWidths(body: Element): number[] {
  const widths: number[] = [];
  const widthOf = (sectPr: Element) => {
    const pgSz = firstChild(sectPr, 'pgSz');
    const pgMar = firstChild(sectPr, 'pgMar');
    const page = Number(pgSz ? attr(pgSz, 'w') : NaN);
    const left = Number(pgMar ? attr(pgMar, 'left') : NaN);
    const right = Number(pgMar ? attr(pgMar, 'right') : NaN);
    const gutter = Number(pgMar ? attr(pgMar, 'gutter') : NaN) || 0;
    const width = page - left - right - gutter;
    return Number.isFinite(width) && width > 1440 ? width : DEFAULT_TEXT_WIDTH;
  };
  for (const child of elementChildren(body)) {
    const sectPr = isW(child, 'p') ? paragraphSectPr(child) : isW(child, 'sectPr') ? child : null;
    if (sectPr) widths.push(widthOf(sectPr));
  }
  return widths;
}
