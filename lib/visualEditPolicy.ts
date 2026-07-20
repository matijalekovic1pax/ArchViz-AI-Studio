import type { VisualSelectionShape } from '../types';

export type LocalizedVisualEditOperation =
  | 'replace_material'
  | 'recolor'
  | 'add_people'
  | 'remove_people'
  | 'remove_object'
  | 'custom';

export type LocalizedCompositeMode = 'generated-pixels';

export interface LocalizedVisualEditContract {
  operation: LocalizedVisualEditOperation;
  compositeMode: LocalizedCompositeMode;
  userInstruction: string;
  targetLabel: string;
  /** Natural-language destination color. Named colors stay semantic; only a
   * literal user-entered #RRGGBB value is forwarded as an exact color. */
  requestedColorText?: string;
  colorHex?: string;
  /** Parsed destination RGB retained as prompt metadata. */
  targetColor?: { red: number; green: number; blue: number };
  /** Existing target color parsed from instructions such as "from black". */
  sourceColor?: { red: number; green: number; blue: number };
  maxDeterministicRetries: number;
}

const COLOR_NAMES: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  red: '#ff0000',
  burgundy: '#800020',
  maroon: '#800000',
  orange: '#ff7a00',
  yellow: '#ffd400',
  'sand yellow': '#d6b86a',
  sand: '#cdb47a',
  beige: '#d9c7a3',
  cream: '#fff1c7',
  brown: '#7a4b2a',
  green: '#2f9e44',
  olive: '#808000',
  teal: '#008080',
  cyan: '#00bcd4',
  turquoise: '#30d5c8',
  blue: '#246bce',
  navy: '#001f5b',
  purple: '#7b2cbf',
  violet: '#7f00ff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  pink: '#ff69b4',
  gold: '#d4a017',
  copper: '#b87333',
  bronze: '#a97142',
};

const normalizeInstruction = (value: string | null | undefined): string =>
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, 2400);

const hexToRgb = (hex: string) => ({
  red: Number.parseInt(hex.slice(1, 3), 16),
  green: Number.parseInt(hex.slice(3, 5), 16),
  blue: Number.parseInt(hex.slice(5, 7), 16),
});

type ExtractedVisualEditColor = {
  hex: string;
  red: number;
  green: number;
  blue: number;
  /** True only when the user literally supplied #RRGGBB. */
  explicitHex: boolean;
  text: string;
};

const findVisualEditColor = (value: string): ExtractedVisualEditColor | null => {
  const explicitHex = value.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (explicitHex) {
    const hex = explicitHex.toLowerCase();
    return { hex, ...hexToRgb(hex), explicitHex: true, text: hex };
  }
  const named = Object.entries(COLOR_NAMES)
    .sort(([left], [right]) => right.length - left.length)
    .find(([name]) => new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i').test(value));
  if (!named) return null;
  const [name, namedHex] = named;
  return {
    hex: namedHex,
    ...hexToRgb(namedHex),
    explicitHex: false,
    text: name,
  };
};

export const extractVisualEditColor = (instruction: string): ExtractedVisualEditColor | null => {
  const normalized = normalizeInstruction(instruction).toLowerCase();
  const targetClause = normalized.match(/(?:\bto\b|\binto\b|\bwith\b|\bas\b)\s+([^,.;]+)/i)?.[1] || normalized;
  return findVisualEditColor(targetClause) || findVisualEditColor(normalized);
};

export const extractVisualEditSourceColor = (instruction: string): ExtractedVisualEditColor | null => {
  const normalized = normalizeInstruction(instruction).toLowerCase();
  const fromClause = normalized.match(/\bfrom\s+(.+?)(?=\s+\b(?:to|into)\b|[,.;]|$)/i)?.[1];
  if (fromClause) return findVisualEditColor(fromClause);
  const existingClause = normalized.match(/\b(?:currently|existing|originally)\s+([^,.;]+)/i)?.[1];
  return existingClause ? findVisualEditColor(existingClause) : null;
};

const inferTargetLabel = (instruction: string, fallback: string): string => {
  const normalized = normalizeInstruction(instruction);
  const patterns = [
    /(?:change|adjust|modify)\s+the\s+colou?rs?\s+of\s+(.+?)(?:\s+from\s+[^,.;]+?)?\s+(?:to|into)\s+/i,
    /(?:recolou?r|tint|paint)\s+(?:only\s+)?(?:the\s+)?(.+?)\s+(?:to|in|with)\s+/i,
    /(?:change|replace|apply)\s+(?:only\s+)?(?:the\s+)?(.+?)\s+(?:material|finish|texture|style)\b/i,
    /(?:remove|delete|erase)\s+(?:only\s+)?(?:the\s+)?(.+?)(?:\.|,|$)/i,
    /(?:replace|swap)\s+(?:only\s+)?(?:the\s+)?(.+?)\s+(?:with|by|for)\s+/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern)?.[1]?.trim();
    if (match && match.length <= 140) return match;
  }
  return fallback;
};

/**
 * Classifiers operate only on affirmative action clauses. Users naturally add
 * invariants such as "do not remove the chairs"; treating those words as the
 * requested action is considerably worse than leaving an ambiguous edit custom.
 */
const stripNegatedAndPreservationClauses = (prompt: string) => normalizeInstruction(prompt)
  .replace(/\b(?:do\s+not|don't|dont|never)\b[^,.;]*/gi, ' ')
  .replace(/\bwithout\s+(?:adding|inserting|placing|removing|deleting|erasing|replacing|moving|resizing|reshaping|redrawing|changing|altering)\b[^,.;]*/gi, ' ')
  .replace(/\b(?:keep|preserve|retain|maintain|leave)\b[^,.;]*(?:same|unchanged|intact|fixed|as[ -]?is|exact(?:ly)?)\b/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const PROPERTY_NOUN = '(?:colou?r|tint|hue|colou?r\\s+cast|material|finish|texture|grain|pattern|roughness|reflectivity)';

const stripPropertyRemovalActions = (prompt: string) => prompt.replace(
  new RegExp(`\\b(?:remove|delete|erase|eliminate|get\\s+rid\\s+of|replace|swap)\\s+(?:only\\s+)?(?:the\\s+)?(?:[\\w-]+\\s+){0,3}${PROPERTY_NOUN}\\b`, 'gi'),
  ' change color or finish '
);

const isExplicitRemoval = (prompt: string) =>
  /\b(remove|delete|erase|eliminate|take\s+out|get\s+rid\s+of)\b/i.test(stripPropertyRemovalActions(prompt));

const hasDirectPeopleTarget = (prompt: string, action: 'add' | 'remove') => {
  const verbs = action === 'add'
    ? '(?:add|insert|place|introduce|populate|repopulate)'
    : '(?:remove|delete|erase|eliminate|take\\s+out|get\\s+rid\\s+of)';
  return new RegExp(
    `\\b${verbs}\\s+(?:only\\s+)?(?:all\\s+|some\\s+|the\\s+|a\\s+|an\\s+|selected\\s+|existing\\s+)*(?:person|people|human|figure|man|woman|travell?er|passenger|pedestrian|crowd)\\b`,
    'i'
  ).test(prompt);
};

const isExplicitAddition = (prompt: string) =>
  /\b(add|insert|place|introduce|populate|repopulate)\b/i.test(prompt);

const isExplicitObjectReplacement = (prompt: string) =>
  /\b(?:replace|swap)\s+(?:only\s+)?(?:the\s+|this\s+|that\s+|selected\s+)?(?:object|person|people|human|figure|man|woman|chair|seat|bench|table|plant|tree|vehicle|car|fixture|furniture|door|window|sign|kiosk|counter|machine)\b/i.test(prompt);

const isMaterialChange = (prompt: string) => {
  const directPropertyEdit = new RegExp(
    `\\b(?:change|modify|replace|apply|use|transform|refinish|convert)\\b[^,.;]{0,100}\\b${PROPERTY_NOUN}\\b`,
    'i'
  ).test(prompt);
  const applyNamedFinish = /\b(?:apply|use|make|turn|convert)\b[^,.;]{0,90}\b(?:wood(?:en)?|stone|marble|metal(?:lic)?|glass|concrete|tile|fabric|leather|velvet|oak|steel|brick|plaster|terrazzo)\b/i.test(prompt);
  return directPropertyEdit || applyNamedFinish;
};

const isColorOnlyChange = (prompt: string) => {
  const asksForColor = /\b(recolou?r|colou?r|tint|hue|paint)\b/i.test(prompt) ||
    /\b(make|turn|change)\b[\s\S]{0,100}\b(?:red|orange|yellow|green|blue|purple|violet|magenta|pink|black|white|gr[ae]y|beige|sand|cream|brown|teal|cyan|navy|gold|silver|bronze|copper)\b/i.test(prompt);
  const structuralPrompt = stripPropertyRemovalActions(prompt);
  const asksForStructuralChange = /\b(add|remove|delete|erase|replace|swap|move|resize|reshape|redesign|rebuild|rotate|extend)\b/i.test(structuralPrompt);
  // Preservation clauses such as "keep the texture the same" must not turn a
  // color-only instruction into a material regeneration request.
  const asksForMaterialChange =
    /\b(?:change|modify)\s+(?:only\s+)?(?:the\s+)?(?:material|finish|texture|grain|pattern|roughness|reflectivity|style)\b/i.test(prompt) ||
    /\b(?:replace|apply|use|transform|restyle|refinish|convert)\b[^.,;]{0,90}\b(?:material|finish|texture|grain|pattern|roughness|reflectivity|style)\b/i.test(prompt) ||
    /\b(?:material|finish|texture|grain|pattern|roughness|reflectivity|style)\b\s+(?:to|into|with)\b/i.test(prompt);
  return asksForColor && !asksForStructuralChange && !asksForMaterialChange;
};

/**
 * Converts the terse right-panel request into a deterministic edit contract.
 * Explicit destructive verbs always win; a color noun can never imply removal.
 */
export const buildLocalizedVisualEditContract = ({
  activeTool,
  instruction,
  peopleMode,
}: {
  activeTool: string;
  instruction: string;
  peopleMode?: 'manual' | 'automatic' | string;
}): LocalizedVisualEditContract => {
  const userInstruction = normalizeInstruction(instruction);
  const defaultTargets: Record<string, string> = {
    material: 'selected material or surface',
    people: 'selected people area',
    remove: 'selected object or person',
    object: 'selected object',
    replace: 'selected object',
    sky: 'selected sky',
    lighting: 'selected lighting area',
    background: 'selected background area',
    select: 'named target inside the selected area',
  };
  const fallbackTarget = defaultTargets[activeTool] || 'named target inside the selected area';

  const intentInstruction = stripNegatedAndPreservationClauses(userInstruction);
  let operation: LocalizedVisualEditOperation = 'custom';
  if (activeTool === 'remove') {
    operation = hasDirectPeopleTarget(intentInstruction, 'remove') ? 'remove_people' : 'remove_object';
  } else if (activeTool === 'material') {
    // Dedicated tools are authoritative; hidden/stale Select text must not
    // silently turn a Material operation into a different operation.
    operation = 'replace_material';
  } else if (activeTool === 'people') {
    operation = peopleMode === 'automatic' || peopleMode === 'repopulate'
      ? 'add_people'
      : 'custom';
  } else if (isExplicitRemoval(intentInstruction)) {
    operation = hasDirectPeopleTarget(intentInstruction, 'remove') ? 'remove_people' : 'remove_object';
  } else if (isExplicitObjectReplacement(intentInstruction) || isExplicitAddition(intentInstruction)) {
    // Structural object work deliberately uses generated pixels. Do not let a
    // material word in "replace this person with a metal robot" hijack it.
    operation = hasDirectPeopleTarget(intentInstruction, 'add') ? 'add_people' : 'custom';
  } else if (isColorOnlyChange(intentInstruction)) {
    operation = 'recolor';
  } else if (isMaterialChange(intentInstruction)) {
    operation = 'replace_material';
  }

  const color = operation === 'recolor' ? extractVisualEditColor(userInstruction) : null;
  const sourceColor = operation === 'recolor' ? extractVisualEditSourceColor(userInstruction) : null;
  // Every localized creative edit is authored by GPT Image. Operation-specific
  // metadata controls the prompt and provider mask, never a mechanical pixel
  // replacement path. Deterministic work after generation is limited to
  // registration, seam correction, and restoring protected source pixels.
  const compositeMode: LocalizedCompositeMode = 'generated-pixels';

  return {
    operation,
    compositeMode,
    userInstruction,
    targetLabel: inferTargetLabel(userInstruction, fallbackTarget),
    ...(color ? {
      requestedColorText: color.text,
      ...(color.explicitHex ? { colorHex: color.hex } : {}),
      targetColor: { red: color.red, green: color.green, blue: color.blue },
    } : {}),
    ...(sourceColor ? {
      sourceColor: { red: sourceColor.red, green: sourceColor.green, blue: sourceColor.blue },
    } : {}),
    // Every localized candidate is fail-closed after generation by local pixel,
    // edge, structure, and seam checks only. No generated image is sent to a
    // second AI model. Allow one corrected OpenAI retry when those checks fail.
    maxDeterministicRetries: 1,
  };
};

const SELECTION_REQUIRED_TOOLS = new Set([
  'select',
  'material',
  'object',
  'remove',
  'replace',
  'background',
]);

const hasTwoDimensionalLasso = (points: Array<{ x: number; y: number }>) => {
  if (points.length < 3) return false;
  const origin = points[0];
  const axis = points.find((point) => Math.hypot(point.x - origin.x, point.y - origin.y) > 1);
  if (!axis) return false;
  return points.some((point) => Math.abs(
    (axis.x - origin.x) * (point.y - origin.y) -
    (axis.y - origin.y) * (point.x - origin.x)
  ) > 2);
};

const hasSeparatedBrushPoints = (points: Array<{ x: number; y: number }>) => {
  if (points.length < 2) return false;
  const origin = points[0];
  return points.slice(1).some((point) =>
    Math.hypot(point.x - origin.x, point.y - origin.y) > 0.5
  );
};

/** Matches the geometry that the generation-time mask rasterizer can consume. */
export const isUsableVisualSelection = (shape: VisualSelectionShape): boolean => {
  if (shape.type === 'rect') {
    return Number.isFinite(shape.start.x) &&
      Number.isFinite(shape.start.y) &&
      Number.isFinite(shape.end.x) &&
      Number.isFinite(shape.end.y) &&
      Math.abs(shape.end.x - shape.start.x) > 2 &&
      Math.abs(shape.end.y - shape.start.y) > 2;
  }
  if (shape.type === 'lasso') {
    return shape.points.length >= 3 &&
      shape.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) &&
      hasTwoDimensionalLasso(shape.points);
  }
  return shape.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) &&
    hasSeparatedBrushPoints(shape.points) &&
    Number.isFinite(shape.brushSize) &&
    shape.brushSize > 0;
};

export const hasUsableVisualSelection = (shapes: VisualSelectionShape[]): boolean =>
  shapes.some(isUsableVisualSelection);

/**
 * People, lighting, and sky intentionally support an explicit full-frame mode.
 * When the user supplies a selection they still route through localized editing.
 */
export const visualEditRequiresSelection = (activeTool: string): boolean =>
  SELECTION_REQUIRED_TOOLS.has(activeTool);
