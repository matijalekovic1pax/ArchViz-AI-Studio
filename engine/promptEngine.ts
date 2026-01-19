
import { AppState, Render3DSettings, StyleConfiguration, VisualSelectionShape } from '../types';

export const BUILT_IN_STYLES: StyleConfiguration[] = [
  {
    id: 'no-style',
    name: 'No Style',
    category: 'Base',
    description: 'No style. Use the raw prompt without stylistic bias.',
    previewUrl: 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=600&q=80',
    promptBundle: {}
  },
  // --- EXISTING STYLES (14) ---
  {
    id: 'contemporary-minimalist',
    name: 'Contemporary Minimalist',
    category: 'Residential',
    description: 'Style: Contemporary Minimalist. Architectural vocabulary of clean lines, minimal ornamentation, open plan. Material palette of white plaster, floor-to-ceiling glass with secondary materials like warm oak accents, matte black steel. Lighting favors soft natural light, diffused daylight. Overall mood is serene, sophisticated.',
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
    description: 'Style: Neo-Brutalist. Architectural vocabulary of massive forms, monolithic, geometric. Material palette of exposed concrete, raw timber with secondary materials like weathered steel, glass. Lighting favors dramatic shadows, contrast. Overall mood is imposing, atmospheric.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/A_hotel_%28known_as_Fullerton_Hotel%29_looks_grand_and_imposing_at_the_time_of_dusk.jpg',
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
    description: 'Style: Parametric Fluidity. Architectural vocabulary of organic curves, parametric facade, flowing geometry. Material palette of white corian, curved glass with secondary materials like perforated metal, fiber composites. Lighting favors soft gradients, ambient glow. Overall mood is futuristic, ethereal.',
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
    description: 'Style: Modern Vernacular. Architectural vocabulary of gabled roof, local adaptation, warm tones. Material palette of brick, stone with secondary materials like copper, slate. Lighting favors golden hour, warm interior glow. Overall mood is inviting, cozy.',
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
    description: 'Style: Scandinavian. Architectural vocabulary of simple forms, functionalism, hygge. Material palette of pine wood, white walls with secondary materials like wool, linen. Lighting favors diffused north light, bright interiors. Overall mood is cozy, clean.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Castle_Rising%2C_St._Lawrence%27s_Church%2C_The_Norman_Nave_Arch_4%2C_Scandinavian_style_capital_carving_-_geograph.org.uk_-_5109279.jpg',
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
    description: 'Style: Industrial Loft. Architectural vocabulary of adaptive reuse, open ceilings, large windows. Material palette of exposed brick, steel beams with secondary materials like ductwork, distressed leather. Lighting favors large daylighting, edison bulbs. Overall mood is urban, raw.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/HeinzLofts.jpg',
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
    description: 'Style: Biophilic Design. Architectural vocabulary of vertical gardens, indoor-outdoor flow, organic patterns. Material palette of living walls, natural wood with secondary materials like water features, bamboo. Lighting favors dappled sunlight, skylights. Overall mood is lush, restorative.',
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
    description: 'Style: Mid-Century Modern. Architectural vocabulary of cantilevered, flat planes, integration with landscape. Material palette of teak, glass with secondary materials like brass, terrazzo. Lighting favors warm sunlight, globe lights. Overall mood is nostalgic, stylish.',
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
    description: 'Style: Japanese Zen. Architectural vocabulary of engawa, shoji screens, minimalist. Material palette of hinoki wood, tatami with secondary materials like river stones, paper. Lighting favors diffused soft light, shadow play. Overall mood is peaceful, meditative.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Architectural_Detail_-_Kennin-ji_Zen_Temple_-_Kyoto_-_Japan_%2847929070538%29.jpg',
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
    description: 'Style: Cyberpunk. Architectural vocabulary of megastructure, dense urban, high-tech. Material palette of metal, glass with secondary materials like holograms, wires. Lighting favors neon pink, cyan glow. Overall mood is dark, gritty.',
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
    description: 'Style: Bauhaus. Architectural vocabulary of geometric, functionalism, asymmetry. Material palette of white stucco, steel with secondary materials like primary color accents, concrete. Lighting favors clear daylight, studio lighting. Overall mood is rational, modern.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/12/20er_Bauhaus.png',
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
    description: 'Style: Tropical Modernism. Architectural vocabulary of large overhangs, passive ventilation, open spaces. Material palette of concrete, tropical hardwood with secondary materials like water, vegetation. Lighting favors bright sun, deep shade. Overall mood is humid, lush.',
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
    description: 'Style: Alpine Chalet. Architectural vocabulary of steep roof, panoramic windows, mountain retreat. Material palette of timber cladding, slate with secondary materials like glass, fur. Lighting favors warm interior light, blue hour snow. Overall mood is cold outside warm inside, majestic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Alpine_flowers_and_gardens_%28IA_alpineflowersgar00flemrich%29.pdf',
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
    description: 'Style: Desert Modernism. Architectural vocabulary of horizontal planes, earth shelter, arid landscape. Material palette of rammed earth, corten steel with secondary materials like glass, succulents. Lighting favors hard sunlight, long shadows. Overall mood is dry, hot.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Architect_and_engineer_%28IA_architectenginee11333sanf%29.pdf',
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
    description: 'Style: Art Deco. Architectural vocabulary of geometric patterns, vertical emphasis, ziggurat forms. Material palette of limestone, chrome with secondary materials like brass, terrazzo. Lighting favors dramatic up-lighting, neon accents. Overall mood is glamorous, bold.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Art_Deco_Building_on_1_Fifth_Avenue_behind_Washington_Square_Arch_2019-09-29_23-34.jpg',
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
    description: 'Style: Beaux-Arts. Architectural vocabulary of symmetry, columns, cornices. Material palette of limestone, marble with secondary materials like bronze. Lighting favors natural daylight, chandelier glow. Overall mood is monumental, formal.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/%28Narbonne%29_Mgr_Jules_de_M%C3%A9dicis_-_Mus%C3%A9e_des_Beaux-Arts_de_Narbonne.jpg',
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
    description: 'Style: Gothic Revival. Architectural vocabulary of pointed arches, steep roofs, tracery. Material palette of stone, brick with secondary materials like stained glass, slate. Lighting favors mysterious, shadowy. Overall mood is imposing, historic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Kenilwood-gothic-revival-architecture.jpg',
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
    description: 'Style: Victorian. Architectural vocabulary of asymmetry, decorative trim, turrets. Material palette of painted wood, brick with secondary materials like shingles, stained glass. Lighting favors warm, inviting light. Overall mood is charming, detailed.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Osborne_Street_Victorian%2C_Danbury%2C_Connecticut.jpg',
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
    description: 'Style: Mediterranean Revival. Architectural vocabulary of arches, courtyards, red tile roof. Material palette of stucco, terracotta with secondary materials like wrought iron, wood. Lighting favors warm sun, dappled shade. Overall mood is sunny, relaxed.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/60/%281%29Mediterranean_Revival_style-1.jpg',
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
    description: 'Style: Tudor Revival. Architectural vocabulary of half-timbering, steep gables, prominent chimneys. Material palette of brick, stucco with secondary materials like stone. Lighting favors warm, cozy light. Overall mood is fairytale, historic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/An_example_of_Tudor_Revival_architecture_in_the_Belle_Meade_Links_neighborhood_%28Nashville%2C_Tennessee%29.jpg',
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
    description: 'Style: Craftsman. Architectural vocabulary of low-pitched roof, exposed rafters, tapered columns. Material palette of wood, stone with secondary materials like brick, shingle. Lighting favors warm light. Overall mood is homely, natural.',
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
    description: 'Style: Prairie Style. Architectural vocabulary of horizontal lines, cantilevers, open plan. Material palette of brick, wood with secondary materials like art glass. Lighting favors natural light. Overall mood is grounded, peaceful.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Frank_Lloyd_Wright_Prairie_Style_Marysville.jpg',
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
    description: 'Style: International Style. Architectural vocabulary of rectilinear, volume over mass, regularity. Material palette of glass, steel with secondary materials like white render. Lighting favors even light. Overall mood is rational, efficient.',
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
    description: 'Style: Deconstructivism. Architectural vocabulary of fragmentation, non-linear, distortion. Material palette of titanium, steel with secondary materials like concrete. Lighting favors dynamic light. Overall mood is chaotic, innovative.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/df/0156-Stuttgart-Hysolar.jpg',
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
    description: 'Style: High-Tech. Architectural vocabulary of exposed structure, functionalism, industrial aesthetic. Material palette of steel, glass with secondary materials like bright colors. Lighting favors technical light. Overall mood is engineered, advanced.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Futuristic_architecture_at_Holm_Island_-_geograph.org.uk_-_5246329.jpg',
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
    description: 'Style: Postmodernism. Architectural vocabulary of historical reference, color, playfulness. Material palette of stucco, stone veneer with secondary materials like tile. Lighting favors bright light. Overall mood is playful, eclectic.',
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
    description: 'Style: Metabolism. Architectural vocabulary of capsules, modularity, growth. Material palette of concrete, pre-fab units with secondary materials like steel. Lighting favors natural light. Overall mood is futuristic, organic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Albendazole_metabolism_%28blank%29.svg',
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
    description: 'Style: Eco-Brutalism. Architectural vocabulary of concrete, vegetation, overgrown. Material palette of concrete, plants with secondary materials like water. Lighting favors dappled light. Overall mood is post-apocalyptic, serene.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Architectural_record_%28IA_architecturalrec5319unse%29.pdf',
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
    description: 'Style: Tiny House. Architectural vocabulary of compact, efficient, loft. Material palette of wood with secondary materials like metal. Lighting favors cozy light. Overall mood is simple, free.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/The_Tiny_House_at_SMAK%27s_Hotel.jpg',
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
    description: 'Style: Container Arch. Architectural vocabulary of modular, industrial, corrugated. Material palette of metal, glass with secondary materials like wood deck. Lighting favors natural light. Overall mood is innovative, upcycled.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Architectural_Review_and_American_Builders%27_Journal%2C_Volume_1%2C_1869.pdf',
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
    description: 'Style: Earthship. Architectural vocabulary of earth-bermed, passive solar, recycled. Material palette of tires, adobe with secondary materials like wood. Lighting favors natural light. Overall mood is sustainable, rugged.',
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
    description: 'Style: Bamboo Architecture. Architectural vocabulary of organic, curved, open air. Material palette of bamboo with secondary materials like thatch. Lighting favors warm light. Overall mood is tropical, serene.',
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
    description: 'Style: Nordic Noir. Architectural vocabulary of minimalist, dark exterior, cozy interior. Material palette of charred wood, glass with secondary materials like concrete. Lighting favors moody light. Overall mood is quiet, mysterious.',
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
    description: 'Style: A-Frame. Architectural vocabulary of triangular, steep roof, open gable. Material palette of wood, glass with secondary materials like metal roof. Lighting favors warm light. Overall mood is cabin, retreat.',
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
    description: 'Style: Geodesic Dome. Architectural vocabulary of spherical, triangular lattice, efficient. Material palette of glass, steel with secondary materials like ETFE. Lighting favors bright light. Overall mood is futuristic, scientific.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Geodesic_Dome_Tent.webp',
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
    description: 'Style: Parametric Timber. Architectural vocabulary of fluid, computational, layered. Material palette of wood with secondary materials like glass. Lighting favors warm light. Overall mood is innovative, natural.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Computational_analysis_of_hygromorphic_self-shaping_wood_gridshell_structures.pdf',
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
    description: 'Style: Floating Arch. Architectural vocabulary of floating, buoyant, deck. Material palette of wood, composite with secondary materials like glass. Lighting favors reflected light. Overall mood is peaceful, aquatic.',
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
    description: 'Style: Mars Habitat. Architectural vocabulary of 3D printed, protective, dome. Material palette of regolith, composite with secondary materials like glass. Lighting favors artificial, reddish light. Overall mood is hostile, advanced.',
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
    description: 'Style: Solarpunk. Architectural vocabulary of green tech, organic curves, stained glass. Material palette of glass, plants with secondary materials like solar panels. Lighting favors bright light. Overall mood is utopian, vibrant.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Casa_Terracota_in_Villa_de_Leyva.jpg',
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
    description: 'Style: Steampunk. Architectural vocabulary of industrial, victorian, gears. Material palette of brass, copper with secondary materials like brick. Lighting favors warm, hazy light. Overall mood is retro-future, mechanical.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Steampunk_festival_in_Lincoln_2014_-_Photo_39_-_geograph.org.uk_-_4170042.jpg',
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
    description: 'Style: Islamic Modern. Architectural vocabulary of geometry, pattern, screening. Material palette of stone, screen with secondary materials like water. Lighting favors filtered, shadow patterns. Overall mood is spiritual, cool.',
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
    description: 'Style: Chinese Modern. Architectural vocabulary of sweeping roof, brackets, courtyard. Material palette of wood, tile with secondary materials like stone. Lighting favors soft light. Overall mood is peaceful, historic.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/61/20240729_Sign_of_Badaguan_Modern_Architectures.jpg',
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
    description: 'Style: Wabi-Sabi. Architectural vocabulary of imperfection, simplicity, natural aging. Material palette of aged wood, rough plaster with secondary materials like stone. Lighting favors shadowy. Overall mood is quiet, melancholy.',
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
    description: 'Style: Memphis Group. Architectural vocabulary of geometric, colorful, pattern. Material palette of laminate, terrazzo with secondary materials like plastic. Lighting favors bright light. Overall mood is fun, bold.',
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
    description: 'Style: Art Nouveau. Architectural vocabulary of curves, organic lines, floral motifs. Material palette of stone, iron with secondary materials like ceramic. Lighting favors soft light. Overall mood is romantic, flowery.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Art_Nouveau_Riga_17.jpg',
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
    description: 'Style: Neoclassical. Architectural vocabulary of columns, pediment, symmetry. Material palette of stone, marble with secondary materials like white paint. Lighting favors bright light. Overall mood is imposing, stately.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Neo-Classical_-_Seattle%2C_WA_-_Smith_Tower_%281%29.jpg',
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
    description: 'Style: Colonial Revival. Architectural vocabulary of symmetry, shutters, dormers. Material palette of brick, siding with secondary materials like shingles. Lighting favors daylight. Overall mood is traditional, stately.',
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
    description: 'Style: Ranch Style. Architectural vocabulary of single story, horizontal, low roof. Material palette of brick, wood with secondary materials like glass. Lighting favors sunny. Overall mood is relaxed, spacious.',
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
    description: 'Style: Swiss Chalet. Architectural vocabulary of wide eaves, balconies, decorative carving. Material palette of wood with secondary materials like stone. Lighting favors bright light. Overall mood is alpine, charming.',
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
    description: 'Style: Pueblo Revival. Architectural vocabulary of adobe, rounded edges, flat roof. Material palette of stucco, wood with secondary materials like tile. Lighting favors sunlight. Overall mood is desert, soft.',
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
    description: 'Style: Greek Revival. Architectural vocabulary of temple front, columns, pediment. Material palette of wood, stucco with secondary materials like stone. Lighting favors bright light. Overall mood is historic, formal.',
    previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Best_Lucas_House_-_Galveston.jpg',
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
    description: 'Style: Italianate. Architectural vocabulary of brackets, tall windows, low roof. Material palette of brick, stucco with secondary materials like iron. Lighting favors warm light. Overall mood is elegant, tall.',
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
    description: 'Style: Futuristic Organic. Architectural vocabulary of fluid, seamless, curved. Material palette of corian, fiberglass with secondary materials like glass. Lighting favors diffused light. Overall mood is future, clean.',
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
    description: 'Style: Cyber-Organic. Architectural vocabulary of tech, biology, integrated. Material palette of bioplastic, metal with secondary materials like light. Lighting favors glowing. Overall mood is hybrid, advanced.',
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

const formatTimePreset = (preset: string): string => {
  const timeDescriptions: Record<string, string> = {
    'pre-dawn': 'pre-dawn twilight with deep blue sky',
    'sunrise': 'sunrise with warm orange and pink tones',
    'early-morning': 'early morning with soft golden light',
    'high-noon': 'high noon with direct overhead sunlight',
    'late-afternoon': 'late afternoon with warm directional light',
    'golden-hour': 'golden hour with rich amber tones',
    'sunset-glow': 'sunset glow with dramatic warm colors',
    'blue-hour': 'blue hour with cool twilight atmosphere',
    'moonlit-night': 'moonlit night scene with artificial lighting',
  };
  return timeDescriptions[preset] || preset.replace(/-/g, ' ');
};

const formatContextPreset = (preset: string): string => {
  return preset.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatViewType = (viewType: string): string => {
  const viewDescriptions: Record<string, string> = {
    'passenger-pov': 'passenger point-of-view perspective',
    'concourse-walk': 'concourse corridor perspective',
    'atrium-overview': 'atrium overview from ground level',
    'gate-seating': 'seated gate waiting view',
    'lounge-interior': 'lounge interior seated angle',
    'mezzanine-view': 'mezzanine view from upper level',
    'drone-low': 'low-altitude drone perspective',
    'drone-high': 'high-altitude drone overview',
    'section-cut': 'architectural section cut view',
    'spherical-360': '360-degree spherical panorama',
    'perspective': 'perspective view',
    'orthographic': 'orthographic view',
    'isometric': 'isometric view',
    'section': 'section view',
    'elevation': 'elevation view',
  };
  return viewDescriptions[viewType] || viewType.replace(/-/g, ' ');
};

const formatMood = (mood: string): string => {
  const moodDescriptions: Record<string, string> = {
    'natural': 'natural balanced tones',
    'warm': 'warm inviting atmosphere',
    'cool': 'cool contemporary feel',
    'dramatic': 'dramatic high-contrast lighting',
    'soft': 'soft diffused ambiance',
    'moody': 'moody atmospheric shadows',
    'luxury': 'luxurious high-end finish',
    'cinematic': 'cinematic wide dynamic range',
    'hazy': 'hazy atmospheric depth',
    'crisp': 'crisp sharp clarity',
    'stormy': 'stormy dramatic skies',
    'noir': 'noir-style dramatic shadows',
  };
  return moodDescriptions[mood] || mood;
};

const getEmphasisMaterials = (emphasis: Record<string, number>): string[] => {
  return Object.entries(emphasis)
    .filter(([_, value]) => value > 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, _]) => key);
};

// Generate comprehensive prompt for 3D Render mode
function generate3DRenderPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;

  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  const parts: string[] = [];

  // 1. SUBJECT & SOURCE
  const sourceMap: Record<string, string> = {
    'rhino': 'Rhino 3D model',
    'revit': 'Revit BIM model',
    'sketchup': 'SketchUp model',
    'blender': 'Blender scene',
    '3dsmax': '3ds Max model',
    'archicad': 'ArchiCAD model',
    'cinema4d': 'Cinema 4D scene',
    'clay': 'clay render base',
    'other': '3D model',
  };

  const viewMap: Record<string, string> = {
    'exterior': 'exterior',
    'interior': 'interior',
    'aerial': 'aerial',
    'detail': 'detail',
  };

  parts.push(`Photorealistic architectural ${viewMap[workflow.viewType] || 'exterior'} rendering from ${sourceMap[workflow.sourceType] || '3D model'}.`);

  // 2. STYLE
  if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      parts.push(`Atmosphere: ${style.promptBundle.renderingLanguage.atmosphere.join(', ')}.`);
    }
  }

  // 3. GENERATION MODE
  const modeDescriptions: Record<string, string> = {
    'enhance': 'Enhance existing textures and lighting while strictly preserving geometry.',
    'stylize': 'Apply artistic interpretation while maintaining architectural accuracy.',
    'hybrid': 'Balance structural precision with creative material and lighting enhancements.',
    'strict-realism': 'Maximum photographic realism with minimal AI interpretation.',
    'concept-push': 'Creative exploration allowing form refinement and artistic details.',
  };
  parts.push(modeDescriptions[workflow.renderMode] || '');

  // 4. GEOMETRY
  const geo = r3d.geometry;
  const geoDesc: string[] = [];

  geoDesc.push(`${geo.edgeMode} edge definition`);
  if (geo.strictPreservation) {
    geoDesc.push('strict geometry preservation');
  }
  geoDesc.push(`${geo.lod.level} level of detail`);

  const lodFeatures: string[] = [];
  if (geo.lod.preserveOrnaments) lodFeatures.push('ornaments');
  if (geo.lod.preserveMoldings) lodFeatures.push('moldings');
  if (geo.lod.preserveTrim) lodFeatures.push('trim details');
  if (lodFeatures.length > 0) {
    geoDesc.push(`preserving ${lodFeatures.join(', ')}`);
  }

  if (geo.smoothing.enabled) {
    geoDesc.push(`${geo.smoothing.intensity}% surface smoothing${geo.smoothing.preserveHardEdges ? ' with preserved hard edges' : ''}`);
  }

  if (geo.depthLayers.enabled) {
    geoDesc.push(`depth-aware rendering (FG ${geo.depthLayers.foreground}%, MG ${geo.depthLayers.midground}%, BG ${geo.depthLayers.background}%)`);
  }

  if (geo.displacement.enabled) {
    geoDesc.push(`${geo.displacement.scale} scale displacement at ${geo.displacement.strength}%${geo.displacement.adaptToMaterial ? ' adapting to materials' : ''}`);
  }

  parts.push(`Geometry: ${geoDesc.join(', ')}.`);

  if (workflow.prioritizationEnabled) {
    const problemAreas = [...workflow.detectedElements].sort((a, b) => b.confidence - a.confidence);
    if (problemAreas.length > 0) {
      const detailList = problemAreas.map((el) => {
        const level = el.confidence >= 0.8 ? 'high' : el.confidence >= 0.6 ? 'medium' : 'low';
        return `${el.name} (${level} risk)`;
      });
      parts.push(`Problem areas to render with extra care: ${detailList.join(', ')}.`);
    }
  }

  // 5. LIGHTING
  const light = r3d.lighting;
  const lightDesc: string[] = [];

  lightDesc.push(formatTimePreset(light.preset));

  if (light.sun.enabled) {
    lightDesc.push(`sun at ${light.sun.azimuth}° azimuth and ${light.sun.elevation}° elevation`);
    lightDesc.push(`${light.sun.intensity}% intensity`);
    const tempDesc = light.sun.colorTemp < 4000 ? 'warm' : light.sun.colorTemp > 6500 ? 'cool' : 'neutral';
    lightDesc.push(`${tempDesc} ${light.sun.colorTemp}K color temperature`);
  }

  if (light.shadows.enabled) {
    lightDesc.push(`${light.shadows.softness > 50 ? 'soft' : 'sharp'} shadows at ${light.shadows.intensity}% opacity`);
  }

  parts.push(`Lighting: ${lightDesc.join(', ')}.`);

  // 6. CAMERA
  const cam = r3d.camera;
  const camDesc: string[] = [];

  camDesc.push(`${cam.lens}mm lens`);
  camDesc.push(`${cam.fov}° field of view`);

  if (cam.autoCorrect) {
    camDesc.push('perspective-corrected verticals');
  }

  if (cam.dof.enabled) {
    camDesc.push(`depth of field at f/${cam.dof.aperture}`);
    camDesc.push(`${cam.dof.focusDist}m focus distance`);
  }

  parts.push(`Camera: ${camDesc.join(', ')}.`);

  // 7. MATERIALS
  const mat = r3d.materials;
  const matDesc: string[] = [];

  const emphasizedMats = getEmphasisMaterials(mat.emphasis);
  if (emphasizedMats.length > 0) {
    matDesc.push(`emphasizing ${emphasizedMats.join(', ')}`);
  }

  if (mat.reflectivity !== 50) {
    matDesc.push(`${mat.reflectivity > 50 ? 'enhanced' : 'reduced'} reflectivity`);
  }

  if (mat.roughness !== 50) {
    matDesc.push(`${mat.roughness > 50 ? 'rougher' : 'smoother'} surfaces`);
  }

  if (mat.weathering.enabled) {
    matDesc.push(`${mat.weathering.intensity}% weathering and aging`);
  }

  if (matDesc.length > 0) {
    parts.push(`Materials: ${matDesc.join(', ')}.`);
  }

  // 8. ATMOSPHERE & MOOD
  const atm = r3d.atmosphere;
  const atmDesc: string[] = [];

  atmDesc.push(formatMood(atm.mood));

  if (atm.temp !== 0) {
    atmDesc.push(`${atm.temp > 0 ? 'warmer' : 'cooler'} color temperature`);
  }

  if (atm.fog.enabled) {
    atmDesc.push(`${atm.fog.density}% fog density`);
  }

  if (atm.bloom.enabled) {
    atmDesc.push(`${atm.bloom.intensity}% bloom effect`);
  }

  parts.push(`Atmosphere: ${atmDesc.join(', ')}.`);

  // 9. SCENERY & CONTEXT
  const scene = r3d.scenery;
  const sceneDesc: string[] = [];

  sceneDesc.push(`${formatContextPreset(scene.preset)} setting`);

  if (scene.people.enabled) {
    const density = scene.people.count > 50 ? 'busy' : scene.people.count > 20 ? 'moderate' : 'sparse';
    sceneDesc.push(`${density} pedestrian activity`);
  }

  if (scene.trees.enabled) {
    const density = scene.trees.count > 70 ? 'lush' : scene.trees.count > 30 ? 'moderate' : 'minimal';
    sceneDesc.push(`${density} vegetation`);
  }

  if (scene.cars.enabled) {
    sceneDesc.push(`vehicles present`);
  }

  parts.push(`Context: ${sceneDesc.join(', ')}.`);

  // 10. RENDER FORMAT & VIEW TYPE
  const rend = r3d.render;
  const rendDesc: string[] = [];

  const resMap: Record<string, string> = {
    '720p': '1280x720',
    '1080p': '1920x1080',
    '4k': '3840x2160',
    'print': '6000x4000 print-ready',
  };

  rendDesc.push(resMap[rend.resolution] || rend.resolution);
  rendDesc.push(`${rend.aspectRatio} aspect ratio`);
  rendDesc.push(formatViewType(rend.viewType));
  rendDesc.push(`${rend.quality} quality render`);

  parts.push(`Output: ${rendDesc.join(', ')}.`);

  // 11. TECHNICAL QUALITY
  const detailPhrase =
    rend.resolution === '1080p' || rend.resolution === '4k'
      ? 'when i zoom in i want to be able to see every detail'
      : '8K resolution details';
  parts.push(`High-fidelity photorealistic architectural visualization, professional archviz quality, ray-traced global illumination, physically accurate materials, ${detailPhrase}.`);

  return parts.filter(p => p.trim()).join(' ');
}

const formatToggle = (value: boolean) => (value ? 'on' : 'off');

const buildSelectionBounds = (
  shapes: VisualSelectionShape[],
  size?: { width: number; height: number } | null
) => {
  if (!shapes.length) return [];
  return shapes
    .map((shape) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let pointsCount = 0;

      if (shape.type === 'rect') {
        minX = Math.min(shape.start.x, shape.end.x);
        minY = Math.min(shape.start.y, shape.end.y);
        maxX = Math.max(shape.start.x, shape.end.x);
        maxY = Math.max(shape.start.y, shape.end.y);
        pointsCount = 2;
      } else {
        const points = shape.points || [];
        pointsCount = points.length;
        points.forEach((point) => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
        if (shape.type === 'brush') {
          const pad = (shape.brushSize || 0) / 2;
          minX -= pad;
          minY -= pad;
          maxX += pad;
          maxY += pad;
        }
      }

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
      }

      const width = Math.max(0, maxX - minX);
      const height = Math.max(0, maxY - minY);
      const normalize = (value: number, max: number) =>
        max > 0 ? Number((value / max).toFixed(4)) : Number(value.toFixed(2));

      const box = size
        ? {
            x: normalize(minX, size.width),
            y: normalize(minY, size.height),
            w: normalize(width, size.width),
            h: normalize(height, size.height),
          }
        : {
            x: Number(minX.toFixed(2)),
            y: Number(minY.toFixed(2)),
            w: Number(width.toFixed(2)),
            h: Number(height.toFixed(2)),
          };

      return {
        type: shape.type,
        points: pointsCount,
        box,
      };
    })
    .filter((item) => item);
};

const buildSelectionContext = (workflow: AppState['workflow']) => {
  const selectionCount = workflow.visualSelections.length;
  const selectionSize = workflow.visualSelectionMaskSize;
  const parts: string[] = [];

  if (selectionCount === 0) {
    parts.push('Selection: none. Apply edits to the entire image.');
  } else {
    const maskInfo = workflow.visualSelectionMask
      ? `Selection mask available (${selectionSize?.width || 0}x${selectionSize?.height || 0}). White = selected.`
      : 'Selection mask unavailable.';
    const overlayInfo = workflow.visualSelectionComposite
      ? `Selection overlay baked into input image (${workflow.visualSelectionCompositeSize?.width || 0}x${workflow.visualSelectionCompositeSize?.height || 0}).`
      : 'Selection overlay image unavailable.';
    const summary = workflow.visualSelections.reduce(
      (acc, shape) => {
        acc[shape.type] = (acc[shape.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const summaryText = Object.keys(summary)
      .map((key) => `${key}:${summary[key]}`)
      .join(', ');
    parts.push(`Selection: ${selectionCount} region(s) (${summaryText || 'none'}). ${maskInfo} ${overlayInfo}`);
    parts.push('Apply edits strictly within the visible selection overlay or mask, not a bounding box.');
  }

  const autoTargets =
    workflow.visualSelection.autoTargets.length > 0 ? workflow.visualSelection.autoTargets.join(', ') : 'none';
  parts.push(
    `Selection settings: mode ${workflow.visualSelection.mode}, strength ${workflow.visualSelection.strength}%, auto targets ${autoTargets}.`
  );
  return parts;
};

const generateVisualEditPrompt = (state: AppState): string => {
  const { workflow } = state;
  const tool = workflow.activeTool === 'replace' ? 'object' : workflow.activeTool;
  const selectionParts = buildSelectionContext(workflow);
  const parts: string[] = [];

  if (tool === 'select') {
    parts.push('Tool: Select. Define the edit region based on the selection input.');
    parts.push(...selectionParts);
    if (workflow.visualPrompt?.trim()) {
      parts.push(`Selection prompt: ${workflow.visualPrompt.trim()}.`);
    } else {
      parts.push('Selection prompt: none.');
    }
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'material') {
    parts.push('Tool: Material. Apply surface material changes.');
    parts.push(...selectionParts);
    if (workflow.visualMaterial.surfaceType === 'auto') {
      parts.push('Surface detection: auto. Ignore selection mask and target detected surfaces.');
    } else {
      parts.push('Surface detection: manual. Apply only within the selection mask.');
    }
    const material = workflow.visualMaterial;
    parts.push(
      `Material: category ${material.category}, material ${material.materialId || 'custom'}, scale ${material.scale}%, rotation ${material.rotation}deg, roughness ${material.roughness}%, tint ${material.colorTint}, match lighting ${formatToggle(
        material.matchLighting
      )}, preserve reflections ${formatToggle(material.preserveReflections)}.`
    );
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'lighting') {
    parts.push('Tool: Lighting. Relight the scene with the chosen mode.');
    parts.push(...selectionParts);
    const lighting = workflow.visualLighting;
    if (lighting.mode === 'sun') {
      parts.push(
        `Sun: azimuth ${lighting.sun.azimuth}deg, elevation ${lighting.sun.elevation}deg, intensity ${lighting.sun.intensity}%, temp ${lighting.sun.colorTemp}K, shadow softness ${lighting.sun.shadowSoftness}%.`
      );
    } else if (lighting.mode === 'hdri') {
      parts.push(
        `HDRI: preset ${lighting.hdri.preset}, rotation ${lighting.hdri.rotation}deg, intensity ${lighting.hdri.intensity}%.`
      );
    } else {
      parts.push(
        `Artificial: type ${lighting.artificial.type}, position ${lighting.artificial.position.x},${lighting.artificial.position.y}, intensity ${lighting.artificial.intensity}%, color ${lighting.artificial.color}, falloff ${lighting.artificial.falloff}%.`
      );
    }
    parts.push(
      `Global lighting: ambient ${lighting.ambient}%, preserve shadows ${formatToggle(lighting.preserveShadows)}.`
    );
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'object') {
    parts.push('Tool: Object. Place or replace objects within the selection.');
    parts.push(...selectionParts);
    const object = workflow.visualObject;
    const replace = workflow.visualReplace;

    if (object.placementMode === 'replace') {
      if (replace.mode === 'similar') {
        parts.push('Replace mode: similar. Auto-match objects within the selection.');
        parts.push(`Variation: ${replace.variation}%.`);
      } else {
        parts.push('Replace mode: different. Use the chosen object library entry.');
        parts.push(
          `Target: category ${object.category}, subcategory ${object.subcategory}, asset ${object.assetId || 'auto'}.`
        );
      }
      parts.push(
        `Replace options: match scale ${formatToggle(replace.matchScale)}, match lighting ${formatToggle(
          replace.matchLighting
        )}, preserve shadows ${formatToggle(replace.preserveShadows)}.`
      );
    } else {
      parts.push('Placement mode: place new object.');
      parts.push(
        `Target: category ${object.category}, subcategory ${object.subcategory}, asset ${object.assetId || 'auto'}.`
      );
    }

    parts.push(
      `Placement tuning: scale ${object.scale}%, rotation ${object.rotation}deg, auto perspective ${formatToggle(
        object.autoPerspective
      )}, shadows ${formatToggle(object.shadow)}, ground contact ${formatToggle(object.groundContact)}, depth ${
        object.depth
      }.`
    );
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'sky') {
    parts.push('Tool: Sky. Replace the sky and atmosphere.');
    parts.push(...selectionParts);
    const sky = workflow.visualSky;
    parts.push(
      `Sky preset ${sky.preset}, horizon ${sky.horizonLine}%, cloud density ${sky.cloudDensity}%, haze ${sky.atmosphere}%, brightness ${sky.brightness}%, reflect glass ${formatToggle(
        sky.reflectInGlass
      )}, match lighting ${formatToggle(sky.matchLighting)}, sun flare ${formatToggle(sky.sunFlare)}.`
    );
    parts.push('Sky replacement is global; use selection only as a hint if provided.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'remove') {
    parts.push('Tool: Remove. Remove unwanted content.');
    parts.push(...selectionParts);
    const remove = workflow.visualRemove;
    parts.push(
      `Remove mode ${remove.mode}. Quick remove targets: ${
        remove.quickRemove.length > 0 ? remove.quickRemove.join(', ') : 'none'
      }.`
    );
    parts.push(
      `Remove options: auto edges ${formatToggle(remove.autoDetectEdges)}, preserve structure ${formatToggle(
        remove.preserveStructure
      )}.`
    );
    if (remove.quickRemove.length > 0) {
      parts.push('Auto-detect and remove the selected quick targets across the image.');
    }
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'adjust') {
    parts.push('Tool: Adjust. Global image adjustments.');
    parts.push(...selectionParts);
    const adjust = workflow.visualAdjust;
    parts.push(
      `Tone: exposure ${adjust.exposure}, contrast ${adjust.contrast}, highlights ${adjust.highlights}, shadows ${adjust.shadows}, whites ${adjust.whites}, blacks ${adjust.blacks}, gamma ${adjust.gamma}.`
    );
    parts.push(
      `Color: saturation ${adjust.saturation}, vibrance ${adjust.vibrance}, temperature ${adjust.temperature}, tint ${adjust.tint}, hue shift ${adjust.hueShift}.`
    );
    parts.push(`Presence: texture ${adjust.texture}, clarity ${adjust.clarity}, dehaze ${adjust.dehaze}.`);
    parts.push(
      `HSL: channel ${adjust.hslChannel}, reds ${adjust.hslRedsHue}/${adjust.hslRedsSaturation}/${adjust.hslRedsLuminance}, oranges ${adjust.hslOrangesHue}/${adjust.hslOrangesSaturation}/${adjust.hslOrangesLuminance}, yellows ${adjust.hslYellowsHue}/${adjust.hslYellowsSaturation}/${adjust.hslYellowsLuminance}, greens ${adjust.hslGreensHue}/${adjust.hslGreensSaturation}/${adjust.hslGreensLuminance}, aquas ${adjust.hslAquasHue}/${adjust.hslAquasSaturation}/${adjust.hslAquasLuminance}, blues ${adjust.hslBluesHue}/${adjust.hslBluesSaturation}/${adjust.hslBluesLuminance}, purples ${adjust.hslPurplesHue}/${adjust.hslPurplesSaturation}/${adjust.hslPurplesLuminance}, magentas ${adjust.hslMagentasHue}/${adjust.hslMagentasSaturation}/${adjust.hslMagentasLuminance}.`
    );
    parts.push(
      `Color grade: shadows ${adjust.colorGradeShadowsHue}deg/${adjust.colorGradeShadowsSaturation}%, midtones ${adjust.colorGradeMidtonesHue}deg/${adjust.colorGradeMidtonesSaturation}%, highlights ${adjust.colorGradeHighlightsHue}deg/${adjust.colorGradeHighlightsSaturation}%, balance ${adjust.colorGradeBalance}.`
    );
    parts.push(
      `Detail: sharpness ${adjust.sharpness}, radius ${adjust.sharpnessRadius}, detail ${adjust.sharpnessDetail}, masking ${adjust.sharpnessMasking}, noise luma ${adjust.noiseReduction}, noise color ${adjust.noiseReductionColor}, noise detail ${adjust.noiseReductionDetail}.`
    );
    parts.push(
      `Effects: vignette ${adjust.vignette}, midpoint ${adjust.vignetteMidpoint}, roundness ${adjust.vignetteRoundness}, feather ${adjust.vignetteFeather}, grain ${adjust.grain}/${adjust.grainSize}/${adjust.grainRoughness}, bloom ${adjust.bloom}, chromatic aberration ${adjust.chromaticAberration}.`
    );
    parts.push(
      `Transform: rotate ${adjust.transformRotate}deg, horizontal ${adjust.transformHorizontal}, vertical ${adjust.transformVertical}, distortion ${adjust.transformDistortion}, perspective ${adjust.transformPerspective}.`
    );
    parts.push(`Global: style strength ${adjust.styleStrength}.`);
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'extend') {
    parts.push('Tool: Extend. Outpaint the image.');
    parts.push(...selectionParts);
    const extend = workflow.visualExtend;
    const ratioDesc =
      extend.targetAspectRatio === 'custom'
        ? `custom ${extend.customRatio.width}:${extend.customRatio.height}`
        : extend.targetAspectRatio;
    parts.push(
      `Extend: direction ${extend.direction}, amount ${extend.amount}%, target ratio ${ratioDesc}, lock aspect ${formatToggle(
        extend.lockAspectRatio
      )}, seamless blend ${formatToggle(extend.seamlessBlend)}, high detail ${formatToggle(
        extend.highDetail
      )}, quality ${extend.quality}.`
    );
    parts.push('Outpainting ignores selection unless specified by the direction.');
    return parts.filter(Boolean).join(' ');
  }

  parts.push(...selectionParts);
  return parts.filter(Boolean).join(' ');
};

function generateCadRenderPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;
  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  const parts: string[] = [];

  const cadTypeMap: Record<string, string> = {
    'plan': 'floor plan',
    'section': 'section',
    'elevation': 'elevation',
    'site': 'site plan',
  };

  parts.push(`Architectural render from CAD ${cadTypeMap[workflow.cadDrawingType] || 'drawing'}.`);
  if (workflow.cadScale) {
    parts.push(`Scale ${workflow.cadScale}.`);
  }
  if (Number.isFinite(workflow.cadOrientation)) {
    parts.push(`Orientation ${workflow.cadOrientation}°.`);
  }

  if (workflow.cadLayerDetectionEnabled && workflow.cadLayers?.length) {
    const visibleLayers = workflow.cadLayers.filter(layer => layer.visible).map(layer => layer.name);
    if (visibleLayers.length) {
      parts.push(`Visible layers: ${visibleLayers.join(', ')}.`);
    }
  }

  const space = workflow.cadSpace;
  parts.push(`Room type: ${space.roomType}.`);
  parts.push(`Ceiling: ${space.ceilingStyle}, window style: ${space.windowStyle}, door style: ${space.doorStyle}.`);

  if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      parts.push(`Atmosphere: ${style.promptBundle.renderingLanguage.atmosphere.join(', ')}.`);
    }
  }

  const cam = workflow.cadCamera;
  const camDesc: string[] = [];
  camDesc.push(`camera height ${cam.height}m`);
  camDesc.push(`${cam.focalLength}mm lens`);
  camDesc.push(`look-at ${cam.lookAt.toUpperCase()}`);
  camDesc.push(`position ${Math.round(cam.position.x)}% x, ${Math.round(cam.position.y)}% y`);
  camDesc.push(cam.verticalCorrection ? 'vertical correction on' : 'vertical correction off');
  parts.push(`Camera: ${camDesc.join(', ')}.`);

  const furn = workflow.cadFurnishing;
  const furnDesc: string[] = [`${furn.occupancy} occupancy`, `${furn.clutter}% clutter`];
  if (furn.people) {
    furnDesc.push(`entourage level ${furn.entourage}`);
  } else {
    furnDesc.push('no people');
  }
  parts.push(`Furnishing: ${furnDesc.join(', ')}.`);

  const cadContext = workflow.cadContext;
  parts.push(`Context: ${cadContext.environment} environment, ${cadContext.landscape} landscape, ${cadContext.season} season.`);

  // Render output controls (shared with Render 3D panel)
  const geo = r3d.geometry;
  const geoDesc: string[] = [];

  geoDesc.push(`${geo.edgeMode} edge definition`);
  if (geo.strictPreservation) {
    geoDesc.push('strict geometry preservation');
  }
  geoDesc.push(`${geo.lod.level} level of detail`);

  const lodFeatures: string[] = [];
  if (geo.lod.preserveOrnaments) lodFeatures.push('ornaments');
  if (geo.lod.preserveMoldings) lodFeatures.push('moldings');
  if (geo.lod.preserveTrim) lodFeatures.push('trim details');
  if (lodFeatures.length > 0) {
    geoDesc.push(`preserve ${lodFeatures.join(', ')}`);
  }

  if (geo.smoothing.enabled) {
    geoDesc.push(`${geo.smoothing.intensity}% smoothing`);
    if (geo.smoothing.preserveHardEdges) {
      geoDesc.push(`hard edges at ${geo.smoothing.threshold}°`);
    }
  }

  if (geo.depthLayers.enabled) {
    geoDesc.push(`depth layers ${geo.depthLayers.foreground}/${geo.depthLayers.midground}/${geo.depthLayers.background}`);
  }

  if (geo.displacement.enabled) {
    geoDesc.push(`${geo.displacement.strength}% ${geo.displacement.scale} displacement`);
  }

  parts.push(`Geometry: ${geoDesc.join(', ')}.`);

  const light = r3d.lighting;
  const lightDesc: string[] = [];
  if (light.sun.enabled) {
    lightDesc.push(`sun az ${light.sun.azimuth}° el ${light.sun.elevation}°`);
    lightDesc.push(`${light.sun.intensity}% sun intensity`);
    lightDesc.push(`${light.sun.colorTemp}K`);
  }
  if (light.shadows.enabled) {
    lightDesc.push(`${light.shadows.intensity}% shadows`);
    lightDesc.push(`${light.shadows.softness}% softness`);
  }
  if (light.ambient.intensity) {
    lightDesc.push(`${light.ambient.intensity}% ambient`);
  }
  lightDesc.push(formatTimePreset(light.preset));
  parts.push(`Lighting: ${lightDesc.join(', ')}.`);

  const mat = r3d.materials;
  const matDesc: string[] = [];
  const emphasis = getEmphasisMaterials(mat.emphasis);
  if (emphasis.length > 0) {
    matDesc.push(`emphasize ${emphasis.join(', ')}`);
  }
  matDesc.push(`${mat.reflectivity}% reflectivity`);
  matDesc.push(`${mat.roughness}% roughness`);
  if (mat.weathering.enabled) {
    matDesc.push(`${mat.weathering.intensity}% weathering`);
  }
  parts.push(`Materials: ${matDesc.join(', ')}.`);

  const atm = r3d.atmosphere;
  const atmDesc: string[] = [];
  atmDesc.push(formatMood(atm.mood));
  atmDesc.push(`${atm.temp} temperature`);
  if (atm.fog.enabled) {
    atmDesc.push(`${atm.fog.density}% fog density`);
  }
  if (atm.bloom.enabled) {
    atmDesc.push(`${atm.bloom.intensity}% bloom effect`);
  }
  parts.push(`Atmosphere: ${atmDesc.join(', ')}.`);

  const scene = r3d.scenery;
  const sceneDesc: string[] = [];
  sceneDesc.push(`${formatContextPreset(scene.preset)} setting`);
  if (scene.people.enabled) {
    const density = scene.people.count > 50 ? 'busy' : scene.people.count > 20 ? 'moderate' : 'sparse';
    sceneDesc.push(`${density} pedestrian activity`);
  }
  if (scene.trees.enabled) {
    const density = scene.trees.count > 70 ? 'lush' : scene.trees.count > 30 ? 'moderate' : 'minimal';
    sceneDesc.push(`${density} vegetation`);
  }
  if (scene.cars.enabled) {
    sceneDesc.push('vehicles present');
  }
  parts.push(`Scene: ${sceneDesc.join(', ')}.`);

  const rend = r3d.render;
  const rendDesc: string[] = [];
  const resMap: Record<string, string> = {
    '720p': '1280x720',
    '1080p': '1920x1080',
    '4k': '3840x2160',
    'print': '6000x4000 print-ready',
  };
  rendDesc.push(resMap[rend.resolution] || rend.resolution);
  rendDesc.push(`${rend.aspectRatio} aspect ratio`);
  rendDesc.push(formatViewType(rend.viewType));
  rendDesc.push(`${rend.quality} quality render`);
  parts.push(`Output: ${rendDesc.join(', ')}.`);

  const detailPhrase =
    rend.resolution === '1080p' || rend.resolution === '4k'
      ? 'when i zoom in i want to be able to see every detail'
      : '8K resolution details';
  parts.push(`High-fidelity photorealistic architectural visualization, professional archviz quality, ray-traced global illumination, physically accurate materials, ${detailPhrase}.`);

  return parts.filter(p => p.trim()).join(' ');
}

const formatYesNo = (value: boolean) => (value ? 'yes' : 'no');

function generateMasterplanPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Masterplan visualization');
  }

  const planTypeMap: Record<string, string> = {
    site: 'site plan',
    urban: 'urban plan',
    zoning: 'zoning plan',
    massing: 'massing plan',
  };
  parts.push(`Plan type: ${planTypeMap[workflow.mpPlanType] || workflow.mpPlanType}.`);

  const scaleValue = workflow.mpScale === 'custom' ? `1:${workflow.mpCustomScale}` : workflow.mpScale;
  parts.push(`Scale: ${scaleValue}.`);
  parts.push(`North rotation: ${Math.round(workflow.mpNorthRotation)} deg.`);

  parts.push(`Output style: ${workflow.mpOutputStyle}.`);
  if (workflow.mpViewAngle === 'custom') {
    parts.push(
      `View: custom elevation ${workflow.mpViewCustom.elevation} deg, rotation ${workflow.mpViewCustom.rotation} deg, perspective ${workflow.mpViewCustom.perspective}%.`
    );
  } else {
    parts.push(`View: ${workflow.mpViewAngle}.`);
  }

  const buildings = workflow.mpBuildings;
  const heightDesc =
    buildings.heightMode === 'vary'
      ? `varying heights ${buildings.heightRange.min}-${buildings.heightRange.max}m`
      : buildings.heightMode === 'from-color'
        ? 'heights from color'
        : `uniform height ${buildings.defaultHeight}m`;
  parts.push(
    `Buildings: style ${buildings.style}, ${heightDesc}, floor height ${buildings.floorHeight}m, roof ${buildings.roofStyle}.`
  );
  parts.push(
    `Building options: shadows ${formatYesNo(buildings.showShadows)}, transparent ${formatYesNo(
      buildings.transparent
    )}, facade variation ${formatYesNo(buildings.facadeVariation)}, floor labels ${formatYesNo(
      buildings.showFloorLabels
    )}.`
  );

  const landscape = workflow.mpLandscape;
  const landscapeFeatures = [
    landscape.trees ? 'trees' : null,
    landscape.grass ? 'grass' : null,
    landscape.water ? 'water' : null,
    landscape.pathways ? 'pathways' : null,
    landscape.streetFurniture ? 'street furniture' : null,
    landscape.vehicles ? 'vehicles' : null,
    landscape.people ? 'people' : null,
  ].filter(Boolean);
  parts.push(
    `Landscape: ${landscape.season} season, vegetation density ${landscape.vegetationDensity}%, tree variation ${landscape.treeVariation}%.`
  );
  if (landscapeFeatures.length > 0) {
    parts.push(`Landscape features: ${landscapeFeatures.join(', ')}.`);
  }
  if (workflow.mpOutputStyle === 'illustrative') {
    parts.push(`Vegetation style: ${landscape.vegetationStyle}.`);
  }

  const annotations = workflow.mpAnnotations;
  const annotationFlags = [
    annotations.zoneLabels ? 'zone labels' : null,
    annotations.streetNames ? 'street names' : null,
    annotations.buildingLabels ? 'building labels' : null,
    annotations.lotNumbers ? 'lot numbers' : null,
    annotations.scaleBar ? 'scale bar' : null,
    annotations.northArrow ? 'north arrow' : null,
    annotations.dimensions ? 'dimensions' : null,
    annotations.areaCalc ? 'area calculations' : null,
    annotations.contourLabels ? 'contour labels' : null,
  ].filter(Boolean);
  if (annotationFlags.length > 0) {
    parts.push(`Annotations: ${annotationFlags.join(', ')}.`);
  }
  parts.push(
    `Label style: ${annotations.labelStyle}, size ${annotations.labelSize}, color ${annotations.labelColor}, halo ${formatYesNo(
      annotations.labelHalo
    )}.`
  );

  const legend = workflow.mpLegend;
  if (legend.include) {
    const legendItems = [
      legend.showZones ? 'zones' : null,
      legend.showZoneAreas ? 'zone areas' : null,
      legend.showBuildings ? 'buildings' : null,
      legend.showLandscape ? 'landscape' : null,
      legend.showInfrastructure ? 'infrastructure' : null,
    ].filter(Boolean);
    parts.push(`Legend: ${legend.style} style, position ${legend.position}, items ${legendItems.join(', ')}.`);
  } else {
    parts.push('Legend: none.');
  }

  const zones = workflow.mpZones?.length || 0;
  if (zones > 0) {
    parts.push(`Zones: ${zones} defined.`);
  }
  const boundaryMode = workflow.mpBoundary?.mode || 'auto';
  parts.push(`Site boundary: ${boundaryMode}.`);

  const exportSettings = workflow.mpExport;
  parts.push(
    `Export: ${exportSettings.resolution} resolution, format ${exportSettings.format}, layers ${formatYesNo(
      exportSettings.exportLayers
    )}.`
  );

  if (workflow.mpContext?.location) {
    parts.push(`Context: ${workflow.mpContext.location}.`);
  }

  return parts.filter(Boolean).join(' ');
}

function generateExplodedPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Exploded architectural view');
  }

  parts.push('Input: PDF model export reference.');

  parts.push(`Dissection style: ${workflow.explodedStyle.render}.`);
  parts.push(`Explosion direction: ${workflow.explodedDirection}.`);
  if (workflow.explodedDirection === 'custom') {
    parts.push(
      `Explosion axis: X ${workflow.explodedAxis.x}, Y ${workflow.explodedAxis.y}, Z ${workflow.explodedAxis.z}.`
    );
  }
  parts.push(`Separation: ${workflow.explodedView.separation}mm.`);

  const view = workflow.explodedView;
  if (view.type === 'axon') {
    parts.push(`View: axonometric, angle ${view.angle}.`);
  } else {
    parts.push(
      `View: perspective, camera height ${view.cameraHeight}m, FOV ${view.fov} deg, look at ${view.lookAt}.`
    );
  }

  const style = workflow.explodedStyle;
  parts.push(`Color mode: ${style.colorMode}.`);
  if (style.colorMode === 'system') {
    const systemColors = Object.entries(style.systemColors || {})
      .map(([key, value]) => `${key}:${value}`)
      .join(', ');
    if (systemColors) {
      parts.push(`System colors: ${systemColors}.`);
    }
  }
  parts.push(`Edge style: ${style.edgeStyle}, line weight ${style.lineWeight}.`);

  const activeComponents = workflow.explodedComponents.filter((comp) => comp.active);
  parts.push(`Components: ${activeComponents.length} active of ${workflow.explodedComponents.length}.`);
  if (activeComponents.length > 0) {
    const names = activeComponents.slice(0, 6).map((comp) => comp.title || comp.name);
    parts.push(`Active components: ${names.join(', ')}${activeComponents.length > 6 ? ', ...' : ''}.`);
  }

  const annotations = workflow.explodedAnnotations;
  parts.push(
    `Annotations: labels ${formatYesNo(annotations.labels)}, leaders ${formatYesNo(
      annotations.leaders
    )}, dimensions ${formatYesNo(annotations.dimensions)}, assembly numbers ${formatYesNo(
      annotations.assemblyNumbers
    )}, material callouts ${formatYesNo(annotations.materialCallouts)}.`
  );
  parts.push(
    `Label style: ${annotations.labelStyle}, font size ${annotations.fontSize}, leader style ${annotations.leaderStyle}.`
  );

  const anim = workflow.explodedAnim;
  if (anim.generate) {
    parts.push(
      `Animation: type ${anim.type}, duration ${anim.duration}s, easing ${anim.easing}, stagger ${anim.stagger}%, hold start ${anim.holdStart}s, hold end ${anim.holdEnd}s.`
    );
  } else {
    parts.push('Animation: none.');
  }

  const output = workflow.explodedOutput;
  parts.push(
    `Output: ${output.resolution} resolution, background ${output.background}, ground plane ${formatYesNo(
      output.groundPlane
    )}, shadow ${formatYesNo(output.shadow)}, grid ${formatYesNo(output.grid)}, export layers ${formatYesNo(
      output.exportLayers
    )}.`
  );

  return parts.filter(Boolean).join(' ');
}

function generateSectionPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Section cutaway visualization');
  }

  const cut = workflow.sectionCut;
  parts.push(`Cut: ${cut.type}, plane ${cut.plane}%, depth ${cut.depth}%, direction ${cut.direction}.`);

  const reveal = workflow.sectionReveal;
  parts.push(`Reveal style: ${reveal.style}, focus ${reveal.focus}.`);
  parts.push(`Facade opacity ${reveal.facadeOpacity}%, depth fade ${reveal.depthFade}%.`);

  const areas = workflow.sectionAreas || [];
  const activeAreas = areas.filter((area) => area.active);
  parts.push(`Section areas: ${activeAreas.length} active of ${areas.length}.`);
  if (activeAreas.length > 0) {
    const formatArea = (area: (typeof activeAreas)[number]) => {
      const title = area.title?.trim() || 'Untitled';
      const description = area.description?.trim();
      return description ? `${title} - ${description}` : title;
    };
    const items = activeAreas.slice(0, 6).map(formatArea);
    parts.push(`Active areas: ${items.join(', ')}${activeAreas.length > 6 ? ', ...' : ''}.`);
  }
  parts.push(`Area detection: ${workflow.sectionAreaDetection}.`);

  const program = workflow.sectionProgram;
  parts.push(
    `Program visualization: color mode ${program.colorMode}, labels ${formatYesNo(program.labels)}, leader lines ${formatYesNo(
      program.leaderLines
    )}, area tags ${formatYesNo(program.areaTags)}, label style ${program.labelStyle}, font size ${program.fontSize}.`
  );

  const style = workflow.sectionStyle;
  parts.push(`Cut style: poche ${style.poche}, hatch ${style.hatch}, line weight ${style.weight}, beyond visibility ${style.showBeyond}%.`);

  return parts.filter(Boolean).join(' ');
}

export function generatePrompt(state: AppState): string {
  const { workflow, activeStyleId, lighting, context, materials, camera } = state;

  // If user provided a specific text prompt in text-to-image mode or visual edit, prioritize it or combine it.
  if (state.mode === 'generate-text' && workflow.textPrompt) {
     return workflow.textPrompt;
  }

  if (state.mode === 'visual-edit') {
    return generateVisualEditPrompt(state);
  }

  // Use specialized prompt generator for 3D Render mode
  if (state.mode === 'render-3d') {
    return generate3DRenderPrompt(state);
  }
  if (state.mode === 'render-cad') {
    return generateCadRenderPrompt(state);
  }
  if (state.mode === 'masterplan') {
    return generateMasterplanPrompt(state);
  }
  if (state.mode === 'exploded') {
    return generateExplodedPrompt(state);
  }
  if (state.mode === 'section') {
    return generateSectionPrompt(state);
  }

  const availableStyles = [...BUILT_IN_STYLES, ...(state.customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  let promptParts: string[] = [];

  // 1. Base Prompt / Subject
  if (state.prompt) {
    promptParts.push(state.prompt);
  } else if (style && !isNoStyle) {
    promptParts.push(`A ${style.name.toLowerCase()} architectural rendering`);
  } else {
    promptParts.push('Architectural rendering');
  }

  // 2. Style Specifics
  if (!isNoStyle && style?.description) {
    const styleDescription = style.description.trim();
    promptParts.push(styleDescription.endsWith('.') ? styleDescription : `${styleDescription}.`);
  }
  if (!isNoStyle && style?.promptBundle) {
    const architectureVocabulary = style.promptBundle.architectureVocabulary || [];
    const materialBias = style.promptBundle.materialBias || {};
    if (architectureVocabulary.length > 0) {
      promptParts.push(`Architecture: ${architectureVocabulary.slice(0, 3).join(', ')}.`);
    }
    const primaryMaterials = materialBias.primary || [];
    const secondaryMaterials = materialBias.secondary || [];
    if (primaryMaterials.length > 0 || secondaryMaterials.length > 0) {
      const primaryText = primaryMaterials.length > 0 ? primaryMaterials.join(', ') : 'balanced materials';
      const secondaryText = secondaryMaterials.slice(0, 2).join(', ');
      const materialsText = secondaryText ? `${primaryText} and ${secondaryText}` : primaryText;
      promptParts.push(`Materials: ${materialsText}.`);
    }
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
