import { AppState, StyleConfiguration } from '../types';

export const BUILT_IN_STYLES: StyleConfiguration[] = [
  {
    id: 'contemporary-minimalist',
    name: 'Contemporary Minimalist',
    category: 'Residential',
    description: 'Clean lines, neutral palettes, emphasis on light and space',
    previewUrl: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    promptBundle: {
      architectureVocabulary: ['clean lines', 'minimal ornamentation', 'open plan', 'floating planes', 'cubic forms'],
      materialBias: {
        primary: ['white plaster', 'floor-to-ceiling glass', 'polished concrete'],
        secondary: ['warm oak accents', 'matte black steel', 'marble'],
        avoid: ['ornate details', 'clutter', 'heavy textures']
      },
      lightingBias: {
        preferred: ['soft natural light', 'diffused daylight', 'ambient occlusion'],
        avoid: ['harsh direct sun', 'colored lights']
      },
      cameraBias: { preferredAngles: ['eye-level', 'two-point perspective'], preferredFraming: ['rule of thirds', 'balanced'] },
      renderingLanguage: { quality: ['photorealistic', 'archviz', 'unreal engine 5'], atmosphere: ['serene', 'sophisticated', 'airy'], detail: ['crisp edges', 'high fidelity'] }
    }
  },
  {
    id: 'brutalist',
    name: 'Neo-Brutalist',
    category: 'Cultural',
    description: 'Raw concrete, massive forms, honest materiality',
    previewUrl: 'linear-gradient(135deg, #434343 0%, #000000 100%)',
    promptBundle: {
      architectureVocabulary: ['massive forms', 'monolithic', 'geometric', 'raw materiality', 'heavy volumes'],
      materialBias: {
        primary: ['exposed concrete', 'raw timber', 'beton brut'],
        secondary: ['weathered steel', 'glass', 'rough stone'],
        avoid: ['polished surfaces', 'delicate details', 'paint']
      },
      lightingBias: {
        preferred: ['dramatic shadows', 'contrast', 'volumetric fog'],
        avoid: ['flat lighting', 'overexposed']
      },
      cameraBias: { preferredAngles: ['low angle', 'worm-eye'], preferredFraming: ['monumental', 'imposing'] },
      renderingLanguage: { quality: ['cinematic', '8k'], atmosphere: ['imposing', 'atmospheric', 'moody'], detail: ['concrete texture', 'imperfections'] }
    }
  },
  {
    id: 'parametric',
    name: 'Parametric Fluidity',
    category: 'Conceptual',
    description: 'Organic forms, flowing geometries, computational aesthetics',
    previewUrl: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    promptBundle: {
      architectureVocabulary: ['organic curves', 'parametric facade', 'flowing geometry', 'biomimetic', 'voronoi pattern'],
      materialBias: {
        primary: ['white corian', 'curved glass', 'fiberglass'],
        secondary: ['perforated metal', 'fiber composites', 'carbon fiber'],
        avoid: ['rectilinear', 'brick', 'sharp corners']
      },
      lightingBias: {
        preferred: ['soft gradients', 'ambient glow', 'caustics'],
        avoid: ['hard shadows', 'darkness']
      },
      cameraBias: { preferredAngles: ['aerial', 'dynamic', 'curved'], preferredFraming: ['fluid', 'sweeping'] },
      renderingLanguage: { quality: ['high-end render', 'corona render'], atmosphere: ['futuristic', 'ethereal', 'motion'], detail: ['smooth surfaces', 'seamless'] }
    }
  },
  {
    id: 'vernacular',
    name: 'Modern Vernacular',
    category: 'Residential',
    description: 'Local materials, traditional forms, modern interpretation',
    previewUrl: 'linear-gradient(135deg, #e6b980 0%, #eacda3 100%)',
    promptBundle: {
      architectureVocabulary: ['gabled roof', 'local adaptation', 'warm tones', 'tactile', 'pitched roof'],
      materialBias: {
        primary: ['brick', 'stone', 'wood siding'],
        secondary: ['copper', 'slate', 'clay tiles'],
        avoid: ['high-tech', 'plastic', 'chrome']
      },
      lightingBias: {
        preferred: ['golden hour', 'warm interior glow', 'dappled light'],
        avoid: ['cool blue tones', 'neon']
      },
      cameraBias: { preferredAngles: ['eye-level', 'approachable'], preferredFraming: ['contextual', 'landscaped'] },
      renderingLanguage: { quality: ['architectural photography'], atmosphere: ['inviting', 'cozy', 'homely'], detail: ['material richness', 'texture'] }
    }
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian',
    category: 'Residential',
    description: 'Hygge, light woods, functional simplicity, cozy',
    previewUrl: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
    promptBundle: {
      architectureVocabulary: ['simple forms', 'functionalism', 'hygge', 'connection to nature'],
      materialBias: {
        primary: ['pine wood', 'white walls', 'light timber'],
        secondary: ['wool', 'linen', 'glass'],
        avoid: ['dark heavy woods', 'baroque', 'clutter']
      },
      lightingBias: {
        preferred: ['diffused north light', 'bright interiors'],
        avoid: ['dark corners']
      },
      cameraBias: { preferredAngles: ['interior', 'eye-level'], preferredFraming: ['intimate'] },
      renderingLanguage: { quality: ['magazine style'], atmosphere: ['cozy', 'clean', 'bright'], detail: ['soft textures'] }
    }
  },
  {
    id: 'industrial-loft',
    name: 'Industrial Loft',
    category: 'Commercial',
    description: 'Exposed structure, brick, metal, repurposed spaces',
    previewUrl: 'linear-gradient(135deg, #868f96 0%, #596164 100%)',
    promptBundle: {
      architectureVocabulary: ['adaptive reuse', 'open ceilings', 'large windows', 'structural honesty'],
      materialBias: {
        primary: ['exposed brick', 'steel beams', 'polished concrete'],
        secondary: ['ductwork', 'distressed leather', 'black metal'],
        avoid: ['plaster', 'carpet', 'pastels']
      },
      lightingBias: {
        preferred: ['large daylighting', 'edison bulbs'],
        avoid: ['clinical light']
      },
      cameraBias: { preferredAngles: ['wide angle'], preferredFraming: ['spacious'] },
      renderingLanguage: { quality: ['photorealistic'], atmosphere: ['urban', 'raw', 'gritty'], detail: ['rust', 'patina'] }
    }
  },
  {
    id: 'biophilic',
    name: 'Biophilic Design',
    category: 'Sustainable',
    description: 'Integration of nature, living walls, natural light',
    previewUrl: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    promptBundle: {
      architectureVocabulary: ['vertical gardens', 'indoor-outdoor flow', 'organic patterns', 'nature integration'],
      materialBias: {
        primary: ['living walls', 'natural wood', 'stone'],
        secondary: ['water features', 'bamboo', 'glass'],
        avoid: ['synthetic materials', 'sterile surfaces']
      },
      lightingBias: {
        preferred: ['dappled sunlight', 'skylights'],
        avoid: ['artificial glare']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['immersed in green'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['lush', 'restorative', 'fresh'], detail: ['foliage', 'organic textures'] }
    }
  },
  {
    id: 'mid-century',
    name: 'Mid-Century Modern',
    category: 'Residential',
    description: 'Retro-futurism, organic curves, contrasting textures',
    previewUrl: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
    promptBundle: {
      architectureVocabulary: ['cantilevered', 'flat planes', 'integration with landscape', 'retro aesthetic'],
      materialBias: {
        primary: ['teak', 'glass', 'stone fireplace'],
        secondary: ['brass', 'terrazzo', 'pops of color'],
        avoid: ['ornamentation', 'clutter']
      },
      lightingBias: {
        preferred: ['warm sunlight', 'globe lights'],
        avoid: ['cool LEDs']
      },
      cameraBias: { preferredAngles: ['eye-level', 'low angle'], preferredFraming: ['horizontal'] },
      renderingLanguage: { quality: ['cinematic', 'vintage feel'], atmosphere: ['nostalgic', 'stylish'], detail: ['wood grain'] }
    }
  },
  {
    id: 'japanese-zen',
    name: 'Japanese Zen',
    category: 'Cultural',
    description: 'Minimalism, natural materials, shadow and light, serenity',
    previewUrl: 'linear-gradient(135deg, #e6dada 0%, #274046 100%)',
    promptBundle: {
      architectureVocabulary: ['engawa', 'shoji screens', 'minimalist', 'connection to garden'],
      materialBias: {
        primary: ['hinoki wood', 'tatami', 'plaster'],
        secondary: ['river stones', 'paper', 'bamboo'],
        avoid: ['clutter', 'bright plastic']
      },
      lightingBias: {
        preferred: ['diffused soft light', 'shadow play'],
        avoid: ['direct harsh light']
      },
      cameraBias: { preferredAngles: ['low angle', 'interior'], preferredFraming: ['framed views', 'asymmetry'] },
      renderingLanguage: { quality: ['photorealistic'], atmosphere: ['peaceful', 'meditative', 'quiet'], detail: ['texture focus'] }
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'Conceptual',
    description: 'High-tech low-life, neon, dystopian, metallic',
    previewUrl: 'linear-gradient(135deg, #cc2b5e 0%, #753a88 100%)',
    promptBundle: {
      architectureVocabulary: ['megastructure', 'dense urban', 'high-tech', 'dystopian'],
      materialBias: {
        primary: ['metal', 'glass', 'concrete'],
        secondary: ['holograms', 'wires', 'neon signs'],
        avoid: ['wood', 'nature', 'clean']
      },
      lightingBias: {
        preferred: ['neon pink', 'cyan glow', 'rain reflections'],
        avoid: ['daylight', 'warm white']
      },
      cameraBias: { preferredAngles: ['aerial', 'street level'], preferredFraming: ['crowded', 'vertical'] },
      renderingLanguage: { quality: ['digital art', 'octane render'], atmosphere: ['dark', 'gritty', 'electric'], detail: ['rain', 'reflections'] }
    }
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    category: 'Cultural',
    description: 'Form follows function, primary colors, simple geometry',
    previewUrl: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    promptBundle: {
      architectureVocabulary: ['geometric', 'functionalism', 'asymmetry', 'industrial'],
      materialBias: {
        primary: ['white stucco', 'steel', 'glass'],
        secondary: ['primary color accents', 'concrete'],
        avoid: ['decoration', 'ornament']
      },
      lightingBias: {
        preferred: ['clear daylight', 'studio lighting'],
        avoid: ['moody']
      },
      cameraBias: { preferredAngles: ['axonometric', 'front'], preferredFraming: ['balanced'] },
      renderingLanguage: { quality: ['clean'], atmosphere: ['rational', 'modern'], detail: ['sharp lines'] }
    }
  },
  {
    id: 'tropical-modern',
    name: 'Tropical Modernism',
    category: 'Residential',
    description: 'Open air, overhangs, concrete and wood, lush context',
    previewUrl: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    promptBundle: {
      architectureVocabulary: ['large overhangs', 'passive ventilation', 'open spaces', 'breeze blocks'],
      materialBias: {
        primary: ['concrete', 'tropical hardwood', 'stone'],
        secondary: ['water', 'vegetation'],
        avoid: ['glass curtain wall', 'insulation']
      },
      lightingBias: {
        preferred: ['bright sun', 'deep shade'],
        avoid: ['overcast']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['surrounded by nature'] },
      renderingLanguage: { quality: ['vivid'], atmosphere: ['humid', 'lush', 'relaxed'], detail: ['foliage shadows'] }
    }
  },
  {
    id: 'alpine-chalet',
    name: 'Alpine Chalet',
    category: 'Residential',
    description: 'Modern mountain home, snow, timber, warmth',
    previewUrl: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    promptBundle: {
      architectureVocabulary: ['steep roof', 'panoramic windows', 'mountain retreat'],
      materialBias: {
        primary: ['timber cladding', 'slate', 'stone base'],
        secondary: ['glass', 'fur', 'fire'],
        avoid: ['concrete block', 'palm trees']
      },
      lightingBias: {
        preferred: ['warm interior light', 'blue hour snow'],
        avoid: ['green cast']
      },
      cameraBias: { preferredAngles: ['exterior'], preferredFraming: ['landscape context'] },
      renderingLanguage: { quality: ['crisp'], atmosphere: ['cold outside warm inside', 'majestic'], detail: ['snow texture'] }
    }
  },
  {
    id: 'desert-modern',
    name: 'Desert Modernism',
    category: 'Residential',
    description: 'Blending with arid landscape, earth tones, horizontal lines',
    previewUrl: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
    promptBundle: {
      architectureVocabulary: ['horizontal planes', 'earth shelter', 'arid landscape', 'shadow patterns'],
      materialBias: {
        primary: ['rammed earth', 'corten steel', 'sandstone'],
        secondary: ['glass', 'succulents'],
        avoid: ['green grass', 'white plastic']
      },
      lightingBias: {
        preferred: ['hard sunlight', 'long shadows'],
        avoid: ['diffused mist']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['wide landscape'] },
      renderingLanguage: { quality: ['high contrast'], atmosphere: ['dry', 'hot', 'silent'], detail: ['rock textures'] }
    }
  },
  {
    id: 'art-deco',
    name: 'Art Deco Revival',
    category: 'Cultural',
    description: 'Geometric patterns, luxury materials, verticality, gold',
    previewUrl: 'linear-gradient(135deg, #c79081 0%, #dfa579 100%)',
    promptBundle: {
      architectureVocabulary: ['stepped setbacks', 'geometric ornamentation', 'verticality', 'streamline'],
      materialBias: {
        primary: ['limestone', 'black marble', 'gold leaf'],
        secondary: ['brass', 'velvet', 'glossy lacquer'],
        avoid: ['minimalism', 'rustic']
      },
      lightingBias: {
        preferred: ['dramatic up-lighting', 'warm glow'],
        avoid: ['flat fluorescent']
      },
      cameraBias: { preferredAngles: ['low angle', 'symmetrical'], preferredFraming: ['imposing'] },
      renderingLanguage: { quality: ['luxurious'], atmosphere: ['glamorous', 'opulent'], detail: ['intricate patterns'] }
    }
  },
  {
    id: 'gothic-revival',
    name: 'Modern Gothic',
    category: 'Cultural',
    description: 'Verticality, pointed arches, stone, dramatic light, reimagined',
    previewUrl: 'linear-gradient(135deg, #20002c 0%, #cbb4d4 100%)',
    promptBundle: {
      architectureVocabulary: ['pointed arches', 'ribbed vaults', 'flying buttresses', 'verticality'],
      materialBias: {
        primary: ['dark stone', 'stained glass', 'iron'],
        secondary: ['glass', 'concrete'],
        avoid: ['horizontal lines', 'white plaster']
      },
      lightingBias: {
        preferred: ['god rays', 'mysterious shadows'],
        avoid: ['bright even light']
      },
      cameraBias: { preferredAngles: ['looking up', 'interior nave'], preferredFraming: ['vertical'] },
      renderingLanguage: { quality: ['ethereal'], atmosphere: ['mysterious', 'sublime', 'epic'], detail: ['intricate stone'] }
    }
  },
  {
    id: 'high-tech',
    name: 'High-Tech',
    category: 'Commercial',
    description: 'Structural expression, transparency, lightweight, engineered',
    previewUrl: 'linear-gradient(135deg, #acb6e5 0%, #86fde8 100%)',
    promptBundle: {
      architectureVocabulary: ['exposed structure', 'tension cables', 'transparency', 'prefabrication'],
      materialBias: {
        primary: ['steel', 'glass', 'aluminum'],
        secondary: ['chrome', 'plastic'],
        avoid: ['heavy masonry', 'wood']
      },
      lightingBias: {
        preferred: ['cool daylight', 'technical lighting'],
        avoid: ['warm cozy']
      },
      cameraBias: { preferredAngles: ['worm-eye', 'detail'], preferredFraming: ['dynamic'] },
      renderingLanguage: { quality: ['sharp'], atmosphere: ['precise', 'engineered', 'futuristic'], detail: ['connections', 'bolts'] }
    }
  },
  {
    id: 'eco-brutalism',
    name: 'Eco-Brutalism',
    category: 'Sustainable',
    description: 'Concrete structures reclaimed by nature, apocalyptic green',
    previewUrl: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
    promptBundle: {
      architectureVocabulary: ['massive concrete', 'overgrown vegetation', 'ruins aesthetic', 'reclaimed'],
      materialBias: {
        primary: ['weathered concrete', 'moss', 'vines'],
        secondary: ['rust', 'water'],
        avoid: ['pristine surfaces', 'glass']
      },
      lightingBias: {
        preferred: ['overcast', 'filtered light'],
        avoid: ['bright sunny']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['nature dominant'] },
      renderingLanguage: { quality: ['cinematic', 'unreal engine'], atmosphere: ['melancholic', 'peaceful', 'post-apocalyptic'], detail: ['weathering', 'plants'] }
    }
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean',
    category: 'Residential',
    description: 'White stucco, terracotta, arches, sunny, seaside',
    previewUrl: 'linear-gradient(135deg, #2980b9 0%, #6dd5fa 100%, #ffffff 100%)',
    promptBundle: {
      architectureVocabulary: ['arches', 'courtyards', 'tiled roofs', 'stucco walls'],
      materialBias: {
        primary: ['white plaster', 'terracotta tiles', 'stone'],
        secondary: ['wrought iron', 'mosaic', 'wood beams'],
        avoid: ['steel', 'exposed concrete']
      },
      lightingBias: {
        preferred: ['bright sunlight', 'blue shadows'],
        avoid: ['grey skies']
      },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['inviting'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['relaxed', 'sunny', 'vacation'], detail: ['texture'] }
    }
  },
  {
    id: 'solarpunk',
    name: 'Solarpunk',
    category: 'Sustainable',
    description: 'Optimistic future, technology + nature, sustainable, Art Nouveau influences',
    previewUrl: 'linear-gradient(135deg, #a8ff78 0%, #78ffd6 100%)',
    promptBundle: {
      architectureVocabulary: ['organic shapes', 'stained glass', 'solar panels', 'vertical farming', 'art nouveau curves'],
      materialBias: {
        primary: ['glass', 'wood', 'ceramics'],
        secondary: ['plants', 'solar tech'],
        avoid: ['dystopian dirt', 'brutalism']
      },
      lightingBias: {
        preferred: ['bright sunny', 'shimmering'],
        avoid: ['darkness']
      },
      cameraBias: { preferredAngles: ['wide'], preferredFraming: ['utopian'] },
      renderingLanguage: { quality: ['illustrative realism'], atmosphere: ['optimistic', 'hopeful', 'bright'], detail: ['plants', 'tech'] }
    }
  },
  {
    id: 'deconstructivism',
    name: 'Deconstructivism',
    category: 'Conceptual',
    description: 'Fragmentation, non-rectilinear shapes, distorted chaos',
    previewUrl: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    promptBundle: {
      architectureVocabulary: ['fragmented', 'distorted', 'non-linear', 'controlled chaos'],
      materialBias: {
        primary: ['titanium', 'steel', 'glass'],
        secondary: ['concrete', 'mesh'],
        avoid: ['symmetry', 'traditional forms']
      },
      lightingBias: {
        preferred: ['dynamic', 'high contrast'],
        avoid: ['flat']
      },
      cameraBias: { preferredAngles: ['dynamic', 'tilted'], preferredFraming: ['disorienting'] },
      renderingLanguage: { quality: ['abstract'], atmosphere: ['provocative', 'intense'], detail: ['sharp angles'] }
    }
  }
];

export function generatePrompt(state: AppState): string {
  const style = BUILT_IN_STYLES.find(s => s.id === state.activeStyleId) || BUILT_IN_STYLES[0];
  const { geometry, camera, lighting, materials, context, workflow, mode } = state;
  const parts: string[] = [];

  // --- Helper to add weights ---
  const add = (text: string, weight?: number) => {
    if (weight && weight !== 1.0) parts.push(`(${text}:${weight})`);
    else parts.push(text);
  };

  // --- MODE SPECIFIC HEADER ---
  switch (mode) {
    case 'masterplan':
      add(`Masterplan visualization, ${workflow.mpPlanType} scale`);
      add(`${workflow.mpOutputType} style`);
      if (workflow.mpContext.loadRoads) add("showing infrastructure network");
      if (workflow.mpContext.loadWater) add("integrating water bodies");
      // Zoning Colors
      const activeZones = workflow.mpZones.filter(z => z.selected).map(z => z.name).join(', ');
      if (activeZones) add(`featuring zones: ${activeZones}`);
      break;

    case 'render-cad':
      add(`Architectural ${workflow.cadDrawingType}`);
      add(`Scale ${workflow.cadScale}`);
      add("precise linework, technical drawing");
      if (workflow.cadDrawingType === 'plan') add("floor plan view, orthographic");
      break;

    case 'exploded':
      add("Axonometric exploded view");
      add("architectural assembly diagram");
      add("separated components floating");
      if (workflow.explodedStyle.render === 'tech') add("technical blueprint style, white lines on blue");
      break;

    case 'section':
      add(`Architectural section cut, ${workflow.sectionCut.type} cut`);
      if (workflow.sectionStyle.poche === 'black') add("solid black poche");
      add("detailed interior section");
      break;

    case 'visual-edit':
      add(`Image editing: ${workflow.activeTool} operation`);
      add(`Selection mode: ${workflow.visualSelection.mode}`);
      break;

    default: // render-3d, render-sketch, etc.
      add(`Architecture featuring ${style.promptBundle.architectureVocabulary.join(', ')}`);
      break;
  }

  // --- CORE ATTRIBUTES (Applied to all visual modes) ---
  if (mode !== 'video' && mode !== 'upscale') {
    // 1. Materials
    if (mode === 'render-cad') {
       add('monochrome, technical colors');
    } else {
       add(`Materials: ${style.promptBundle.materialBias.primary.join(', ')}`);
       if (materials.concreteEmphasis > 60) add('emphasize concrete texture', 1.2);
       if (materials.glassEmphasis > 60) add('emphasize glass transparency', 1.2);
    }

    // 2. Lighting
    if (mode === 'masterplan' && workflow.mpOutputType === 'diagrammatic') {
       add('flat even lighting, no shadows');
    } else {
       add(`${lighting.timeOfDay} lighting`);
       add(`Sun altitude ${lighting.sunAltitude} degrees`);
       if (lighting.weather !== 'clear') add(`${lighting.weather} weather`);
    }

    // 3. Camera
    if (mode === 'render-3d' || mode === 'render-sketch') {
       add(`${camera.viewType} view`);
       if (camera.projection === 'axonometric') add('isometric projection');
    }
  }

  // --- MODE SPECIFIC TAIL ---
  switch (mode) {
    case 'video':
      add(`Cinematic camera movement: ${workflow.videoMotion.type}`);
      if (workflow.videoMode === 'path') add('smooth flythrough path');
      add('video sequence, motion blur');
      break;
    
    case 'img-to-cad':
      add('high contrast, edge detection');
      add('black and white vector lines');
      break;
  }

  // --- GLOBAL QUALIFIERS ---
  if (mode !== 'render-cad' && mode !== 'img-to-cad') {
     add(style.promptBundle.renderingLanguage.quality.join(', '));
     add('8k resolution');
  }

  // --- NEGATIVE INFLUENCES (Implicit) ---
  if (geometry.suppressHallucinations) add('no artifacts, no blurry details', 1.2);
  
  return parts.join(', ');
}