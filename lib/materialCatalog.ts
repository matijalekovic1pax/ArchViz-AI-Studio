export const MATERIAL_CATEGORIES = ['All', 'Flooring', 'Wall', 'Facade', 'Roof', 'Metal', 'Glass', 'Stone', 'Fabric'] as const;

export type MaterialCategory = Exclude<(typeof MATERIAL_CATEGORIES)[number], 'All'>;

type TextureKind =
  | 'wood-plank'
  | 'herringbone'
  | 'terrazzo'
  | 'concrete'
  | 'bamboo'
  | 'cork'
  | 'plaster'
  | 'limewash'
  | 'microcement'
  | 'slat'
  | 'tile'
  | 'acoustic-panel'
  | 'brick'
  | 'corten'
  | 'cladding-panel'
  | 'stone-cladding'
  | 'standing-seam'
  | 'roof-tile'
  | 'slate'
  | 'gravel'
  | 'green-roof'
  | 'membrane'
  | 'metal'
  | 'perforated-metal'
  | 'glass'
  | 'ribbed-glass'
  | 'wired-glass'
  | 'marble'
  | 'travertine'
  | 'stone'
  | 'fabric'
  | 'leather'
  | 'velvet'
  | 'sheer';

interface MaterialSeed {
  id: string;
  label: string;
  category: MaterialCategory;
  description: string;
  tags: string[];
  texture: TextureKind;
  colors: {
    base: string;
    mid: string;
    dark: string;
    light: string;
    accent?: string;
    accent2?: string;
  };
  source?: MaterialSource;
}

interface MaterialSource {
  label: string;
  assetId?: string;
  previewUrl: string;
  referenceUrl?: string;
  sourceUrl: string;
}

export interface MaterialSwatch extends MaterialSeed {
  previewUrl: string;
  referenceUrl: string;
  fallbackPreviewUrl: string;
  sourceLabel: string;
  sourceAssetId: string | null;
  sourceUrl: string | null;
  modelPrompt: string;
}

const svg = (markup: string) => `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;

const seeded = (seed: string, index: number, modulo: number) => {
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i) * (i + 3);
  return (total + index * 97 + index * index * 13) % modulo;
};

const baseFrame = (material: MaterialSeed, content: string) => {
  const { base, mid, light } = material.colors;
  return svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${light}"/>
          <stop offset="0.48" stop-color="${base}"/>
          <stop offset="1" stop-color="${mid}"/>
        </linearGradient>
        <radialGradient id="soft-vignette" cx="50%" cy="42%" r="72%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
          <stop offset="0.58" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.16"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#surface)"/>
      ${content}
      <rect width="512" height="512" fill="url(#soft-vignette)"/>
      <rect x="0.5" y="0.5" width="511" height="511" fill="none" stroke="#000000" stroke-opacity="0.08"/>
    </svg>
  `);
};

const grainLines = (material: MaterialSeed, count = 26, horizontal = false) => {
  const { dark, light, accent } = material.colors;
  return Array.from({ length: count }, (_, index) => {
    const a = seeded(material.id, index, 512);
    const b = seeded(material.id, index + 12, 80) - 40;
    const width = 0.8 + seeded(material.id, index + 22, 18) / 10;
    const color = index % 4 === 0 ? light : accent || dark;
    const opacity = index % 4 === 0 ? 0.22 : 0.28;
    if (horizontal) {
      const y = a;
      return `<path d="M -12 ${y} C 116 ${y + b}, 260 ${y - b}, 524 ${y + b * 0.35}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
    }
    const x = a;
    return `<path d="M ${x} -12 C ${x + b} 116, ${x - b} 260, ${x + b * 0.35} 524" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
  }).join('');
};

const speckles = (material: MaterialSeed, count = 62, large = false) => {
  const palette = [
    material.colors.light,
    material.colors.mid,
    material.colors.dark,
    material.colors.accent || material.colors.base,
    material.colors.accent2 || material.colors.light,
  ];
  return Array.from({ length: count }, (_, index) => {
    const x = seeded(material.id, index, 512);
    const y = seeded(material.id, index + 31, 512);
    const r = large
      ? 8 + seeded(material.id, index + 55, 24)
      : 1.8 + seeded(material.id, index + 55, 72) / 10;
    const color = palette[index % palette.length];
    const opacity = large ? 0.68 : 0.36;
    return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${Math.max(1.5, r * (0.62 + seeded(material.id, index + 3, 50) / 100))}" fill="${color}" fill-opacity="${opacity}" transform="rotate(${seeded(material.id, index + 9, 180)} ${x} ${y})"/>`;
  }).join('');
};

const chipShapes = (material: MaterialSeed, count = 44) => {
  const palette = [
    material.colors.dark,
    material.colors.mid,
    material.colors.light,
    material.colors.accent || '#b98761',
    material.colors.accent2 || '#7f9aa8',
  ];
  return Array.from({ length: count }, (_, index) => {
    const x = seeded(material.id, index, 500);
    const y = seeded(material.id, index + 14, 500);
    const r = 7 + seeded(material.id, index + 25, 22);
    const color = palette[index % palette.length];
    const points = [
      `${x},${y}`,
      `${x + r},${y + seeded(material.id, index + 4, 12)}`,
      `${x + r * 0.65},${y + r}`,
      `${x - r * 0.3},${y + r * 0.72}`,
    ].join(' ');
    return `<polygon points="${points}" fill="${color}" fill-opacity="0.72" transform="rotate(${seeded(material.id, index + 2, 160) - 80} ${x} ${y})"/>`;
  }).join('');
};

const plankOverlay = (material: MaterialSeed, vertical = true) => {
  const seams = [128, 256, 384].map((position) =>
    vertical
      ? `<path d="M ${position} 0 L ${position} 512" stroke="${material.colors.dark}" stroke-opacity="0.18" stroke-width="3"/>`
      : `<path d="M 0 ${position} L 512 ${position}" stroke="${material.colors.dark}" stroke-opacity="0.18" stroke-width="3"/>`
  ).join('');
  const highlights = [64, 192, 320, 448].map((position) =>
    vertical
      ? `<path d="M ${position} 0 L ${position} 512" stroke="${material.colors.light}" stroke-opacity="0.16" stroke-width="1"/>`
      : `<path d="M 0 ${position} L 512 ${position}" stroke="${material.colors.light}" stroke-opacity="0.16" stroke-width="1"/>`
  ).join('');
  return seams + highlights;
};

const renderTexture = (material: MaterialSeed) => {
  const c = material.colors;

  switch (material.texture) {
    case 'wood-plank':
      return plankOverlay(material) + grainLines(material, 34);
    case 'herringbone':
      return Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => {
          const x = col * 72 - 44;
          const y = row * 72 - 36;
          const rotate = (row + col) % 2 === 0 ? 45 : -45;
          return `<rect x="${x}" y="${y}" width="110" height="34" rx="2" fill="${(row + col) % 3 === 0 ? c.mid : c.base}" stroke="${c.dark}" stroke-opacity="0.22" stroke-width="2" transform="rotate(${rotate} ${x + 55} ${y + 17})"/>`;
        }).join('')
      ).join('') + grainLines(material, 22);
    case 'terrazzo':
      return chipShapes(material, 58) + speckles(material, 40);
    case 'concrete':
      return speckles(material, 82) + grainLines(material, 12, true);
    case 'bamboo':
      return Array.from({ length: 9 }, (_, index) => {
        const x = index * 58;
        return `<rect x="${x}" y="0" width="58" height="512" fill="${index % 2 ? c.mid : c.base}" fill-opacity="0.72"/>
          <path d="M ${x} 0 L ${x} 512" stroke="${c.dark}" stroke-opacity="0.2" stroke-width="2"/>
          <path d="M ${x + 58} 0 L ${x + 58} 512" stroke="${c.light}" stroke-opacity="0.22" stroke-width="1"/>
          ${[95, 214, 338, 451].map((y) => `<path d="M ${x + 5} ${y} C ${x + 24} ${y + 8}, ${x + 38} ${y - 8}, ${x + 54} ${y}" stroke="${c.dark}" stroke-opacity="0.28" stroke-width="3" fill="none"/>`).join('')}`;
      }).join('') + grainLines(material, 18);
    case 'cork':
      return speckles(material, 150) + speckles({ ...material, colors: { ...c, light: c.accent || c.light } }, 72);
    case 'plaster':
    case 'limewash':
    case 'microcement':
      return speckles(material, material.texture === 'limewash' ? 52 : 74) + grainLines(material, material.texture === 'limewash' ? 18 : 10, true);
    case 'slat':
      return Array.from({ length: 16 }, (_, index) => {
        const x = index * 34;
        return `<rect x="${x}" y="0" width="25" height="512" fill="${index % 2 ? c.mid : c.base}"/><rect x="${x + 25}" y="0" width="9" height="512" fill="${c.dark}" fill-opacity="0.35"/>`;
      }).join('') + grainLines(material, 24);
    case 'tile':
      return Array.from({ length: 7 }, (_, index) => `<path d="M ${index * 86} 0 L ${index * 86} 512 M 0 ${index * 86} L 512 ${index * 86}" stroke="${c.dark}" stroke-opacity="0.2" stroke-width="5"/>`).join('') + speckles(material, 35);
    case 'acoustic-panel':
      return Array.from({ length: 20 }, (_, index) => `<path d="M ${index * 28} 0 L ${index * 28} 512" stroke="${index % 2 ? c.dark : c.light}" stroke-opacity="${index % 2 ? 0.22 : 0.18}" stroke-width="${index % 2 ? 4 : 2}"/>`).join('') + speckles(material, 56);
    case 'brick':
      return Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const w = 112;
          const h = 52;
          const x = col * w - (row % 2 ? 56 : 0);
          const y = row * h + 8;
          return `<rect x="${x}" y="${y}" width="${w - 5}" height="${h - 5}" rx="3" fill="${(row + col) % 3 === 0 ? c.mid : c.base}" stroke="${c.light}" stroke-opacity="0.3" stroke-width="3"/>`;
        }).join('')
      ).join('') + speckles(material, 60);
    case 'corten':
      return speckles(material, 95, true) + grainLines(material, 22, true);
    case 'cladding-panel':
      return Array.from({ length: 6 }, (_, index) => `<rect x="${index * 88}" y="0" width="82" height="512" fill="${index % 2 ? c.mid : c.base}" stroke="${c.dark}" stroke-opacity="0.18" stroke-width="3"/>`).join('') + grainLines(material, 18, true);
    case 'stone-cladding':
      return Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => {
          const x = col * 132 - (row % 2 ? 42 : 0);
          const y = row * 66;
          const w = 122 + seeded(material.id, row + col, 34);
          return `<rect x="${x}" y="${y}" width="${w}" height="58" rx="5" fill="${(row + col) % 2 ? c.mid : c.base}" stroke="${c.dark}" stroke-opacity="0.2" stroke-width="3"/>`;
        }).join('')
      ).join('') + speckles(material, 48);
    case 'standing-seam':
      return Array.from({ length: 7 }, (_, index) => {
        const x = index * 78 + 18;
        return `<rect x="${x}" y="0" width="12" height="512" rx="6" fill="${c.light}" fill-opacity="0.48"/><path d="M ${x + 18} 0 L ${x + 18} 512" stroke="${c.dark}" stroke-opacity="0.16" stroke-width="2"/>`;
      }).join('') + grainLines(material, 20, true);
    case 'roof-tile':
      return Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => {
          const x = col * 72 - (row % 2 ? 36 : 0);
          const y = row * 58;
          return `<path d="M ${x} ${y + 18} C ${x + 20} ${y - 2}, ${x + 52} ${y - 2}, ${x + 72} ${y + 18} L ${x + 72} ${y + 58} L ${x} ${y + 58} Z" fill="${(row + col) % 2 ? c.mid : c.base}" stroke="${c.dark}" stroke-opacity="0.18" stroke-width="2"/>`;
        }).join('')
      ).join('');
    case 'slate':
      return Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => `<rect x="${col * 104 - (row % 2 ? 52 : 0)}" y="${row * 66}" width="100" height="61" rx="3" fill="${(row + col) % 2 ? c.mid : c.base}" stroke="${c.light}" stroke-opacity="0.12" stroke-width="2"/>`).join('')
      ).join('') + grainLines(material, 18, true);
    case 'gravel':
      return speckles(material, 130, true);
    case 'green-roof':
      return speckles(material, 120) + Array.from({ length: 70 }, (_, index) => {
        const x = seeded(material.id, index, 512);
        const y = seeded(material.id, index + 44, 512);
        return `<path d="M ${x} ${y + 10} C ${x - 8} ${y - 12}, ${x + 7} ${y - 15}, ${x + 2} ${y + 8}" stroke="${index % 3 ? c.light : c.accent || c.dark}" stroke-opacity="0.48" stroke-width="3" fill="none"/>`;
      }).join('');
    case 'membrane':
      return `<path d="M 0 132 L 512 132 M 0 264 L 512 264 M 0 396 L 512 396" stroke="${c.light}" stroke-opacity="0.1" stroke-width="4"/>` + speckles(material, 55);
    case 'metal':
      return Array.from({ length: 46 }, (_, index) => `<path d="M 0 ${index * 12 + seeded(material.id, index, 5)} L 512 ${index * 12 + seeded(material.id, index + 5, 5)}" stroke="${index % 5 === 0 ? c.light : c.dark}" stroke-opacity="${index % 5 === 0 ? 0.18 : 0.14}" stroke-width="${index % 5 === 0 ? 2 : 1}"/>`).join('');
    case 'perforated-metal':
      return Array.from({ length: 11 }, (_, row) =>
        Array.from({ length: 11 }, (_, col) => `<circle cx="${col * 50 + (row % 2 ? 25 : 0)}" cy="${row * 50 + 8}" r="10" fill="${c.dark}" fill-opacity="0.42"/><circle cx="${col * 50 + (row % 2 ? 25 : 0) - 3}" cy="${row * 50 + 5}" r="3" fill="${c.light}" fill-opacity="0.25"/>`).join('')
      ).join('');
    case 'glass':
      return `<path d="M -40 430 L 430 -40" stroke="#ffffff" stroke-opacity="0.55" stroke-width="46"/><path d="M 80 536 L 536 80" stroke="#ffffff" stroke-opacity="0.24" stroke-width="22"/><path d="M 0 92 C 150 50, 300 82, 512 26" stroke="${c.dark}" stroke-opacity="0.16" stroke-width="8" fill="none"/>` + speckles(material, 20);
    case 'ribbed-glass':
      return Array.from({ length: 22 }, (_, index) => `<rect x="${index * 25}" y="0" width="12" height="512" fill="#ffffff" fill-opacity="0.28"/><rect x="${index * 25 + 12}" y="0" width="8" height="512" fill="${c.dark}" fill-opacity="0.1"/>`).join('');
    case 'wired-glass':
      return `<path d="M 0 0 L 512 512 M 512 0 L 0 512" stroke="${c.dark}" stroke-opacity="0.34" stroke-width="3"/>` +
        Array.from({ length: 7 }, (_, index) => `<path d="M ${index * 86} 0 L ${index * 86} 512 M 0 ${index * 86} L 512 ${index * 86}" stroke="${c.light}" stroke-opacity="0.35" stroke-width="2"/>`).join('');
    case 'marble':
      return Array.from({ length: 14 }, (_, index) => {
        const y = seeded(material.id, index, 520) - 20;
        const offset = seeded(material.id, index + 10, 80) - 40;
        return `<path d="M -20 ${y} C 100 ${y + offset}, 170 ${y - offset}, 290 ${y + offset * 0.5} S 450 ${y - offset}, 532 ${y + offset * 0.8}" fill="none" stroke="${index % 5 === 0 ? c.accent || c.dark : c.dark}" stroke-opacity="${index % 5 === 0 ? 0.28 : 0.2}" stroke-width="${index % 5 === 0 ? 3 : 1.6}"/>`;
      }).join('') + speckles(material, 20);
    case 'travertine':
      return grainLines(material, 34, true) + Array.from({ length: 48 }, (_, index) => {
        const x = seeded(material.id, index, 512);
        const y = seeded(material.id, index + 12, 512);
        return `<ellipse cx="${x}" cy="${y}" rx="${12 + seeded(material.id, index + 2, 22)}" ry="${2 + seeded(material.id, index + 5, 5)}" fill="${c.dark}" fill-opacity="0.16"/>`;
      }).join('');
    case 'stone':
      return speckles(material, 92) + grainLines(material, 16, true);
    case 'fabric':
      return Array.from({ length: 32 }, (_, index) => `<path d="M ${index * 16} 0 L ${index * 16} 512 M 0 ${index * 16} L 512 ${index * 16}" stroke="${index % 2 ? c.dark : c.light}" stroke-opacity="0.18" stroke-width="${index % 2 ? 3 : 1}"/>`).join('') + speckles(material, 30);
    case 'leather':
      return speckles(material, 78) + Array.from({ length: 24 }, (_, index) => {
        const x = seeded(material.id, index, 512);
        const y = seeded(material.id, index + 16, 512);
        return `<path d="M ${x - 34} ${y} C ${x - 6} ${y - 18}, ${x + 12} ${y + 16}, ${x + 38} ${y - 4}" stroke="${c.light}" stroke-opacity="0.16" stroke-width="2" fill="none"/>`;
      }).join('');
    case 'velvet':
      return `<path d="M -20 70 C 120 160, 240 10, 532 120 L 532 250 C 340 200, 220 350, -20 260 Z" fill="${c.light}" fill-opacity="0.24"/><path d="M -20 330 C 130 250, 300 470, 532 350 L 532 512 L -20 512 Z" fill="${c.dark}" fill-opacity="0.2"/>` + grainLines(material, 18);
    case 'sheer':
      return Array.from({ length: 16 }, (_, index) => `<rect x="${index * 36}" y="0" width="16" height="512" fill="#ffffff" fill-opacity="0.34"/><path d="M ${index * 36 + 22} 0 L ${index * 36 + 22} 512" stroke="${c.dark}" stroke-opacity="0.12" stroke-width="2"/>`).join('');
    default:
      return speckles(material, 70);
  }
};

const materialSeeds: MaterialSeed[] = [
  { id: 'floor-oak', label: 'Oak Plank', category: 'Flooring', description: 'Warm natural oak plank flooring with visible long grain, honey-brown tone, board seams, and a satin sealed finish.', tags: ['oak', 'wood', 'plank', 'floor'], texture: 'wood-plank', colors: { base: '#b9824d', mid: '#8d5f35', dark: '#593819', light: '#e6bf83', accent: '#c9945f' } },
  { id: 'floor-walnut', label: 'Walnut Plank', category: 'Flooring', description: 'Dark walnut plank flooring with chocolate brown grain, rich contrast, long board seams, and a refined satin sheen.', tags: ['walnut', 'wood', 'dark', 'floor'], texture: 'wood-plank', colors: { base: '#61402b', mid: '#3d2419', dark: '#20120d', light: '#9a6b4d', accent: '#7e5236' } },
  { id: 'floor-maple', label: 'Maple', category: 'Flooring', description: 'Pale maple wood flooring with fine straight grain, soft blond color, minimal knots, and a clean matte finish.', tags: ['maple', 'wood', 'light', 'floor'], texture: 'wood-plank', colors: { base: '#d5b57a', mid: '#b48b4f', dark: '#75522c', light: '#f1dca4', accent: '#c79d62' } },
  { id: 'floor-terrazzo', label: 'Terrazzo', category: 'Flooring', description: 'Poured terrazzo flooring with a warm cement base and clearly visible marble and aggregate chips at architectural scale.', tags: ['terrazzo', 'aggregate', 'chips', 'floor'], texture: 'terrazzo', colors: { base: '#d8d0bd', mid: '#b6a98d', dark: '#59544c', light: '#f4efe2', accent: '#9b6f5d', accent2: '#738d9a' } },
  { id: 'floor-polished-concrete', label: 'Polished Concrete', category: 'Flooring', description: 'Smooth polished concrete floor with subtle grey mottling, faint trowel movement, and a low-gloss reflective finish.', tags: ['polished', 'concrete', 'grey', 'floor'], texture: 'concrete', colors: { base: '#a7a39a', mid: '#7b7973', dark: '#56534e', light: '#d2cec4', accent: '#8f8c84' } },
  { id: 'floor-bamboo', label: 'Bamboo', category: 'Flooring', description: 'Golden bamboo flooring with narrow vertical strips, natural node bands, linear grain, and a durable satin coating.', tags: ['bamboo', 'wood', 'strip', 'floor'], texture: 'bamboo', colors: { base: '#d4a84f', mid: '#ad7d31', dark: '#724e1c', light: '#efd17d', accent: '#c39340' } },
  { id: 'floor-cork', label: 'Cork', category: 'Flooring', description: 'Warm cork flooring made from compressed granules, with dense organic speckling and a soft matte surface.', tags: ['cork', 'speckled', 'floor'], texture: 'cork', colors: { base: '#b98551', mid: '#8e6238', dark: '#56381f', light: '#d9ae76', accent: '#6e4a2d' } },
  { id: 'floor-chevron', label: 'Chevron Oak', category: 'Flooring', description: 'Chevron oak parquet flooring with angled boards, crisp seams, warm oak grain, and a natural residential finish.', tags: ['chevron', 'herringbone', 'oak', 'parquet'], texture: 'herringbone', colors: { base: '#bc874f', mid: '#996233', dark: '#5a371c', light: '#e1b877', accent: '#c99a62' } },

  { id: 'wall-plaster', label: 'White Plaster', category: 'Wall', description: 'Smooth white plaster wall finish with soft hand-applied movement, subtle tonal variation, and a matte mineral surface.', tags: ['white', 'plaster', 'wall', 'matte'], texture: 'plaster', colors: { base: '#e4e0d5', mid: '#c9c3b8', dark: '#9b968d', light: '#faf8ef', accent: '#d7d1c4' } },
  { id: 'wall-venetian', label: 'Venetian Plaster', category: 'Wall', description: 'Venetian plaster wall with layered mineral depth, cloudy trowel movement, and a refined soft sheen.', tags: ['venetian', 'plaster', 'stucco', 'wall'], texture: 'limewash', colors: { base: '#d6cab9', mid: '#b8aa96', dark: '#817767', light: '#f1e9dc', accent: '#c7b79f' } },
  { id: 'wall-gypsum', label: 'Painted Gypsum', category: 'Wall', description: 'Clean painted gypsum board wall with a uniform off-white architectural paint finish and very fine surface texture.', tags: ['paint', 'gypsum', 'drywall', 'wall'], texture: 'plaster', colors: { base: '#ebe8df', mid: '#d0ccc2', dark: '#aaa49a', light: '#ffffff', accent: '#ded9cf' } },
  { id: 'wall-limewash', label: 'Limewash', category: 'Wall', description: 'Limewash wall finish with chalky mineral color variation, cloud-like brush movement, and a soft matte appearance.', tags: ['limewash', 'mineral', 'wall', 'matte'], texture: 'limewash', colors: { base: '#cfc6b7', mid: '#aaa08f', dark: '#7d7466', light: '#eee6d7', accent: '#bdb2a1' } },
  { id: 'wall-microcement', label: 'Microcement', category: 'Wall', description: 'Continuous microcement wall finish with fine concrete movement, sealed matte texture, and subtle grey-beige mottling.', tags: ['microcement', 'concrete', 'wall'], texture: 'microcement', colors: { base: '#b3afa5', mid: '#918d84', dark: '#66635e', light: '#d6d2c7', accent: '#a09b91' } },
  { id: 'wall-wood-slat', label: 'Wood Slat', category: 'Wall', description: 'Vertical wood slat wall with narrow warm timber battens, dark shadow reveals, and visible linear grain.', tags: ['wood', 'slat', 'panel', 'wall'], texture: 'slat', colors: { base: '#a66c3d', mid: '#7b4b2b', dark: '#211711', light: '#d0a16a', accent: '#b57c49' } },
  { id: 'wall-ceramic-tile', label: 'Ceramic Tile', category: 'Wall', description: 'Glazed ceramic wall tile with crisp grout lines, clean modular joints, and a slightly reflective handmade surface.', tags: ['ceramic', 'tile', 'grout', 'wall'], texture: 'tile', colors: { base: '#d8e1df', mid: '#aabbb8', dark: '#7f908e', light: '#f5fbfa', accent: '#bfd0cd' } },
  { id: 'wall-acoustic', label: 'Acoustic Panel', category: 'Wall', description: 'Architectural acoustic wall panel with ribbed felt texture, quiet fabric grain, and soft sound-absorbing matte finish.', tags: ['acoustic', 'felt', 'panel', 'wall'], texture: 'acoustic-panel', colors: { base: '#8b8a82', mid: '#6e6d67', dark: '#4a4945', light: '#b7b5aa', accent: '#77756d' } },

  { id: 'facade-brick-red', label: 'Red Brick', category: 'Facade', description: 'Classic red brick facade with staggered masonry courses, mortar joints, fired clay variation, and lightly weathered texture.', tags: ['red', 'brick', 'masonry', 'facade'], texture: 'brick', colors: { base: '#9b3f2e', mid: '#6f2e24', dark: '#3f1f19', light: '#cf7861', accent: '#b95743' } },
  { id: 'facade-brick-white', label: 'White Brick', category: 'Facade', description: 'White painted or limewashed brick facade with visible masonry bond, pale mortar, and subtle surface aging.', tags: ['white', 'brick', 'masonry', 'facade'], texture: 'brick', colors: { base: '#d9d5c9', mid: '#b8b1a3', dark: '#837d74', light: '#f7f4e9', accent: '#cbc5b7' } },
  { id: 'facade-brick-dark', label: 'Dark Brick', category: 'Facade', description: 'Dark charcoal brick facade with staggered courses, deep mortar shadows, and low-sheen fired ceramic texture.', tags: ['dark', 'brick', 'masonry', 'facade'], texture: 'brick', colors: { base: '#3f403d', mid: '#2c2d2b', dark: '#171817', light: '#6b6d68', accent: '#51524e' } },
  { id: 'facade-corten', label: 'Corten Panel', category: 'Facade', description: 'Corten weathering steel facade panels with orange-brown rust patina, mottled oxidation, and matte industrial character.', tags: ['corten', 'steel', 'rust', 'facade'], texture: 'corten', colors: { base: '#9b4f27', mid: '#6d341d', dark: '#3b1c12', light: '#ce7440', accent: '#b85d2f', accent2: '#5b2a18' } },
  { id: 'facade-aluminum', label: 'Aluminum Panel', category: 'Facade', description: 'Architectural aluminum cladding panel with cool satin metallic finish, precise vertical seams, and soft linear reflections.', tags: ['aluminum', 'panel', 'metal', 'facade'], texture: 'cladding-panel', colors: { base: '#aeb5b8', mid: '#81898d', dark: '#5c6468', light: '#dce3e6', accent: '#c2c9cc' } },
  { id: 'facade-fiber-cement', label: 'Fiber Cement', category: 'Facade', description: 'Fiber cement facade board with flat mineral texture, muted grey tone, panel seams, and subtle manufactured variation.', tags: ['fiber cement', 'cement board', 'facade'], texture: 'cladding-panel', colors: { base: '#9ca19d', mid: '#777d79', dark: '#555a57', light: '#c6cbc7', accent: '#aeb3af' } },
  { id: 'facade-concrete-board', label: 'Concrete Board', category: 'Facade', description: 'Concrete board cladding with flat grey cement panels, crisp joints, and restrained architectural surface mottling.', tags: ['concrete', 'board', 'panel', 'facade'], texture: 'cladding-panel', colors: { base: '#9d9b92', mid: '#77766f', dark: '#56544e', light: '#c8c5bc', accent: '#aaa79e' } },
  { id: 'facade-stone-clad', label: 'Stone Cladding', category: 'Facade', description: 'Natural stone cladding facade with irregular rectangular courses, varied grey-beige stones, and recessed mortar joints.', tags: ['stone', 'cladding', 'facade'], texture: 'stone-cladding', colors: { base: '#9d9586', mid: '#756f64', dark: '#4f4a43', light: '#cbc2b2', accent: '#aaa08e' } },

  { id: 'roof-standing-seam', label: 'Standing Seam', category: 'Roof', description: 'Standing seam metal roof with long vertical raised ribs, satin grey finish, crisp seams, and subtle linear highlights.', tags: ['standing seam', 'metal', 'roof'], texture: 'standing-seam', colors: { base: '#667077', mid: '#485158', dark: '#2e363c', light: '#a8b2b8', accent: '#7c878f' } },
  { id: 'roof-clay-tile', label: 'Clay Tile', category: 'Roof', description: 'Terracotta clay roof tile with repeating curved courses, fired orange color, and slight handmade surface variation.', tags: ['clay', 'tile', 'terracotta', 'roof'], texture: 'roof-tile', colors: { base: '#b65d32', mid: '#8b3f24', dark: '#562619', light: '#dc8c58', accent: '#c96d3e' } },
  { id: 'roof-slate', label: 'Slate', category: 'Roof', description: 'Natural slate roof with overlapping dark grey stone shingles, fine horizontal texture, and muted matte mineral finish.', tags: ['slate', 'stone', 'roof'], texture: 'slate', colors: { base: '#4e5960', mid: '#354047', dark: '#20272d', light: '#78858c', accent: '#606c73' } },
  { id: 'roof-gravel', label: 'Gravel', category: 'Roof', description: 'Ballasted gravel roof surface with small rounded aggregate stones, varied grey-beige color, and granular roughness.', tags: ['gravel', 'aggregate', 'roof'], texture: 'gravel', colors: { base: '#9d9586', mid: '#746d62', dark: '#4f4a43', light: '#c6bdad', accent: '#b0a493', accent2: '#847c70' } },
  { id: 'roof-green', label: 'Green Roof', category: 'Roof', description: 'Vegetated green roof with dense sedum texture, mixed greens, organic planting variation, and soft natural roughness.', tags: ['green roof', 'sedum', 'vegetation', 'roof'], texture: 'green-roof', colors: { base: '#557a3a', mid: '#385927', dark: '#253d1d', light: '#8eaa5c', accent: '#6f9346', accent2: '#b5b96b' } },
  { id: 'roof-epdm', label: 'EPDM Membrane', category: 'Roof', description: 'Dark EPDM roof membrane with broad sheet seams, rubbery matte black surface, and faint fine-grain texture.', tags: ['epdm', 'membrane', 'rubber', 'roof'], texture: 'membrane', colors: { base: '#252626', mid: '#181919', dark: '#090909', light: '#4a4b4b', accent: '#333434' } },
  { id: 'roof-copper', label: 'Copper Roof', category: 'Roof', description: 'Copper roof finish with warm metallic orange-brown tone, standing sheet movement, and architectural weathering hints.', tags: ['copper', 'metal', 'roof'], texture: 'standing-seam', colors: { base: '#a86234', mid: '#7d4124', dark: '#492316', light: '#d28c52', accent: '#bd7442' } },

  { id: 'metal-brushed-steel', label: 'Brushed Steel', category: 'Metal', description: 'Brushed stainless steel with fine horizontal grain, cool silver tone, anisotropic highlights, and a clean satin finish.', tags: ['brushed', 'steel', 'metal'], texture: 'metal', colors: { base: '#a7adb0', mid: '#7a8286', dark: '#555e62', light: '#d7dee1', accent: '#c0c7ca' } },
  { id: 'metal-black', label: 'Black Steel', category: 'Metal', description: 'Matte black steel with very subtle brushed texture, dark charcoal tone, and restrained architectural reflectivity.', tags: ['black', 'steel', 'metal'], texture: 'metal', colors: { base: '#282a2b', mid: '#181a1b', dark: '#080909', light: '#55595b', accent: '#3b3f41' } },
  { id: 'metal-anodized', label: 'Anodized Aluminum', category: 'Metal', description: 'Anodized aluminum with smooth champagne-silver color, soft vertical brushing, and precise manufactured surface quality.', tags: ['anodized', 'aluminum', 'metal'], texture: 'metal', colors: { base: '#b9b3a6', mid: '#8f897e', dark: '#69645d', light: '#e0dacd', accent: '#c7c1b4' } },
  { id: 'metal-brass', label: 'Brass', category: 'Metal', description: 'Brass metal finish with warm golden color, fine brushing, mellow reflections, and polished architectural hardware character.', tags: ['brass', 'gold', 'metal'], texture: 'metal', colors: { base: '#b89036', mid: '#826520', dark: '#4d3a12', light: '#e6c466', accent: '#cda64a' } },
  { id: 'metal-copper-patina', label: 'Copper Patina', category: 'Metal', description: 'Aged copper patina with blue-green oxidation, remaining copper undertones, mottled weathering, and matte mineral texture.', tags: ['copper', 'patina', 'verdigris', 'metal'], texture: 'corten', colors: { base: '#4f8f83', mid: '#2f655d', dark: '#1d3b37', light: '#8ec1b4', accent: '#a96c3b', accent2: '#2b544d' } },
  { id: 'metal-zinc', label: 'Zinc', category: 'Metal', description: 'Weathered zinc sheet metal with soft blue-grey tone, cloudy patina, fine linear grain, and low-reflective finish.', tags: ['zinc', 'metal', 'sheet'], texture: 'metal', colors: { base: '#8c989b', mid: '#667276', dark: '#454f53', light: '#bdc7ca', accent: '#9aa6a9' } },
  { id: 'metal-perforated', label: 'Perforated Metal', category: 'Metal', description: 'Perforated metal panel with regular round holes, cool grey satin finish, and clear industrial facade texture.', tags: ['perforated', 'metal', 'panel'], texture: 'perforated-metal', colors: { base: '#9aa1a3', mid: '#70787b', dark: '#2e3437', light: '#d1d8da', accent: '#adb5b7' } },

  { id: 'glass-clear', label: 'Clear Glass', category: 'Glass', description: 'Clear architectural glass with transparent blue-grey edges, crisp highlights, and realistic environmental reflections.', tags: ['clear', 'glass', 'transparent'], texture: 'glass', colors: { base: '#b9d2d8', mid: '#7fa0a8', dark: '#4d737d', light: '#ecfbff', accent: '#d8f2f6' } },
  { id: 'glass-frosted', label: 'Frosted Glass', category: 'Glass', description: 'Frosted glass with milky translucent surface, diffused reflections, soft blur, and a pale blue-white tint.', tags: ['frosted', 'glass', 'translucent'], texture: 'glass', colors: { base: '#d5e2e3', mid: '#a8bfc2', dark: '#7c989d', light: '#f8ffff', accent: '#e7f1f2' } },
  { id: 'glass-tinted', label: 'Tinted Glass', category: 'Glass', description: 'Tinted architectural glass with smoky grey-blue color, controlled reflectivity, and deep transparent shadow tone.', tags: ['tinted', 'smoked', 'glass'], texture: 'glass', colors: { base: '#6b858e', mid: '#465d65', dark: '#26363d', light: '#a8bdc4', accent: '#819aa3' } },
  { id: 'glass-low-e', label: 'Low-E Glass', category: 'Glass', description: 'Low-E performance glass with pale blue-green reflective coating, clean highlights, and subtle high-tech sheen.', tags: ['low-e', 'glass', 'coated'], texture: 'glass', colors: { base: '#a8c7c0', mid: '#6e9990', dark: '#426860', light: '#e7fbf5', accent: '#c7e6df' } },
  { id: 'glass-ribbed', label: 'Ribbed Glass', category: 'Glass', description: 'Ribbed glass with vertical flutes, alternating bright and shadow bands, and translucent privacy texture.', tags: ['ribbed', 'fluted', 'glass'], texture: 'ribbed-glass', colors: { base: '#bfd5d7', mid: '#8eaaae', dark: '#5b7b81', light: '#f0ffff', accent: '#d6ecee' } },
  { id: 'glass-reflective', label: 'Reflective Glass', category: 'Glass', description: 'Reflective facade glass with darker mirror-like blue tone, strong diagonal highlights, and glossy exterior reflections.', tags: ['reflective', 'mirror', 'glass'], texture: 'glass', colors: { base: '#527186', mid: '#2f4b5e', dark: '#172b38', light: '#a7c1cf', accent: '#7698aa' } },
  { id: 'glass-wired', label: 'Wired Glass', category: 'Glass', description: 'Wired safety glass with embedded square wire mesh, translucent surface, and visible reinforced grid pattern.', tags: ['wired', 'mesh', 'glass'], texture: 'wired-glass', colors: { base: '#c7d7d8', mid: '#9aafb2', dark: '#6d8589', light: '#f4ffff', accent: '#dae8e9' } },

  { id: 'stone-marble', label: 'Marble', category: 'Stone', description: 'White marble slab with soft grey veining, occasional warm accent veins, polished stone depth, and luxury interior character.', tags: ['marble', 'white', 'vein', 'stone'], texture: 'marble', colors: { base: '#e7e3da', mid: '#c9c4bb', dark: '#7e7b75', light: '#fffdf6', accent: '#b99a6c' } },
  { id: 'stone-travertine', label: 'Travertine', category: 'Stone', description: 'Travertine stone with warm beige horizontal bands, small pores, filled surface, and honed natural limestone texture.', tags: ['travertine', 'beige', 'stone'], texture: 'travertine', colors: { base: '#c7ad84', mid: '#9f8058', dark: '#6f5638', light: '#e8d0a5', accent: '#b99468' } },
  { id: 'stone-limestone', label: 'Limestone', category: 'Stone', description: 'Limestone surface with pale beige-grey mineral texture, fine fossil-like speckling, and honed matte finish.', tags: ['limestone', 'beige', 'stone'], texture: 'stone', colors: { base: '#c9c1ad', mid: '#a29985', dark: '#746d5f', light: '#ebe2cc', accent: '#b7ae99' } },
  { id: 'stone-granite', label: 'Granite', category: 'Stone', description: 'Granite stone with dense black, white, and grey crystalline speckles, hard polished texture, and high durability.', tags: ['granite', 'speckled', 'stone'], texture: 'stone', colors: { base: '#777a78', mid: '#535654', dark: '#242725', light: '#c2c5c2', accent: '#929590' } },
  { id: 'stone-sandstone', label: 'Sandstone', category: 'Stone', description: 'Sandstone with warm tan granular texture, soft sedimentary bands, and a dry matte natural surface.', tags: ['sandstone', 'tan', 'stone'], texture: 'stone', colors: { base: '#bd9563', mid: '#947043', dark: '#60472a', light: '#dfbd84', accent: '#cfa36c' } },
  { id: 'stone-basalt', label: 'Basalt', category: 'Stone', description: 'Dark basalt stone with charcoal volcanic texture, fine mineral speckling, and dense honed matte finish.', tags: ['basalt', 'dark', 'stone'], texture: 'stone', colors: { base: '#3e4241', mid: '#2a2d2c', dark: '#151717', light: '#6c7270', accent: '#505654' } },
  { id: 'stone-quartzite', label: 'Quartzite', category: 'Stone', description: 'Quartzite slab with pale crystalline surface, sweeping grey-gold veining, and elegant polished natural stone movement.', tags: ['quartzite', 'vein', 'stone'], texture: 'marble', colors: { base: '#d8d1c2', mid: '#b5aa98', dark: '#6d675f', light: '#f6efe1', accent: '#9d8762' } },

  { id: 'fabric-linen', label: 'Linen', category: 'Fabric', description: 'Natural linen fabric with visible woven threads, warm off-white tone, soft slub irregularity, and a matte textile finish.', tags: ['linen', 'fabric', 'woven'], texture: 'fabric', colors: { base: '#cfc2aa', mid: '#a89b83', dark: '#766d5c', light: '#eee4cf', accent: '#d9ccb4' } },
  { id: 'fabric-wool', label: 'Wool Felt', category: 'Fabric', description: 'Wool felt textile with dense soft fibers, muted grey color, fuzzy matte surface, and acoustic upholstery character.', tags: ['wool', 'felt', 'fabric'], texture: 'fabric', colors: { base: '#85857e', mid: '#66665f', dark: '#44443f', light: '#b0b0a6', accent: '#77776f' } },
  { id: 'fabric-leather', label: 'Leather', category: 'Fabric', description: 'Natural leather upholstery with warm brown tone, fine grain, subtle creasing, and soft semi-matte highlights.', tags: ['leather', 'upholstery', 'fabric'], texture: 'leather', colors: { base: '#8a4f2d', mid: '#5f321e', dark: '#2d160d', light: '#b97a4b', accent: '#9f6138' } },
  { id: 'fabric-velvet', label: 'Velvet', category: 'Fabric', description: 'Velvet upholstery with deep plush pile, directional sheen, saturated color, and soft luxury textile highlights.', tags: ['velvet', 'fabric', 'upholstery'], texture: 'velvet', colors: { base: '#4e315e', mid: '#351f42', dark: '#1d1026', light: '#85669a', accent: '#6b4d80' } },
  { id: 'fabric-canvas', label: 'Canvas', category: 'Fabric', description: 'Canvas fabric with coarse plain weave, sturdy natural fibers, muted tan color, and practical matte texture.', tags: ['canvas', 'fabric', 'woven'], texture: 'fabric', colors: { base: '#aa9675', mid: '#806e53', dark: '#5a4c38', light: '#d0bd96', accent: '#bca783' } },
  { id: 'fabric-sheer', label: 'Sheer', category: 'Fabric', description: 'Sheer curtain fabric with translucent vertical threads, light milky tone, and delicate soft textile rhythm.', tags: ['sheer', 'curtain', 'fabric', 'translucent'], texture: 'sheer', colors: { base: '#e5e3da', mid: '#c8c6bd', dark: '#9e9c93', light: '#ffffff', accent: '#eeeeea' } },
  { id: 'fabric-acoustic', label: 'Acoustic Fabric', category: 'Fabric', description: 'Acoustic fabric with tight woven texture, muted charcoal tone, subtle thread variation, and sound-panel matte finish.', tags: ['acoustic', 'fabric', 'woven', 'panel'], texture: 'fabric', colors: { base: '#4f5658', mid: '#363d3f', dark: '#202527', light: '#7a8487', accent: '#616b6e' } },
];

const AMBIENT_CG_CDN_BASE = 'https://acg-media.struffelproductions.com/file/ambientCG-Web/media';
const POLY_HAVEN_THUMB_BASE = 'https://cdn.polyhaven.com/asset_img/thumbs';
const TARGET_MATERIAL_COUNT = 270;

const ambientCgAssetIds: Record<string, string> = {
  'floor-oak': 'Wood049',
  'floor-walnut': 'Wood051',
  'floor-maple': 'Wood095',
  'floor-terrazzo': 'Terrazzo013',
  'floor-polished-concrete': 'Concrete048',
  'floor-bamboo': 'Bamboo001B',
  'floor-cork': 'Cork002',
  'floor-chevron': 'WoodFloor034',
  'wall-plaster': 'Plaster001',
  'wall-venetian': 'Plaster002',
  'wall-gypsum': 'PaintedPlaster017',
  'wall-limewash': 'Plaster003',
  'wall-microcement': 'Concrete034',
  'wall-wood-slat': 'Wood092',
  'wall-ceramic-tile': 'Tiles133A',
  'wall-acoustic': 'AcousticFoam003',
  'facade-brick-red': 'Bricks051',
  'facade-brick-white': 'Bricks060',
  'facade-brick-dark': 'Bricks089',
  'facade-corten': 'Metal063',
  'facade-aluminum': 'Metal050A',
  'facade-fiber-cement': 'Concrete046',
  'facade-concrete-board': 'Concrete047A',
  'facade-stone-clad': 'Rock051',
  'roof-standing-seam': 'CorrugatedSteel009',
  'roof-clay-tile': 'RoofingTiles013A',
  'roof-slate': 'RoofingTiles003',
  'roof-gravel': 'Gravel043',
  'roof-green': 'Grass005',
  'roof-epdm': 'Rubber004',
  'roof-copper': 'Metal057A',
  'metal-brushed-steel': 'Metal049A',
  'metal-black': 'Metal046A',
  'metal-anodized': 'Metal050A',
  'metal-brass': 'Metal034',
  'metal-copper-patina': 'Metal058C',
  'metal-zinc': 'Metal032',
  'metal-perforated': 'SheetMetal001',
  'stone-marble': 'Marble012',
  'stone-travertine': 'Travertine009',
  'stone-limestone': 'Travertine001',
  'stone-granite': 'Granite002A',
  'stone-sandstone': 'Bricks084',
  'stone-basalt': 'Rock035',
  'stone-quartzite': 'Marble021',
  'fabric-linen': 'Fabric019',
  'fabric-wool': 'Carpet016',
  'fabric-leather': 'Leather038',
  'fabric-velvet': 'Fabric081A',
  'fabric-canvas': 'Fabric036',
  'fabric-sheer': 'Fabric081C',
  'fabric-acoustic': 'Fabric082A',
};

const getAmbientCgPreviewUrl = (assetId: string) =>
  `${AMBIENT_CG_CDN_BASE}/thumbnail/256-WEBP/${assetId}.webp`;

const getAmbientCgTextureUrl = (assetId: string) =>
  `${AMBIENT_CG_CDN_BASE}/surface-preview/${assetId}/${assetId}_SQ_Color.jpg`;

const getAmbientCgSourceUrl = (assetId: string) =>
  `https://ambientcg.com/a/${assetId}`;

const getAmbientCgSource = (assetId: string): MaterialSource => ({
  label: 'ambientCG',
  assetId,
  previewUrl: getAmbientCgPreviewUrl(assetId),
  referenceUrl: getAmbientCgTextureUrl(assetId),
  sourceUrl: getAmbientCgSourceUrl(assetId),
});

const getPolyHavenPreviewUrl = (slug: string, size = 256) =>
  `${POLY_HAVEN_THUMB_BASE}/${slug}.png?width=${size}&height=${size}`;

const getPolyHavenSourceUrl = (slug: string) =>
  `https://polyhaven.com/a/${slug}`;

const getPolyHavenSource = (slug: string): MaterialSource => ({
  label: 'Poly Haven',
  assetId: slug,
  previewUrl: getPolyHavenPreviewUrl(slug, 256),
  referenceUrl: getPolyHavenPreviewUrl(slug, 512),
  sourceUrl: getPolyHavenSourceUrl(slug),
});

const materialSourceOverrides: Record<string, MaterialSource> = {
  'wall-plaster': getPolyHavenSource('white_plaster_02'),
  'wall-venetian': getPolyHavenSource('painted_plaster_wall'),
  'wall-limewash': getPolyHavenSource('white_rough_plaster'),
  'wall-microcement': getPolyHavenSource('brushed_concrete'),
};

const polyHavenSlugsByCategory: Record<MaterialCategory, string[]> = {
  Flooring: [
    'plywood',
    'laminate_floor_02',
    'concrete_floor_worn_001',
    'asphalt_02',
    'metal_plate',
    'wood_floor',
    'kitchen_wood',
    'floor_tiles_06',
    'wood_floor_deck',
    'aerial_asphalt_01',
    'granite_tile',
    'laminate_floor_03',
    'wood_planks',
    'large_floor_tiles_02',
    'large_square_pattern_01',
    'large_grey_tiles',
    'wood_floor_worn',
    'wooden_planks',
    'laminate_floor',
    'rubber_tiles',
    'gravel_embedded_concrete',
    'rocky_trail_02',
    'concrete_floor_01',
    'dry_riverbed_rock',
    'floor_tiles_08',
    'gravel_concrete_03',
    'dark_wooden_planks',
    'granular_concrete',
    'rock_tile_floor',
    'herringbone_parquet',
    'worn_planks',
    'gravel_concrete',
    'painted_concrete',
    'brushed_concrete',
    'asphalt_01',
    'cobblestone_floor_04',
    'asphalt_pit_lane',
    'pavement_02',
    'brick_moss_001',
    'pavement_03',
    'slab_tiles',
    'plank_flooring_04',
    't_brick_floor_002',
    'hexagonal_concrete_paving',
  ],
  Wall: [
    'beige_wall_001',
    'painted_plaster_wall',
    'white_plaster_rough_01',
    'worn_cracked_plaster',
    'red_brick',
    'brown_planks_03',
    'planks_brown_10',
    'wood_planks_dirt',
    'synthetic_wood',
    'red_brick_03',
    'medieval_blocks_03',
    'brick_4',
    'castle_brick_02_red',
    'concrete_layers_02',
    'cracked_concrete_wall',
    'rustic_stone_wall_02',
    'plaster_grey_04',
    'brick_wall_001',
    'brown_planks_05',
    'stone_brick_wall_001',
    'factory_wall',
    'stone_wall',
    'concrete_wall_003',
    'red_bricks_04',
    'wood_peeling_paint_weathered',
    'sandstone_blocks_05',
    'castle_wall_slates',
    'broken_wall',
    'concrete',
    'rough_block_wall',
    'brick_wall_006',
    'white_rough_plaster',
    'beige_wall_002',
    'raw_plank_wall',
    'concrete_wall_007',
    'plastered_wall',
    'plastered_stone_wall',
    'concrete_wall_008',
    'factory_brick',
    'green_rough_planks',
    'large_red_bricks',
    'plastered_wall_04',
    'castle_brick_07',
    'concrete_wall_001',
  ],
  Facade: [
    'oak_veneer_01',
    'rough_wood',
    'fine_grained_wood',
    'rosewood_veneer1',
    'rusty_metal_04',
    'corrugated_iron',
    'rusty_metal_sheet',
    'blue_metal_plate',
    'corrugated_iron_02',
    'metal_plate_02',
    'medieval_red_brick',
    'blue_painted_planks',
    'rough_concrete',
    'rusty_metal_03',
    'plastered_wall_03',
    'red_plaster_weathered',
    'brick_wall_005',
    'plaster_brick_pattern',
    'white_sandstone_blocks_02',
    'white_plaster_rough_02',
    'concrete_wall_004',
    'painted_metal_shutter',
    'rusty_metal',
    'wall_bricks_plaster',
    'brick_wall_02',
    'rock_wall_10',
    'rock_wall_13',
    'church_bricks_02',
    'metal_grate_rusty',
    'white_sandstone_bricks_03',
    'box_profile_metal_sheet',
    'plastered_wall_05',
    'castle_wall_varriation',
    'damaged_plaster',
    'plaster_brick_01',
    'rock_wall_11',
    'concrete_layers',
    'concrete_wall_006',
    'rough_plaster_broken',
    'brick_wall_09',
    'rock_wall_04',
    'rock_wall_08',
    'broken_brick_wall',
  ],
  Roof: [
    'roof_09',
    'roof_slates_03',
    'grey_roof_01',
    'ceramic_roof_01',
    'grey_roof_tiles_02',
    'roof_tiles_14',
    'clay_roof_tiles_02',
    'roof_slates_02',
    'thatch_roof_angled',
    'grey_roof_tiles',
    'roof_07',
    'reed_roof_04',
    'riet_01',
    'roof_3',
    'red_slate_roof_tiles_01',
    'worn_corrugated_iron',
    'reed_roof_03',
    'clay_roof_tiles_03',
    'roof_tiles',
    'clay_roof_tiles',
  ],
  Metal: [
    'green_metal_rust',
    'rusty_metal_grid',
    'rusty_metal_05',
    'worn_shutter',
    'rusted_shutter',
    'corrugated_iron_03',
    'rusty_painted_metal',
    'rusty_corrugated_iron',
  ],
  Glass: [],
  Stone: [
    'rock_boulder_dry',
    'rock_01',
    'gray_rocks',
    'ganges_river_pebbles',
    'mossy_rock',
    'rock_05',
    'rock_08',
    'rock_04',
    'rock_06',
    'rock_pitted_mossy',
    'lichen_rock',
    'rock_boulder_cracked',
    'worn_rock_natural_01',
    'terrain_red_01',
    'clean_pebbles',
    'cliff_side',
    'seaside_rock',
    'rock_surface',
    'gravel_stones',
    'rock_2',
    'rock_3',
    'rock_face',
    'grey_stone_path',
    'concrete_pavement_02',
    'coast_sand_04',
    'tiger_rock',
    'wood_stone_pathway',
    'grass_concrete_pavement',
    'marble_rock_01',
    'marble_rock_02',
  ],
  Fabric: [
    'fabric_pattern_07',
    'leather_red_02',
    'quatrefoil_jacquard_fabric',
    'brown_leather',
    'leather_white',
    'denmin_fabric_02',
    'fabric_pattern_05',
    'leather_red_03',
    'fabric_leather_02',
    'denim_fabric',
    'fabric_leather_01',
    'dirty_carpet',
    'velour_velvet',
    'hessian_230',
    'crepe_satin',
    'cotton_jersey',
    'rough_linen',
    'curly_teddy_natural',
    'curly_teddy_checkered',
    'poly_wool_herringbone',
    'hessian_380',
    'denim_fabric_06',
  ],
};

const categoryFallbackStyles: Record<MaterialCategory, Pick<MaterialSeed, 'texture' | 'colors'>> = {
  Flooring: { texture: 'concrete', colors: { base: '#9d988e', mid: '#726d66', dark: '#4a4540', light: '#c9c1b5', accent: '#aaa197' } },
  Wall: { texture: 'plaster', colors: { base: '#cbc5b9', mid: '#a69d90', dark: '#746d63', light: '#eee8dc', accent: '#b9b0a3' } },
  Facade: { texture: 'cladding-panel', colors: { base: '#8f887d', mid: '#686158', dark: '#403a35', light: '#bdb4a7', accent: '#9c9184' } },
  Roof: { texture: 'roof-tile', colors: { base: '#875847', mid: '#5d3c32', dark: '#30211e', light: '#bd8066', accent: '#9b604b' } },
  Metal: { texture: 'metal', colors: { base: '#8e9495', mid: '#666e71', dark: '#373f42', light: '#c3c9ca', accent: '#a5acad' } },
  Glass: { texture: 'glass', colors: { base: '#aac5cc', mid: '#6f929c', dark: '#3d6470', light: '#effcff', accent: '#d6eef3' } },
  Stone: { texture: 'stone', colors: { base: '#8d867a', mid: '#666057', dark: '#403b35', light: '#bbb3a6', accent: '#a59b8d' } },
  Fabric: { texture: 'fabric', colors: { base: '#827a71', mid: '#5d564f', dark: '#39332f', light: '#b4aaa0', accent: '#968b82' } },
};

const titleCaseMaterialSlug = (slug: string) =>
  slug
    .split('_')
    .filter(Boolean)
    .map((part) => {
      const normalized = part === 'denmin' ? 'denim' : part === 'riet' ? 'reed' : part;
      return /^[0-9]+$/.test(normalized)
        ? normalized
        : normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(' ');

const tagsFromSlug = (slug: string) =>
  slug.split('_').filter((part) => part && !/^[0-9]+$/.test(part));

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

const inferPolyHavenStyle = (slug: string, category: MaterialCategory): Pick<MaterialSeed, 'texture' | 'colors'> => {
  const normalized = slug.replace(/-/g, '_');

  if (includesAny(normalized, ['herringbone', 'parquet'])) {
    return { texture: 'herringbone', colors: { base: '#a66f3c', mid: '#794720', dark: '#3e2110', light: '#d0a16a', accent: '#b87c46' } };
  }
  if (includesAny(normalized, ['wood', 'plank', 'plywood', 'veneer', 'laminate'])) {
    return { texture: 'wood-plank', colors: { base: '#9a693f', mid: '#6f4528', dark: '#392316', light: '#c79660', accent: '#b27b4c' } };
  }
  if (includesAny(normalized, ['brick'])) {
    return { texture: 'brick', colors: { base: '#9b4c3a', mid: '#6b3026', dark: '#381916', light: '#ca7a62', accent: '#ad5946' } };
  }
  if (includesAny(normalized, ['tile', 'paver', 'paving', 'slab', 'square'])) {
    return { texture: 'tile', colors: { base: '#a7a197', mid: '#7b756c', dark: '#504b45', light: '#d0c9bd', accent: '#b6ada1' } };
  }
  if (includesAny(normalized, ['roof', 'clay', 'ceramic'])) {
    return { texture: 'roof-tile', colors: { base: '#a65a3b', mid: '#7b3d29', dark: '#432116', light: '#d38761', accent: '#ba6745' } };
  }
  if (includesAny(normalized, ['slate'])) {
    return { texture: 'slate', colors: { base: '#536068', mid: '#374349', dark: '#20282d', light: '#7d8990', accent: '#657178' } };
  }
  if (includesAny(normalized, ['metal', 'iron', 'shutter', 'container', 'corrugated'])) {
    return includesAny(normalized, ['rust'])
      ? { texture: 'corten', colors: { base: '#93512d', mid: '#66321f', dark: '#331811', light: '#c4774d', accent: '#ad6036' } }
      : { texture: 'metal', colors: { base: '#8c9395', mid: '#656d70', dark: '#343c3f', light: '#c0c7c9', accent: '#a2aaad' } };
  }
  if (includesAny(normalized, ['plaster', 'concrete', 'asphalt', 'pavement'])) {
    return { texture: includesAny(normalized, ['plaster']) ? 'plaster' : 'concrete', colors: { base: '#aaa59c', mid: '#817c74', dark: '#59544e', light: '#d3cdc3', accent: '#99938a' } };
  }
  if (includesAny(normalized, ['marble'])) {
    return { texture: 'marble', colors: { base: '#d8d4cc', mid: '#b7b2a8', dark: '#706d67', light: '#f6f3ea', accent: '#a99170' } };
  }
  if (includesAny(normalized, ['stone', 'rock', 'pebble', 'gravel', 'cliff'])) {
    return { texture: 'stone', colors: { base: '#8e887c', mid: '#666157', dark: '#403c35', light: '#bbb4a8', accent: '#a59b8c' } };
  }
  if (includesAny(normalized, ['leather'])) {
    return { texture: 'leather', colors: { base: '#825034', mid: '#5b321f', dark: '#2f170f', light: '#b77a50', accent: '#98613e' } };
  }
  if (includesAny(normalized, ['velvet', 'velour'])) {
    return { texture: 'velvet', colors: { base: '#5b3a55', mid: '#3d2639', dark: '#211420', light: '#8e6a84', accent: '#744d6b' } };
  }
  if (category === 'Fabric') {
    return { texture: 'fabric', colors: { base: '#8d8176', mid: '#675c53', dark: '#3d352f', light: '#beb2a6', accent: '#a19386' } };
  }

  return categoryFallbackStyles[category];
};

const createPolyHavenSeed = (slug: string, category: MaterialCategory): MaterialSeed => {
  const style = inferPolyHavenStyle(slug, category);
  const label = titleCaseMaterialSlug(slug);
  const tags = tagsFromSlug(slug);

  return {
    id: `ph-${slug}`,
    label,
    category,
    description: `${label} ${category.toLowerCase()} material with photographed surface detail, natural variation, realistic roughness, and archviz-friendly scale.`,
    tags: [...tags, category.toLowerCase(), 'poly haven', 'photo texture'],
    texture: style.texture,
    colors: style.colors,
    source: getPolyHavenSource(slug),
  };
};

const polyHavenMaterialSeeds: MaterialSeed[] = Object.entries(polyHavenSlugsByCategory)
  .flatMap(([category, slugs]) =>
    slugs.map((slug) => createPolyHavenSeed(slug, category as MaterialCategory))
  );

const allMaterialSeeds = [
  ...materialSeeds,
  ...polyHavenMaterialSeeds.slice(0, Math.max(0, TARGET_MATERIAL_COUNT - materialSeeds.length)),
];

export const MATERIAL_SWATCHES: MaterialSwatch[] = allMaterialSeeds.map((material) => {
  const sourceAssetId = ambientCgAssetIds[material.id] || null;
  const source = material.source || materialSourceOverrides[material.id] || (sourceAssetId ? getAmbientCgSource(sourceAssetId) : null);
  const fallbackPreviewUrl = baseFrame(material, renderTexture(material));
  const previewUrl = source?.previewUrl || fallbackPreviewUrl;
  const referenceUrl = source?.referenceUrl || previewUrl;
  const sourceLabel = source?.label || (sourceAssetId ? 'ambientCG' : 'Generated fallback');
  const sourceId = source?.assetId || sourceAssetId || null;

  return {
    ...material,
    previewUrl,
    referenceUrl,
    fallbackPreviewUrl,
    sourceLabel,
    sourceAssetId: sourceId,
    sourceUrl: source?.sourceUrl || (sourceAssetId ? getAmbientCgSourceUrl(sourceAssetId) : null),
    modelPrompt: [
      material.description,
      source
        ? `Use the attached ${sourceLabel}${sourceId ? ` ${sourceId}` : ''} material photo texture as the exact visual reference.`
        : 'Use the attached generated material swatch as the target visual reference.',
      'Match color, pattern, roughness, reflectivity, grain direction, seams, wear, and architectural scale.'
    ].join(' '),
  };
});

export const getMaterialById = (id?: string | null) =>
  MATERIAL_SWATCHES.find((material) => material.id === id) || null;
