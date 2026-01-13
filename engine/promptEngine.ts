
import { AppState, StyleConfiguration } from '../types';

export const BUILT_IN_STYLES: StyleConfiguration[] = [
  // --- EXISTING STYLES (14) ---
  {
    id: 'contemporary-minimalist',
    name: 'Contemporary Minimalist',
    category: 'Residential',
    description: 'Clean lines, neutral palettes, emphasis on light and space',
    previewUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1533630764724-5c9a633a6967?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1595515106967-14348984f548?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1623631484762-b9b53239a3f2?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1522771759335-5028489708b7?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1515630278258-407f66498911?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1589923188900-85dae5233271?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1518732679287-35359b32975e?auto=format&fit=crop&w=600&q=80',
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
    previewUrl: 'https://images.unsplash.com/photo-1523677462372-748980892095?auto=format&fit=crop&w=600&q=80',
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
      renderingLanguage: { quality: ['high contrast'], atmosphere: ['dry', 'hot', 'silent'], detail: ['sand grains', 'heat haze'] }
    }
  },
  // --- NEW STYLES (40) ---
  {
    id: 'art-deco',
    name: 'Art Deco',
    category: 'Historical',
    description: 'Geometric patterns, bold vertical lines, decorative ornamentation',
    previewUrl: 'https://images.unsplash.com/photo-1550417761-e945c997cefa?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['geometric patterns', 'vertical emphasis', 'ziggurat forms', 'decorative', 'streamlined'],
      materialBias: { primary: ['limestone', 'chrome', 'glass block'], secondary: ['brass', 'terrazzo'], avoid: ['minimalism'] },
      lightingBias: { preferred: ['dramatic up-lighting', 'neon accents'], avoid: ['soft diffuse'] },
      cameraBias: { preferredAngles: ['low angle', 'front'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['cinematic'], atmosphere: ['glamorous', 'bold'], detail: ['ornamental'] }
    }
  },
  {
    id: 'beaux-arts',
    name: 'Beaux-Arts',
    category: 'Historical',
    description: 'Grandeur, symmetry, elaborate ornamentation, classical roots',
    previewUrl: 'https://images.unsplash.com/photo-1565060169192-3e2d19459529?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['symmetry', 'columns', 'cornices', 'grand entrance', 'sculptural details'],
      materialBias: { primary: ['limestone', 'marble', 'granite'], secondary: ['bronze'], avoid: ['exposed steel'] },
      lightingBias: { preferred: ['natural daylight', 'chandelier glow'], avoid: ['neon'] },
      cameraBias: { preferredAngles: ['eye-level', 'front'], preferredFraming: ['centered'] },
      renderingLanguage: { quality: ['detailed'], atmosphere: ['monumental', 'formal'], detail: ['carved stone'] }
    }
  },
  {
    id: 'gothic-revival',
    name: 'Gothic Revival',
    category: 'Historical',
    description: 'Pointed arches, steep gables, intricate tracery',
    previewUrl: 'https://images.unsplash.com/photo-1548625361-9878201a052c?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['pointed arches', 'steep roofs', 'tracery', 'verticality', 'spires'],
      materialBias: { primary: ['stone', 'brick'], secondary: ['stained glass', 'slate'], avoid: ['concrete'] },
      lightingBias: { preferred: ['mysterious', 'shadowy'], avoid: ['bright flat light'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['vertical'] },
      renderingLanguage: { quality: ['dramatic'], atmosphere: ['imposing', 'historic'], detail: ['intricate'] }
    }
  },
  {
    id: 'victorian',
    name: 'Victorian',
    category: 'Historical',
    description: 'Asymmetrical, decorative trim, steep roofs, bay windows',
    previewUrl: 'https://images.unsplash.com/photo-1597552945209-173de71ce74d?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['asymmetry', 'decorative trim', 'turrets', 'bay windows', 'porches'],
      materialBias: { primary: ['painted wood', 'brick'], secondary: ['shingles', 'stained glass'], avoid: ['glass curtain wall'] },
      lightingBias: { preferred: ['warm', 'inviting'], avoid: ['cool industrial'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['contextual'] },
      renderingLanguage: { quality: ['nostalgic'], atmosphere: ['charming', 'detailed'], detail: ['ornate'] }
    }
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean Revival',
    category: 'Residential',
    description: 'Stucco walls, red tile roofs, arched windows',
    previewUrl: 'https://images.unsplash.com/photo-1523456397395-88849646487e?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['arches', 'courtyards', 'red tile roof', 'balconies'],
      materialBias: { primary: ['stucco', 'terracotta'], secondary: ['wrought iron', 'wood'], avoid: ['siding'] },
      lightingBias: { preferred: ['warm sun', 'dappled shade'], avoid: ['gloomy'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['garden context'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['sunny', 'relaxed'], detail: ['textured'] }
    }
  },
  {
    id: 'tudor',
    name: 'Tudor Revival',
    category: 'Residential',
    description: 'Decorative half-timbering, steep gables, masonry chimneys',
    previewUrl: 'https://images.unsplash.com/photo-1596489886364-4e788c1c4f51?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['half-timbering', 'steep gables', 'prominent chimneys', 'leaded glass'],
      materialBias: { primary: ['brick', 'stucco', 'wood'], secondary: ['stone'], avoid: ['modern materials'] },
      lightingBias: { preferred: ['warm', 'cozy'], avoid: ['harsh'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['picturesque'] },
      renderingLanguage: { quality: ['classic'], atmosphere: ['fairytale', 'historic'], detail: ['craftsmanship'] }
    }
  },
  {
    id: 'craftsman',
    name: 'Craftsman',
    category: 'Residential',
    description: 'Low-pitched roofs, exposed beams, front porches, natural materials',
    previewUrl: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['low-pitched roof', 'exposed rafters', 'tapered columns', 'porch'],
      materialBias: { primary: ['wood', 'stone'], secondary: ['brick', 'shingle'], avoid: ['steel'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['welcoming'] },
      renderingLanguage: { quality: ['warm'], atmosphere: ['homely', 'natural'], detail: ['joinery'] }
    }
  },
  {
    id: 'prairie',
    name: 'Prairie Style',
    category: 'Residential',
    description: 'Horizontal lines, flat or hipped roofs, integration with landscape',
    previewUrl: 'https://images.unsplash.com/photo-1625604107572-132d0f509e50?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['horizontal lines', 'cantilevers', 'open plan', 'organic architecture'],
      materialBias: { primary: ['brick', 'wood'], secondary: ['art glass'], avoid: ['verticality'] },
      lightingBias: { preferred: ['natural'], avoid: ['artificial'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['organic'], atmosphere: ['grounded', 'peaceful'], detail: ['linear'] }
    }
  },
  {
    id: 'international',
    name: 'International Style',
    category: 'Modern',
    description: 'Rectilinear forms, light surfaces, open interior spaces, lack of ornamentation',
    previewUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['rectilinear', 'volume over mass', 'regularity', 'no ornament'],
      materialBias: { primary: ['glass', 'steel', 'concrete'], secondary: ['white render'], avoid: ['texture'] },
      lightingBias: { preferred: ['even'], avoid: ['dramatic'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['objective'] },
      renderingLanguage: { quality: ['clean'], atmosphere: ['rational', 'efficient'], detail: ['precise'] }
    }
  },
  {
    id: 'deconstructivism',
    name: 'Deconstructivism',
    category: 'Conceptual',
    description: 'Fragmentation, non-rectilinear shapes, manipulated surface skin',
    previewUrl: 'https://images.unsplash.com/photo-1525936451670-3490795c644d?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['fragmentation', 'non-linear', 'distortion', 'dislocation'],
      materialBias: { primary: ['titanium', 'steel', 'glass'], secondary: ['concrete'], avoid: ['symmetry'] },
      lightingBias: { preferred: ['dynamic'], avoid: ['flat'] },
      cameraBias: { preferredAngles: ['dynamic'], preferredFraming: ['unconventional'] },
      renderingLanguage: { quality: ['artistic'], atmosphere: ['chaotic', 'innovative'], detail: ['complex'] }
    }
  },
  {
    id: 'high-tech',
    name: 'High-Tech',
    category: 'Modern',
    description: 'Exposed structure and services, industrial materials',
    previewUrl: 'https://images.unsplash.com/photo-1506456073715-9c8397a6e118?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['exposed structure', 'functionalism', 'industrial aesthetic', 'flexibility'],
      materialBias: { primary: ['steel', 'glass', 'aluminum'], secondary: ['bright colors'], avoid: ['masonry'] },
      lightingBias: { preferred: ['technical'], avoid: ['soft'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['structural'] },
      renderingLanguage: { quality: ['precise'], atmosphere: ['engineered', 'advanced'], detail: ['mechanical'] }
    }
  },
  {
    id: 'postmodern',
    name: 'Postmodernism',
    category: 'Modern',
    description: 'Wit, ornament, reference to history, colorful',
    previewUrl: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['historical reference', 'color', 'playfulness', 'irony'],
      materialBias: { primary: ['stucco', 'stone veneer'], secondary: ['tile'], avoid: ['pure minimalism'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['pop'] },
      renderingLanguage: { quality: ['graphic'], atmosphere: ['playful', 'eclectic'], detail: ['stylized'] }
    }
  },
  {
    id: 'metabolism',
    name: 'Metabolism',
    category: 'Conceptual',
    description: 'Modular, biological growth, adaptable structures',
    previewUrl: 'https://images.unsplash.com/photo-1552553748-0387d5dc7498?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['capsules', 'modularity', 'growth', 'megastructure'],
      materialBias: { primary: ['concrete', 'pre-fab units'], secondary: ['steel'], avoid: ['traditional'] },
      lightingBias: { preferred: ['natural'], avoid: ['artificial'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['repetitive'] },
      renderingLanguage: { quality: ['utopian'], atmosphere: ['futuristic', 'organic'], detail: ['cellular'] }
    }
  },
  {
    id: 'eco-brutalism',
    name: 'Eco-Brutalism',
    category: 'Sustainable',
    description: 'Raw concrete structures integrated with heavy vegetation',
    previewUrl: 'https://images.unsplash.com/photo-1599809275372-b7f58957816e?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['concrete', 'vegetation', 'overgrown', 'monolithic'],
      materialBias: { primary: ['concrete', 'plants'], secondary: ['water'], avoid: ['plastic'] },
      lightingBias: { preferred: ['dappled'], avoid: ['sterile'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['nature-dominant'] },
      renderingLanguage: { quality: ['atmospheric'], atmosphere: ['post-apocalyptic', 'serene'], detail: ['weathering'] }
    }
  },
  {
    id: 'tiny-house',
    name: 'Tiny House',
    category: 'Residential',
    description: 'Compact, efficient living, clever storage, mobile',
    previewUrl: 'https://images.unsplash.com/photo-1512915990740-8b150937c541?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['compact', 'efficient', 'loft', 'wheels'],
      materialBias: { primary: ['wood'], secondary: ['metal'], avoid: ['excess'] },
      lightingBias: { preferred: ['cozy'], avoid: ['cold'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['intimate'] },
      renderingLanguage: { quality: ['charming'], atmosphere: ['simple', 'free'], detail: ['clever'] }
    }
  },
  {
    id: 'shipping-container',
    name: 'Container Arch',
    category: 'Sustainable',
    description: 'Modular structures built from repurposed shipping containers',
    previewUrl: 'https://images.unsplash.com/photo-1529307474898-eeb5a539b252?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['modular', 'industrial', 'corrugated', 'stacked'],
      materialBias: { primary: ['metal', 'glass'], secondary: ['wood deck'], avoid: ['stone'] },
      lightingBias: { preferred: ['natural'], avoid: ['dim'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['geometric'] },
      renderingLanguage: { quality: ['modern'], atmosphere: ['innovative', 'upcycled'], detail: ['corrugation'] }
    }
  },
  {
    id: 'earthship',
    name: 'Earthship',
    category: 'Sustainable',
    description: 'Earth-bermed, recycled materials, off-grid',
    previewUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['earth-bermed', 'passive solar', 'recycled', 'organic'],
      materialBias: { primary: ['tires', 'adobe', 'glass bottles'], secondary: ['wood'], avoid: ['industrial'] },
      lightingBias: { preferred: ['natural'], avoid: ['artificial'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['organic'], atmosphere: ['sustainable', 'rugged'], detail: ['handmade'] }
    }
  },
  {
    id: 'bamboo',
    name: 'Bamboo Architecture',
    category: 'Sustainable',
    description: 'Organic forms, sustainable material, open structures',
    previewUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['organic', 'curved', 'open air', 'sustainable'],
      materialBias: { primary: ['bamboo'], secondary: ['thatch'], avoid: ['concrete'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['upward'] },
      renderingLanguage: { quality: ['natural'], atmosphere: ['tropical', 'serene'], detail: ['joints'] }
    }
  },
  {
    id: 'nordic-noir',
    name: 'Nordic Noir',
    category: 'Residential',
    description: 'Black timber, minimalist, moody, integrated with nature',
    previewUrl: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['minimalist', 'dark exterior', 'cozy interior', 'nature'],
      materialBias: { primary: ['charred wood', 'glass'], secondary: ['concrete'], avoid: ['color'] },
      lightingBias: { preferred: ['moody'], avoid: ['bright'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['isolated'] },
      renderingLanguage: { quality: ['cinematic'], atmosphere: ['quiet', 'mysterious'], detail: ['texture'] }
    }
  },
  {
    id: 'a-frame',
    name: 'A-Frame',
    category: 'Residential',
    description: 'Triangular shape, steep roof, large windows',
    previewUrl: 'https://images.unsplash.com/photo-1527030280862-64139fba04ca?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['triangular', 'steep roof', 'open gable', 'deck'],
      materialBias: { primary: ['wood', 'glass'], secondary: ['metal roof'], avoid: ['flat roof'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['centered'] },
      renderingLanguage: { quality: ['cozy'], atmosphere: ['cabin', 'retreat'], detail: ['wood'] }
    }
  },
  {
    id: 'geodesic',
    name: 'Geodesic Dome',
    category: 'Conceptual',
    description: 'Spherical lattice shell, efficient, futuristic',
    previewUrl: 'https://images.unsplash.com/photo-1532053177659-197e743a6d71?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['spherical', 'triangular lattice', 'efficient', 'dome'],
      materialBias: { primary: ['glass', 'steel'], secondary: ['ETFE'], avoid: ['brick'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['geometric'] },
      renderingLanguage: { quality: ['tech'], atmosphere: ['futuristic', 'scientific'], detail: ['structure'] }
    }
  },
  {
    id: 'parametric-timber',
    name: 'Parametric Timber',
    category: 'Conceptual',
    description: 'Fluid wooden forms, computational design, warm aesthetic',
    previewUrl: 'https://images.unsplash.com/photo-1533552277498-8547b31c513e?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['fluid', 'computational', 'layered', 'organic'],
      materialBias: { primary: ['wood'], secondary: ['glass'], avoid: ['block'] },
      lightingBias: { preferred: ['warm'], avoid: ['cold'] },
      cameraBias: { preferredAngles: ['dynamic'], preferredFraming: ['flowing'] },
      renderingLanguage: { quality: ['high-end'], atmosphere: ['innovative', 'natural'], detail: ['grain'] }
    }
  },
  {
    id: 'floating-home',
    name: 'Floating Arch',
    category: 'Residential',
    description: 'Structures on water, buoyant, connection to aquatic environment',
    previewUrl: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['floating', 'buoyant', 'deck', 'water view'],
      materialBias: { primary: ['wood', 'composite'], secondary: ['glass'], avoid: ['heavy stone'] },
      lightingBias: { preferred: ['reflected'], avoid: ['dull'] },
      cameraBias: { preferredAngles: ['water-level'], preferredFraming: ['reflection'] },
      renderingLanguage: { quality: ['serene'], atmosphere: ['peaceful', 'aquatic'], detail: ['reflection'] }
    }
  },
  {
    id: 'mars-habitat',
    name: 'Mars Habitat',
    category: 'Conceptual',
    description: '3D printed regolith, protective shells, red planet context',
    previewUrl: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['3D printed', 'protective', 'dome', 'pressurized'],
      materialBias: { primary: ['regolith', 'composite'], secondary: ['glass'], avoid: ['wood'] },
      lightingBias: { preferred: ['artificial', 'reddish'], avoid: ['blue sky'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['sci-fi'], atmosphere: ['hostile', 'advanced'], detail: ['texture'] }
    }
  },
  {
    id: 'solarpunk',
    name: 'Solarpunk',
    category: 'Conceptual',
    description: 'Green technology, art nouveau influence, sustainable utopia',
    previewUrl: 'https://images.unsplash.com/photo-1629806346740-d99f2c253676?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['green tech', 'organic curves', 'stained glass', 'solar'],
      materialBias: { primary: ['glass', 'plants', 'wood'], secondary: ['solar panels'], avoid: ['grunge'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['aerial'], preferredFraming: ['lush'] },
      renderingLanguage: { quality: ['optimistic'], atmosphere: ['utopian', 'vibrant'], detail: ['vegetation'] }
    }
  },
  {
    id: 'steampunk',
    name: 'Steampunk',
    category: 'Conceptual',
    description: 'Victorian sci-fi, brass, steam, gears, industrial',
    previewUrl: 'https://images.unsplash.com/photo-1549487779-130c01a55f58?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['industrial', 'victorian', 'gears', 'pipes'],
      materialBias: { primary: ['brass', 'copper', 'iron'], secondary: ['brick'], avoid: ['plastic'] },
      lightingBias: { preferred: ['warm', 'hazy'], avoid: ['clean'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['detailed'] },
      renderingLanguage: { quality: ['gritty'], atmosphere: ['retro-future', 'mechanical'], detail: ['pipes'] }
    }
  },
  {
    id: 'islamic-modern',
    name: 'Islamic Modern',
    category: 'Cultural',
    description: 'Geometric patterns, mashrabiya, light filtration, courtyards',
    previewUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['geometry', 'pattern', 'screening', 'courtyard'],
      materialBias: { primary: ['stone', 'screen'], secondary: ['water'], avoid: ['plain'] },
      lightingBias: { preferred: ['filtered', 'shadow patterns'], avoid: ['flat'] },
      cameraBias: { preferredAngles: ['interior'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['intricate'], atmosphere: ['spiritual', 'cool'], detail: ['pattern'] }
    }
  },
  {
    id: 'chinese-modern',
    name: 'Chinese Modern',
    category: 'Cultural',
    description: 'Traditional rooflines, wooden brackets, courtyard layout',
    previewUrl: 'https://images.unsplash.com/photo-1518136247453-74e7b5095e52?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['sweeping roof', 'brackets', 'courtyard', 'symmetry'],
      materialBias: { primary: ['wood', 'tile'], secondary: ['stone'], avoid: ['concrete block'] },
      lightingBias: { preferred: ['soft'], avoid: ['harsh'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['balanced'] },
      renderingLanguage: { quality: ['elegant'], atmosphere: ['peaceful', 'historic'], detail: ['woodwork'] }
    }
  },
  {
    id: 'wabi-sabi',
    name: 'Wabi-Sabi',
    category: 'Cultural',
    description: 'Beauty in imperfection, aged materials, simplicity',
    previewUrl: 'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['imperfection', 'simplicity', 'natural aging', 'rough'],
      materialBias: { primary: ['aged wood', 'rough plaster'], secondary: ['stone'], avoid: ['shiny'] },
      lightingBias: { preferred: ['shadowy'], avoid: ['bright'] },
      cameraBias: { preferredAngles: ['interior'], preferredFraming: ['detail'] },
      renderingLanguage: { quality: ['textured'], atmosphere: ['quiet', 'melancholy'], detail: ['patina'] }
    }
  },
  {
    id: 'memphis',
    name: 'Memphis Group',
    category: 'Modern',
    description: 'Colorful, geometric, pop-art influence, playful',
    previewUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['geometric', 'colorful', 'pattern', 'asymmetry'],
      materialBias: { primary: ['laminate', 'terrazzo'], secondary: ['plastic'], avoid: ['natural'] },
      lightingBias: { preferred: ['bright'], avoid: ['moody'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['graphic'] },
      renderingLanguage: { quality: ['vibrant'], atmosphere: ['fun', 'bold'], detail: ['pattern'] }
    }
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    category: 'Historical',
    description: 'Whiplash curves, organic motifs, decorative ironwork',
    previewUrl: 'https://images.unsplash.com/photo-1558237305-6f981dd90c37?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['curves', 'organic lines', 'floral motifs', 'asymmetry'],
      materialBias: { primary: ['stone', 'iron', 'glass'], secondary: ['ceramic'], avoid: ['rectilinear'] },
      lightingBias: { preferred: ['soft'], avoid: ['harsh'] },
      cameraBias: { preferredAngles: ['low angle'], preferredFraming: ['fluid'] },
      renderingLanguage: { quality: ['elegant'], atmosphere: ['romantic', 'flowery'], detail: ['curve'] }
    }
  },
  {
    id: 'neoclassical',
    name: 'Neoclassical',
    category: 'Historical',
    description: 'Columns, pediments, symmetry, grand scale',
    previewUrl: 'https://images.unsplash.com/photo-1524330687720-4c311c1d8825?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['columns', 'pediment', 'symmetry', 'dome'],
      materialBias: { primary: ['stone', 'marble'], secondary: ['white paint'], avoid: ['wood'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['formal'], atmosphere: ['imposing', 'stately'], detail: ['order'] }
    }
  },
  {
    id: 'colonial',
    name: 'Colonial Revival',
    category: 'Residential',
    description: 'Symmetrical facade, shutters, gabled roof, brick or siding',
    previewUrl: 'https://images.unsplash.com/photo-1605276373954-0c4a0dac5b12?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['symmetry', 'shutters', 'dormers', 'columns'],
      materialBias: { primary: ['brick', 'siding'], secondary: ['shingles'], avoid: ['modern'] },
      lightingBias: { preferred: ['daylight'], avoid: ['neon'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['centered'] },
      renderingLanguage: { quality: ['classic'], atmosphere: ['traditional', 'stately'], detail: ['trim'] }
    }
  },
  {
    id: 'ranch',
    name: 'Ranch Style',
    category: 'Residential',
    description: 'Single story, long facade, low roof, open layout',
    previewUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['single story', 'horizontal', 'low roof', 'patio'],
      materialBias: { primary: ['brick', 'wood'], secondary: ['glass'], avoid: ['vertical'] },
      lightingBias: { preferred: ['sunny'], avoid: ['gloomy'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['wide'] },
      renderingLanguage: { quality: ['suburban'], atmosphere: ['relaxed', 'spacious'], detail: ['horizontal'] }
    }
  },
  {
    id: 'swiss-chalet',
    name: 'Swiss Chalet',
    category: 'Residential',
    description: 'Wide eaves, decorative carving, balconies, timber',
    previewUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['wide eaves', 'balconies', 'decorative carving', 'gables'],
      materialBias: { primary: ['wood'], secondary: ['stone'], avoid: ['concrete'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['scenic'] },
      renderingLanguage: { quality: ['picturesque'], atmosphere: ['alpine', 'charming'], detail: ['carving'] }
    }
  },
  {
    id: 'pueblo',
    name: 'Pueblo Revival',
    category: 'Residential',
    description: 'Adobe walls, rounded edges, flat roofs, vigas',
    previewUrl: 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['adobe', 'rounded edges', 'flat roof', 'vigas'],
      materialBias: { primary: ['stucco', 'wood'], secondary: ['tile'], avoid: ['siding'] },
      lightingBias: { preferred: ['sunlight'], avoid: ['cloudy'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['landscape'] },
      renderingLanguage: { quality: ['warm'], atmosphere: ['desert', 'soft'], detail: ['texture'] }
    }
  },
  {
    id: 'greek-revival',
    name: 'Greek Revival',
    category: 'Historical',
    description: 'Temple front, columns, pediment, white painted',
    previewUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3dab?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['temple front', 'columns', 'pediment', 'white'],
      materialBias: { primary: ['wood', 'stucco'], secondary: ['stone'], avoid: ['brick'] },
      lightingBias: { preferred: ['bright'], avoid: ['dark'] },
      cameraBias: { preferredAngles: ['front'], preferredFraming: ['symmetrical'] },
      renderingLanguage: { quality: ['stately'], atmosphere: ['historic', 'formal'], detail: ['columns'] }
    }
  },
  {
    id: 'italianate',
    name: 'Italianate',
    category: 'Historical',
    description: 'Low-pitched roofs, wide eaves with brackets, tall windows',
    previewUrl: 'https://images.unsplash.com/photo-1572953109213-3be62398eb95?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['brackets', 'tall windows', 'low roof', 'cupola'],
      materialBias: { primary: ['brick', 'stucco', 'wood'], secondary: ['iron'], avoid: ['glass'] },
      lightingBias: { preferred: ['warm'], avoid: ['cool'] },
      cameraBias: { preferredAngles: ['eye-level'], preferredFraming: ['vertical'] },
      renderingLanguage: { quality: ['ornate'], atmosphere: ['elegant', 'tall'], detail: ['brackets'] }
    }
  },
  {
    id: 'futuristic-organic',
    name: 'Futuristic Organic',
    category: 'Conceptual',
    description: 'White curves, seamless forms, Zaha Hadid influence',
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['fluid', 'seamless', 'curved', 'white'],
      materialBias: { primary: ['corian', 'fiberglass', 'concrete'], secondary: ['glass'], avoid: ['brick'] },
      lightingBias: { preferred: ['diffused'], avoid: ['hard shadows'] },
      cameraBias: { preferredAngles: ['dynamic'], preferredFraming: ['flowing'] },
      renderingLanguage: { quality: ['pristine'], atmosphere: ['future', 'clean'], detail: ['smooth'] }
    }
  },
  {
    id: 'cyber-organic',
    name: 'Cyber-Organic',
    category: 'Conceptual',
    description: 'Integration of technology and biological forms',
    previewUrl: 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80',
    promptBundle: {
      architectureVocabulary: ['tech', 'biology', 'integrated', 'complex'],
      materialBias: { primary: ['bioplastic', 'metal'], secondary: ['light'], avoid: ['traditional'] },
      lightingBias: { preferred: ['glowing'], avoid: ['flat'] },
      cameraBias: { preferredAngles: ['close-up'], preferredFraming: ['detail'] },
      renderingLanguage: { quality: ['complex'], atmosphere: ['hybrid', 'advanced'], detail: ['structure'] }
    }
  }
];

export function generatePrompt(state: AppState): string {
  const { workflow, activeStyleId, lighting, context, materials, camera } = state;
  
  // If user provided a specific text prompt in text-to-image mode or visual edit, prioritize it or combine it.
  if (state.mode === 'generate-text' && workflow.textPrompt) {
     return workflow.textPrompt;
  }
  
  if (state.mode === 'visual-edit' && workflow.visualPrompt) {
     return workflow.visualPrompt;
  }

  // Find active style
  const style = BUILT_IN_STYLES.find(s => s.id === activeStyleId);
  
  let promptParts: string[] = [];

  // 1. Base Prompt / Subject
  if (state.prompt) {
    promptParts.push(state.prompt);
  } else if (style) {
    promptParts.push(`A ${style.name.toLowerCase()} architectural rendering`);
  } else {
    promptParts.push('Architectural rendering');
  }

  // 2. Style Specifics
  if (style) {
    const { architectureVocabulary, materialBias } = style.promptBundle;
    promptParts.push(`Architecture: ${architectureVocabulary.slice(0, 3).join(', ')}.`);
    promptParts.push(`Materials: ${materialBias.primary.join(', ')} and ${materialBias.secondary.slice(0, 2).join(', ')}.`);
  }

  // 3. Lighting
  promptParts.push(`Lighting: ${lighting.timeOfDay}, ${lighting.weather}, ${lighting.cloudType} sky.`);

  // 4. Context
  if (context.vegetation) {
    promptParts.push(`Surroundings: ${context.vegetationDensity > 50 ? 'dense' : 'sparse'} ${context.season} vegetation.`);
  }
  if (context.people) {
    promptParts.push('Includes people.');
  }

  // 5. Camera/Technical
  promptParts.push(`View: ${camera.viewType}, ${camera.projection} projection.`);
  promptParts.push('High quality, photorealistic, 8k.');

  // Manual Adjustments from Workflow (e.g. materials emphasis)
  if (materials.concreteEmphasis > 70) promptParts.push('emphasizing concrete textures');
  
  return promptParts.join(' ');
}
