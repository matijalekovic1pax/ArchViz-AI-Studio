
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

// ============================================================================
// DESCRIPTIVE LANGUAGE HELPERS
// These functions convert technical values into natural, human-like descriptions
// that work better with AI image generation models
// ============================================================================

// ============================================================================
// ENHANCED DESCRIPTION HELPERS - Granular architectural visualization language
// ============================================================================

const describeSunPosition = (azimuth: number, elevation: number): string => {
  // Precise directional mapping with architectural implications
  const directions: Record<string, { dir: string; quality: string }> = {
    north: { dir: 'from the north', quality: 'cool, even illumination typical of north-facing facades' },
    northeast: { dir: 'from the northeast', quality: 'crisp morning light with soft diagonal shadows' },
    east: { dir: 'from the east', quality: 'classic morning light revealing eastern elevations' },
    southeast: { dir: 'from the southeast', quality: 'warm mid-morning light with favorable shadow angles' },
    south: { dir: 'from the south', quality: 'strong direct light illuminating southern exposures fully' },
    southwest: { dir: 'from the southwest', quality: 'rich afternoon warmth with elongating shadows' },
    west: { dir: 'from the west', quality: 'dramatic evening light catching western facades' },
    northwest: { dir: 'from the northwest', quality: 'soft late-day light with gentle shadow play' },
  };

  let dirKey = 'north';
  if (azimuth >= 337.5 || azimuth < 22.5) dirKey = 'north';
  else if (azimuth >= 22.5 && azimuth < 67.5) dirKey = 'northeast';
  else if (azimuth >= 67.5 && azimuth < 112.5) dirKey = 'east';
  else if (azimuth >= 112.5 && azimuth < 157.5) dirKey = 'southeast';
  else if (azimuth >= 157.5 && azimuth < 202.5) dirKey = 'south';
  else if (azimuth >= 202.5 && azimuth < 247.5) dirKey = 'southwest';
  else if (azimuth >= 247.5 && azimuth < 292.5) dirKey = 'west';
  else dirKey = 'northwest';

  const { dir, quality } = directions[dirKey];

  // Elevation with precise shadow length implications
  let elevationDesc = '';
  if (elevation < 10) elevationDesc = `positioned extremely low on the horizon (${elevation}°), creating dramatically elongated shadows that stretch 5-6x object height`;
  else if (elevation < 20) elevationDesc = `low on the horizon (${elevation}°), casting long theatrical shadows approximately 3x object height`;
  else if (elevation < 35) elevationDesc = `at a favorable low-mid angle (${elevation}°), producing shadows roughly 1.5-2x object height ideal for revealing form`;
  else if (elevation < 50) elevationDesc = `at a balanced mid-angle (${elevation}°), with shadows approximately equal to object height`;
  else if (elevation < 65) elevationDesc = `moderately high (${elevation}°), creating compact shadows about half the object height`;
  else if (elevation < 80) elevationDesc = `high in the sky (${elevation}°), with minimal shadow extension`;
  else elevationDesc = `nearly overhead (${elevation}°), creating almost no horizontal shadows`;

  return `sunlight streaming ${dir} (azimuth ${Math.round(azimuth)}°), ${elevationDesc}, providing ${quality}`;
};

const describeSunIntensity = (intensity: number): string => {
  // Precise intensity mapping with exposure implications
  if (intensity < 15) return `very soft sunlight (${intensity}% intensity) - subdued illumination as through heavy diffusion or atmospheric haze, requiring longer exposure`;
  if (intensity < 30) return `gentle sunlight (${intensity}% intensity) - delicate illumination as through thin clouds or morning mist`;
  if (intensity < 50) return `moderate sunlight (${intensity}% intensity) - balanced illumination typical of partly cloudy conditions or early/late day`;
  if (intensity < 70) return `strong sunlight (${intensity}% intensity) - confident illumination with clear definition between lit and shadowed areas`;
  if (intensity < 85) return `bright sunlight (${intensity}% intensity) - powerful direct illumination creating high contrast`;
  return `intense sunlight (${intensity}% intensity) - maximum solar illumination with potential for blown highlights in lighter materials`;
};

const describeColorTemperature = (kelvin: number): string => {
  // Precise Kelvin mapping with real-world equivalents
  if (kelvin < 2700) return `deeply warm amber light (${kelvin}K) - matching candlelight or tungsten bulbs, casting orange-gold tones across all surfaces`;
  if (kelvin < 3200) return `warm incandescent light (${kelvin}K) - soft golden illumination like classic interior lighting`;
  if (kelvin < 4000) return `warm golden daylight (${kelvin}K) - characteristic of golden hour sun, enriching warm materials like wood and brick`;
  if (kelvin < 4500) return `neutral-warm light (${kelvin}K) - balanced daylight with subtle warmth, flattering to most architectural materials`;
  if (kelvin < 5500) return `neutral daylight (${kelvin}K) - true color rendering matching midday sun conditions`;
  if (kelvin < 6500) return `clean daylight (${kelvin}K) - crisp illumination typical of overcast sky or north-facing light`;
  if (kelvin < 7500) return `cool daylight (${kelvin}K) - blue-tinted illumination suggesting shade or cloudy conditions`;
  return `cold blue light (${kelvin}K) - distinctly cool tones matching deep shade or heavily overcast winter sky`;
};

const describeShadows = (softness: number, intensity: number): string => {
  // Precise shadow characteristics
  const softDesc = softness > 80
    ? `extremely soft, diffused shadows (${softness}% softness) with gradual falloff spanning many inches`
    : softness > 60
      ? `soft shadows (${softness}% softness) with gentle penumbra edges`
      : softness > 40
        ? `moderately defined shadows (${softness}% softness) balancing clarity with naturalism`
        : softness > 20
          ? `fairly crisp shadows (${softness}% softness) with discernible but not harsh edges`
          : `razor-sharp shadows (${softness}% softness) with minimal penumbra, typical of direct sunlight`;

  const intensityDesc = intensity > 80
    ? `rendered at high density (${intensity}% intensity) - deep, nearly black in umbra regions`
    : intensity > 60
      ? `at medium-high density (${intensity}% intensity) - clearly visible with good contrast`
      : intensity > 40
        ? `at balanced density (${intensity}% intensity) - present but not dominating`
        : intensity > 20
          ? `at reduced density (${intensity}% intensity) - visible but lifted, showing detail in shadow`
          : `at minimal density (${intensity}% intensity) - very subtle, almost transparent`;

  return `${softDesc}, ${intensityDesc}`;
};

const describeLens = (mm: number): string => {
  // Precise lens characteristics with architectural implications
  if (mm < 18) return `an extreme ultra-wide ${mm}mm lens - dramatic spatial expansion with significant barrel distortion, requiring careful vertical correction; captures entire rooms from corners`;
  if (mm < 24) return `an ultra-wide ${mm}mm lens - substantial spatial expansion ideal for confined interiors; some barrel distortion present but manageable with corrections`;
  if (mm < 28) return `a wide-angle ${mm}mm lens - professional architectural standard for interiors; minimal distortion while capturing generous spatial context`;
  if (mm < 35) return `a moderate wide-angle ${mm}mm lens - versatile for both interior and exterior work; natural perspective with minimal corrections needed`;
  if (mm < 50) return `a standard ${mm}mm lens - closest to human eye perspective; minimal distortion, excellent for detail shots and balanced compositions`;
  if (mm < 70) return `a short telephoto ${mm}mm lens - slight compression flatters architectural facades; reduced keystone effect makes vertical lines naturally straighter`;
  if (mm < 100) return `a medium telephoto ${mm}mm lens - noticeable perspective compression; ideal for facade details and avoiding foreground distractions`;
  if (mm < 150) return `a telephoto ${mm}mm lens - significant compression flattening spatial depth; excellent for isolating building elements from distance`;
  return `a long telephoto ${mm}mm lens - extreme compression creating layered, graphic compositions; requires considerable distance from subject`;
};

const describeFOV = (fov: number): string => {
  // Field of view with precise spatial implications
  if (fov < 30) return `an extremely narrow ${fov}° field of view - tight framing isolating specific details, creating compressed layered compositions`;
  if (fov < 45) return `a narrow ${fov}° field of view - selective framing capturing focused vignettes of the architecture`;
  if (fov < 60) return `a moderate ${fov}° field of view - balanced framing showing the subject in context without excessive peripheral information`;
  if (fov < 75) return `a standard-wide ${fov}° field of view - comfortable spatial capture typical of professional architectural photography`;
  if (fov < 90) return `a wide ${fov}° field of view - expansive framing encompassing full elevations or complete interior volumes`;
  if (fov < 110) return `a very wide ${fov}° field of view - immersive capture stretching to peripheral vision, requiring distortion management`;
  return `an ultra-wide ${fov}° field of view - panoramic capture creating dramatic spatial exaggeration and immersive perspectives`;
};

const describeDepthOfField = (aperture: number, focusDist: number): string => {
  // Precise aperture and focus distance mapping
  const dofDesc = aperture < 1.8
    ? `extremely shallow depth of field (f/${aperture}) - razor-thin focus plane with pronounced optical bokeh, only millimeters in focus`
    : aperture < 2.8
      ? `very shallow depth of field (f/${aperture}) - clearly defined subject separation with creamy out-of-focus areas`
      : aperture < 4
        ? `shallow depth of field (f/${aperture}) - noticeable background softening while maintaining subject clarity`
        : aperture < 5.6
          ? `moderate-shallow depth of field (f/${aperture}) - gentle subject separation with slightly softened distant elements`
          : aperture < 8
            ? `moderate depth of field (f/${aperture}) - balanced sharpness with subtle depth falloff in far background`
            : aperture < 11
              ? `extended depth of field (f/${aperture}) - most of the scene sharp, only very distant elements softening`
              : aperture < 16
                ? `deep depth of field (f/${aperture}) - near-complete sharpness from foreground to background`
                : `maximum depth of field (f/${aperture}) - everything in focus from closest elements to infinity`;

  const focusDesc = focusDist < 2
    ? `focus point set at very close range (${focusDist}m) - macro-level detail emphasis`
    : focusDist < 5
      ? `focus point at near distance (${focusDist}m) - foreground elements in critical focus`
      : focusDist < 10
        ? `focus point at mid-ground (${focusDist}m) - optimal for capturing building details`
        : focusDist < 25
          ? `focus point at standard architectural distance (${focusDist}m) - balanced for full building capture`
          : focusDist < 50
            ? `focus point at medium distance (${focusDist}m) - optimized for full elevation views`
            : `focus point at far distance (${focusDist}m) - hyperfocal setting for maximum depth`;

  return `${dofDesc}; ${focusDesc}`;
};

const describeEdgeMode = (mode: string): string => {
  const descriptions: Record<string, string> = {
    'soft': 'softly antialiased edges with gentle transitions - lines appear organic and painterly, suitable for artistic interpretations',
    'medium': 'balanced edge definition with natural antialiasing - professional quality that avoids both harshness and excessive softness',
    'sharp': 'crisp, precisely defined edges with minimal antialiasing - clean delineation emphasizing architectural precision and drafting quality',
    'architectural': 'technically precise edges typical of professional archviz - sharp where materials meet, softer where natural weathering occurs',
    'natural': 'photographically authentic edges as they appear in reality - varying sharpness based on material, distance, and lighting conditions',
  };
  return descriptions[mode] || `${mode} edge treatment with appropriate antialiasing`;
};

const describeLOD = (level: string): string => {
  const descriptions: Record<string, string> = {
    'minimal': 'minimal detail level - focus on pure form, massing, and silhouette without surface articulation; suitable for early concept visualization',
    'low': 'reduced detail level - primary architectural elements visible but fine details simplified; window frames suggested rather than fully modeled',
    'medium': 'balanced detail level - all significant architectural features present including window mullions, door panels, visible structural elements; standard for presentation renders',
    'high': 'rich detail level - fine architectural craftsmanship visible including hardware, gaskets, weatherstripping, mortar joints, and subtle material variations',
    'ultra': 'extraordinary detail level - microscopic surface characteristics visible; every screw head, grain pattern, surface imperfection, and material nuance rendered with forensic precision',
  };
  return descriptions[level] || `${level} level of detail with proportionate surface articulation`;
};

const describeSmoothing = (intensity: number, preserveHardEdges: boolean): string => {
  const smoothDesc = intensity < 20
    ? `minimal surface smoothing (${intensity}%) - raw, unrefined surfaces maintaining construction authenticity and material honesty`
    : intensity < 40
      ? `light surface smoothing (${intensity}%) - subtle refinement reducing obvious mesh faceting while preserving surface character`
      : intensity < 60
        ? `moderate surface smoothing (${intensity}%) - balanced refinement for professional visualization, natural-looking curved surfaces`
        : intensity < 80
          ? `significant surface smoothing (${intensity}%) - polished appearance with idealized surface continuity`
          : `heavy surface smoothing (${intensity}%) - highly refined, almost porcelain-like surface quality`;

  const edgeNote = preserveHardEdges
    ? '; CRITICAL: intentional hard edges at material transitions, corners, and architectural details must remain crisp and unsmoothed'
    : '; smoothing applied uniformly including corners and transitions';

  return `${smoothDesc}${edgeNote}`;
};

const describeDepthLayers = (fg: number, mg: number, bg: number): string => {
  const descLayer = (value: number, name: string) => {
    if (value > 85) return `${name} rendered with maximum emphasis (${value}%) - full detail and contrast`;
    if (value > 70) return `${name} prominently rendered (${value}%) - high detail and presence`;
    if (value > 50) return `${name} clearly defined (${value}%) - balanced detail and visibility`;
    if (value > 30) return `${name} moderately present (${value}%) - visible but not dominating`;
    if (value > 15) return `${name} subtly suggested (${value}%) - soft presence adding depth`;
    return `${name} minimal (${value}%) - barely perceptible, creating atmospheric depth`;
  };

  return `layered spatial depth: ${descLayer(fg, 'foreground elements')}; ${descLayer(mg, 'middle ground')}; ${descLayer(bg, 'background/sky')}`;
};

const describeDisplacement = (scale: string, strength: number, adaptToMaterial: boolean): string => {
  const scaleDescriptions: Record<string, string> = {
    'fine': 'fine-scale displacement (sub-millimeter) - micro surface relief for textures like fabric weave, fine wood grain, brushed metal striations',
    'medium': 'medium-scale displacement (millimeter range) - visible surface relief for textures like brick courses, stone weathering, concrete board marks',
    'coarse': 'coarse-scale displacement (centimeter range) - pronounced relief for features like masonry joints, deep wood grain, rough stone faces',
  };

  const base = scaleDescriptions[scale] || `${scale}-scale displacement`;

  const strengthDesc = strength > 80
    ? `applied at maximum strength (${strength}%) - dramatic, almost sculptural surface relief`
    : strength > 60
      ? `applied strongly (${strength}%) - clearly visible depth and shadow-catching relief`
      : strength > 40
        ? `applied moderately (${strength}%) - perceptible but subtle surface variation`
        : strength > 20
          ? `applied gently (${strength}%) - understated surface texture`
          : `applied minimally (${strength}%) - barely perceptible, adding only slight tactility`;

  const adaptNote = adaptToMaterial
    ? '; displacement automatically calibrated per-material (stronger on rough stone, gentler on polished surfaces)'
    : '; uniform displacement strength across all materials';

  return `${base}, ${strengthDesc}${adaptNote}`;
};

const describeReflectivity = (value: number): string => {
  if (value < 30) return 'matte, light-absorbing surfaces with minimal reflections';
  if (value < 50) return 'naturally reflective surfaces as found in real materials';
  if (value < 70) return 'enhanced reflections bringing surfaces to life';
  return 'highly reflective surfaces with mirror-like qualities';
};

const describeRoughness = (value: number): string => {
  if (value < 30) return 'smooth, polished surfaces with refined finish';
  if (value < 50) return 'naturally textured surfaces with authentic feel';
  if (value < 70) return 'pleasantly rough surfaces with tactile character';
  return 'heavily textured, rugged surfaces with strong physical presence';
};

const describeWeathering = (intensity: number): string => {
  if (intensity < 25) return 'subtle signs of age and use adding authenticity';
  if (intensity < 50) return 'moderate weathering showing the passage of time';
  if (intensity < 75) return 'significant patina and wear telling a rich story';
  return 'heavily weathered surfaces with dramatic aging and character';
};

const describeAtmosphericMood = (mood: string, temp: number): string => {
  const moodDescriptions: Record<string, string> = {
    'natural': 'a balanced, true-to-life atmosphere',
    'warm': 'an inviting, cozy warmth suffusing the scene',
    'cool': 'a refreshing, contemporary coolness',
    'dramatic': 'bold, theatrical lighting with striking contrasts',
    'soft': 'gentle, embracing light that flatters every surface',
    'moody': 'atmospheric shadows creating depth and mystery',
    'luxury': 'refined, high-end illumination suggesting opulence',
    'cinematic': 'film-quality lighting with dramatic presence',
    'hazy': 'dreamy atmospheric haze adding depth and romance',
    'crisp': 'crystal-clear air with sharp definition',
    'stormy': 'dramatic weather bringing tension and energy',
    'noir': 'deep shadows and highlights in classic noir style',
  };

  const moodDesc = moodDescriptions[mood] || mood;
  const tempDesc = temp > 20 ? ', warmed with golden undertones' :
    temp < -20 ? ', cooled with blue-violet tones' :
    temp > 10 ? ', slightly warmed' :
    temp < -10 ? ', slightly cooled' : '';

  return `${moodDesc}${tempDesc}`;
};

const describeFog = (density: number): string => {
  if (density < 20) return 'a whisper of atmospheric haze adding subtle depth';
  if (density < 40) return 'gentle fog creating soft atmospheric perspective';
  if (density < 60) return 'noticeable mist enveloping distant elements';
  if (density < 80) return 'thick fog dramatically obscuring the background';
  return 'dense, enveloping fog creating an ethereal, mysterious atmosphere';
};

const describeBloom = (intensity: number): string => {
  if (intensity < 25) return 'subtle light bloom around bright sources';
  if (intensity < 50) return 'gentle glow emanating from highlights';
  if (intensity < 75) return 'prominent bloom creating a dreamy quality';
  return 'intense, radiant bloom suffusing bright areas with light';
};

const describePeopleActivity = (count: number): string => {
  if (count < 10) return 'a few carefully placed figures adding human scale';
  if (count < 30) return 'a modest gathering of people bringing life to the space';
  if (count < 60) return 'a lively crowd animating the scene';
  return 'a bustling throng of people creating urban energy';
};

const describeVegetation = (count: number): string => {
  if (count < 20) return 'minimal landscaping with carefully selected plants';
  if (count < 40) return 'thoughtful greenery complementing the architecture';
  if (count < 60) return 'abundant vegetation creating a garden-like atmosphere';
  if (count < 80) return 'lush, verdant landscaping embracing the building';
  return 'profuse, almost wild vegetation integrating nature and architecture';
};

const describeResolution = (res: string): string => {
  const descriptions: Record<string, string> = {
    '720p': 'rendered at HD resolution for quick visualization',
    '1080p': 'rendered in crisp Full HD with excellent detail',
    '4k': 'rendered in stunning 4K Ultra HD revealing every nuance',
    'print': 'rendered at print-ready resolution for large-format reproduction',
  };
  return descriptions[res] || res;
};

const describeQuality = (quality: string): string => {
  const descriptions: Record<string, string> = {
    'draft': 'quick draft quality for rapid iteration',
    'preview': 'preview quality balancing speed and detail',
    'standard': 'production-ready quality with professional finish',
    'high': 'high-fidelity quality with refined details',
    'ultra': 'ultra-premium quality with flawless execution',
  };
  return descriptions[quality] || quality;
};

const describeAspectRatio = (ratio: string): string => {
  const descriptions: Record<string, string> = {
    '16:9': 'in cinematic widescreen format',
    '4:3': 'in classic standard format',
    '1:1': 'in balanced square format',
    '3:2': 'in traditional photography format',
    '21:9': 'in ultra-wide cinematic format',
    '9:16': 'in vertical portrait format',
  };
  return descriptions[ratio] || `in ${ratio} format`;
};

const describeRenderMode = (mode: string): string => {
  const descriptions: Record<string, string> = {
    'enhance': 'Enhance the existing image by refining textures, enriching lighting, and elevating material quality while faithfully preserving every aspect of the original geometry and composition.',
    'stylize': 'Apply artistic interpretation that transforms the visual style while maintaining the fundamental architectural accuracy and spatial relationships of the original.',
    'hybrid': 'Strike a thoughtful balance between structural precision and creative enhancement, allowing materials and lighting to be reimagined while respecting the core architectural form.',
    'strict-realism': 'Achieve maximum photographic authenticity with minimal creative interpretation, rendering the scene exactly as a high-end camera would capture it.',
    'concept-push': 'Explore creative possibilities freely, allowing for form refinement, artistic material choices, and imaginative details that elevate the architectural concept.',
  };
  return descriptions[mode] || '';
};

const describeGeometryFidelity = (strictMode: boolean): string[] => {
  const notes = [
    'Treat the input image as the definitive source of truth for all geometry and camera positioning.',
    'Faithfully re-render this exact model without reinterpretation or redesign of any elements.',
    'Preserve the silhouette, proportions, massing, roofline profile, window and door openings, and facade rhythm precisely as shown.',
    'Maintain the exact camera viewpoint including lens characteristics, horizon line, and framing without any perspective or cropping changes.',
    'Lock the perspective completely: identical azimuth, elevation, roll angles, vanishing points, and horizon placement.',
    'Match the original framing and foreshortening exactly; the camera position and target point must not shift.',
    'Only the surface materials, lighting conditions, reflections, and overall render quality may be enhanced to achieve photorealism.'
  ];

  if (strictMode) {
    notes.push('Apply absolute geometry lock: no elements may be added, removed, or reshaped under any circumstances. When in doubt, preserve the original exactly.');
  }

  return notes;
};

// Generate comprehensive prompt for 3D Render mode
function generate3DRenderPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;

  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  const parts: string[] = [];

  // 1. SUBJECT & SOURCE - More evocative opening
  const sourceDescriptions: Record<string, string> = {
    'rhino': 'a meticulously crafted Rhino 3D model',
    'revit': 'a detailed Revit BIM model with full architectural data',
    'sketchup': 'a SketchUp model',
    'blender': 'a Blender scene with carefully arranged elements',
    '3dsmax': 'a professionally modeled 3ds Max scene',
    'archicad': 'an ArchiCAD model with rich architectural detail',
    'cinema4d': 'a Cinema 4D scene',
    'clay': 'a clean clay render as the foundation',
    'other': 'a 3D architectural model',
  };

  const viewDescriptions: Record<string, string> = {
    'exterior': 'Create a stunning exterior visualization that captures the building\'s presence in its environment',
    'interior': 'Create an immersive interior visualization that conveys the spatial quality and atmosphere',
    'aerial': 'Create a commanding aerial visualization that reveals the building\'s form and urban context',
    'detail': 'Create a focused detail visualization that celebrates the craftsmanship and material quality',
  };

  const viewIntro = viewDescriptions[workflow.viewType] || 'Create a photorealistic architectural visualization';
  parts.push(`${viewIntro}, rendered from ${sourceDescriptions[workflow.sourceType] || 'a 3D architectural model'}.`);

  // 2. STYLE - More narrative description
  if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      const atmosphereWords = style.promptBundle.renderingLanguage.atmosphere;
      parts.push(`The overall feeling should be ${atmosphereWords.slice(0, -1).join(', ')}${atmosphereWords.length > 1 ? ' and ' : ''}${atmosphereWords[atmosphereWords.length - 1]}.`);
    }
  }

  // 3. GENERATION MODE - Use descriptive helper
  parts.push(describeRenderMode(workflow.renderMode));

  // 3b. GEOMETRY FIDELITY - Use descriptive helper
  const geometryLock = workflow.renderMode === 'strict-realism' || r3d.geometry.strictPreservation;
  const fidelityNotes = describeGeometryFidelity(geometryLock);
  parts.push(fidelityNotes.join(' '));

  // 4. GEOMETRY - Descriptive language
  const geo = r3d.geometry;
  const geoDescParts: string[] = [];

  geoDescParts.push(`The rendering features ${describeEdgeMode(geo.edgeMode)}`);
  if (geo.strictPreservation) {
    geoDescParts.push('with absolute fidelity to the original geometry');
  }
  geoDescParts.push(`and ${describeLOD(geo.lod.level)}`);

  const lodFeatures: string[] = [];
  if (geo.lod.preserveOrnaments) lodFeatures.push('decorative ornaments');
  if (geo.lod.preserveMoldings) lodFeatures.push('molding profiles');
  if (geo.lod.preserveTrim) lodFeatures.push('trim details');
  if (lodFeatures.length > 0) {
    geoDescParts.push(`while carefully preserving the ${lodFeatures.join(', ')}`);
  }

  if (geo.smoothing.enabled) {
    geoDescParts.push(`. Surfaces are rendered with ${describeSmoothing(geo.smoothing.intensity, geo.smoothing.preserveHardEdges)}`);
  }

  if (geo.depthLayers.enabled) {
    geoDescParts.push(`. The scene has ${describeDepthLayers(geo.depthLayers.foreground, geo.depthLayers.midground, geo.depthLayers.background)}`);
  }

  if (geo.displacement.enabled) {
    geoDescParts.push(`. Materials feature ${describeDisplacement(geo.displacement.scale, geo.displacement.strength, geo.displacement.adaptToMaterial)}`);
  }

  parts.push(`${geoDescParts.join('')}.`);

  if (workflow.prioritizationEnabled) {
    const problemAreas = [...workflow.detectedElements]
      .filter((el) => el.selected !== false)
      .sort((a, b) => b.confidence - a.confidence);
    if (problemAreas.length > 0) {
      const instructions = problemAreas
        .filter((el) => el.detail?.trim())
        .map((el) => {
          const priority = el.confidence >= 0.8
            ? 'CRITICAL'
            : el.confidence >= 0.6
              ? 'IMPORTANT'
              : 'Note';
          return `[${priority}] ${el.detail.trim()}`;
        });
      if (instructions.length > 0) {
        parts.push(`**Rendering Instructions for Problem Areas:** ${instructions.join(' ')}`);
      }
    }
  }

  // 5. LIGHTING - Rich descriptive language
  const light = r3d.lighting;
  const lightParts: string[] = [];

  lightParts.push(`The scene is illuminated by ${formatTimePreset(light.preset)}`);

  if (light.sun.enabled) {
    lightParts.push(`. ${describeSunPosition(light.sun.azimuth, light.sun.elevation)}`);
    lightParts.push(`, with ${describeSunIntensity(light.sun.intensity)}`);
    lightParts.push(` and ${describeColorTemperature(light.sun.colorTemp)}`);
  }

  if (light.shadows.enabled) {
    lightParts.push(`. The lighting creates ${describeShadows(light.shadows.softness, light.shadows.intensity)}`);
  }

  parts.push(`${lightParts.join('')}.`);

  // 6. CAMERA - Natural language description
  const cam = r3d.camera;
  const camParts: string[] = [];

  camParts.push(`The view is captured through ${describeLens(cam.lens)}, offering ${describeFOV(cam.fov)}`);

  if (cam.autoCorrect) {
    camParts.push(', with vertical lines corrected to appear perfectly straight as in professional architectural photography');
  }

  if (cam.dof.enabled) {
    camParts.push(`. The image has ${describeDepthOfField(cam.dof.aperture, cam.dof.focusDist)}`);
  }

  parts.push(`${camParts.join('')}.`);

  // 7. MATERIALS - Evocative descriptions
  const mat = r3d.materials;
  const matParts: string[] = [];

  const emphasizedMats = getEmphasisMaterials(mat.emphasis);
  if (emphasizedMats.length > 0) {
    matParts.push(`The material palette prominently features ${emphasizedMats.join(', ')}, rendered with exceptional attention to their unique qualities`);
  }

  if (mat.reflectivity !== 50) {
    matParts.push(`Surfaces exhibit ${describeReflectivity(mat.reflectivity)}`);
  }

  if (mat.roughness !== 50) {
    matParts.push(`Materials are rendered with ${describeRoughness(mat.roughness)}`);
  }

  if (mat.weathering.enabled) {
    matParts.push(`The surfaces show ${describeWeathering(mat.weathering.intensity)}`);
  }

  if (matParts.length > 0) {
    parts.push(`${matParts.join('. ')}.`);
  }

  // 8. ATMOSPHERE & MOOD - Immersive description
  const atm = r3d.atmosphere;
  parts.push(`The atmosphere conveys ${describeAtmosphericMood(atm.mood, atm.temp)}.`);

  if (atm.fog.enabled) {
    parts.push(describeFog(atm.fog.density) + '.');
  }

  if (atm.bloom.enabled) {
    parts.push(`Light sources and bright areas have ${describeBloom(atm.bloom.intensity)}.`);
  }

  // 9. SCENERY & CONTEXT - Vivid scene setting
  const scene = r3d.scenery;
  const sceneParts: string[] = [];

  const contextDescriptions: Record<string, string> = {
    'urban': 'set within a vibrant urban environment',
    'suburban': 'nestled in a peaceful suburban neighborhood',
    'rural': 'situated in a serene rural landscape',
    'coastal': 'positioned along a stunning coastal setting',
    'forest': 'embraced by a natural forest environment',
    'mountain': 'set against a dramatic mountain backdrop',
    'desert': 'placed in an expansive desert landscape',
  };
  sceneParts.push(`The building is ${contextDescriptions[scene.preset] || `in a ${formatContextPreset(scene.preset)} setting`}`);

  if (scene.people.enabled) {
    sceneParts.push(`, with ${describePeopleActivity(scene.people.count)}`);
  }

  if (scene.trees.enabled) {
    sceneParts.push(`, complemented by ${describeVegetation(scene.trees.count)}`);
  }

  if (scene.cars.enabled) {
    sceneParts.push(', with realistically placed vehicles adding to the sense of place');
  }

  parts.push(`${sceneParts.join('')}.`);

  // 9b. BACKGROUND REFERENCE - Environment matching instruction
  if (workflow.backgroundReferenceEnabled && workflow.backgroundReferenceImage) {
    parts.push(`**Environment Reference (CRITICAL):** A reference photo showing the desired environment context is provided. IMPORTANT: Do NOT simply paste or composite the background behind the subject. Instead, use the reference to understand and recreate the environmental qualities: the time of day, sky conditions, ambient light color temperature, atmospheric haze and depth, weather mood, and overall color grading. The architecture must appear as if it was actually photographed in that environment - with matching shadow directions, consistent horizon line, natural atmospheric perspective (distant elements should have appropriate haze/desaturation), unified color palette, and seamless ground plane integration. The final image must look like a single cohesive photograph, not a collage.`);
  }

  // 10. RENDER FORMAT & OUTPUT - Professional finish description
  const rend = r3d.render;
  parts.push(`${describeResolution(rend.resolution)} ${describeAspectRatio(rend.aspectRatio)}, presented as a ${formatViewType(rend.viewType)} with ${describeQuality(rend.quality)}.`);

  // 11. TECHNICAL QUALITY - Aspirational closing
  const qualityClosing = rend.resolution === '4k' || rend.resolution === 'print'
    ? 'Every surface texture, reflection, and shadow should reward close inspection. The final image should be indistinguishable from a photograph taken by a master architectural photographer.'
    : 'The rendering should achieve the visual quality of professional architectural photography, with believable materials, accurate lighting, and compelling composition.';

  parts.push(`This should be a high-fidelity photorealistic architectural visualization with ray-traced global illumination and physically accurate materials. ${qualityClosing}`);

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
  const parts: string[] = [];

  if (selectionCount === 0) {
    parts.push('No specific area has been selected, so the edits should be applied thoughtfully across the entire image where appropriate.');
  } else {
    const summary = workflow.visualSelections.reduce(
      (acc, shape) => {
        acc[shape.type] = (acc[shape.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const shapeDescriptions: Record<string, string> = {
      rect: 'rectangular region',
      ellipse: 'elliptical area',
      polygon: 'custom polygon shape',
      brush: 'hand-painted area',
      lasso: 'freeform selection',
    };
    const summaryParts = Object.entries(summary).map(([type, count]) =>
      count === 1 ? `a ${shapeDescriptions[type] || type}` : `${count} ${shapeDescriptions[type] || type}s`
    );

    parts.push(`The user has carefully selected ${summaryParts.join(' and ')} to define exactly where changes should occur. Apply all edits precisely within this selected region, respecting its exact boundaries rather than using a simplified bounding box.`);

    if (workflow.visualSelectionMask) {
      parts.push('A selection mask is provided where white areas indicate the regions to be edited.');
    }
  }

  const autoTargets = workflow.visualSelection.autoTargets;
  if (autoTargets.length > 0) {
    parts.push(`The selection should intelligently target ${autoTargets.join(', ')}.`);
  }

  if (workflow.visualSelection.featherEnabled && workflow.visualSelection.featherAmount > 0) {
    const featherDesc = workflow.visualSelection.featherAmount > 50
      ? 'heavily feathered edges that blend very gradually into surrounding areas'
      : workflow.visualSelection.featherAmount > 20
        ? 'softly feathered edges for natural blending'
        : 'slightly feathered edges for subtle transitions';
    parts.push(`The selection has ${featherDesc}.`);
  }

  parts.push('Fundamental constraints: maintain the original camera angle, perspective, and overall composition. Confine all modifications strictly to the intended selection or tool scope. Leave unrelated architectural elements, layout, and materials completely untouched. Ensure all edges blend seamlessly and naturally into the surrounding image.');

  return parts;
};

const generateVisualEditPrompt = (state: AppState): string => {
  const { workflow } = state;
  const tool = workflow.activeTool === 'replace' ? 'object' : workflow.activeTool;
  const selectionCount = workflow.visualSelections.length;
  const userPrompt = workflow.visualPrompt?.trim();
  const selectionParts = buildSelectionContext(workflow);
  const parts: string[] = [];

  // User's creative intent
  const describeUserIntent = (prompt: string | undefined) => {
    if (prompt) {
      return `The user's vision for this edit: "${prompt}". Interpret this intent thoughtfully and execute it with precision.`;
    }
    return '';
  };

  if (tool === 'select') {
    const basePrompt = state.prompt?.trim();
    if (basePrompt) {
      parts.push(`Base scene intent: "${basePrompt}".`);
    }
    if (userPrompt) {
      parts.push(`Edit instruction: "${userPrompt}".`);
    }
    parts.push('Apply the edit ONLY inside the selected area. Do not alter any pixels outside the selection.');
    parts.push('Keep everything outside the selection identical to the original image: geometry, lighting, materials, perspective, and composition must remain unchanged.');
    parts.push(...selectionParts);
    parts.push('Strict constraint: no edits, relighting, retouching, or cleanup outside the selected area. Preserve the rest of the image exactly.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'material') {
    parts.push('Transform the surface materials within the selected area while preserving the underlying architectural form.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const material = workflow.visualMaterial;
    if (workflow.visualMaterial.surfaceType === 'auto') {
      parts.push('Intelligently detect and target the appropriate surfaces regardless of selection boundaries.');
    } else {
      parts.push('Apply the new material strictly within the defined selection boundaries.');
    }

    // Describe material in natural language
    const materialDesc: string[] = [];
    if (material.category && material.materialId) {
      materialDesc.push(`Apply a ${material.materialId} ${material.category} finish`);
    } else if (material.category) {
      materialDesc.push(`Apply a ${material.category} material`);
    }

    const scaleDesc = material.scale < 80 ? 'with a finer, more detailed pattern' :
      material.scale > 120 ? 'with a larger, bolder pattern' : 'at a natural scale';
    materialDesc.push(scaleDesc);

    if (material.rotation !== 0) {
      materialDesc.push(`rotated to a ${material.rotation} degree angle`);
    }

    const roughnessDesc = material.roughness < 30 ? 'with a polished, reflective finish' :
      material.roughness < 60 ? 'with a natural surface texture' : 'with a matte, textured appearance';
    materialDesc.push(roughnessDesc);

    if (material.colorTint && material.colorTint !== '#ffffff') {
      materialDesc.push(`tinted with ${material.colorTint}`);
    }

    parts.push(`${materialDesc.join(', ')}.`);

    if (material.matchLighting) {
      parts.push('Ensure the new material responds correctly to the existing scene lighting.');
    }
    if (material.preserveReflections) {
      parts.push('Maintain realistic reflections that match the environment.');
    }

    parts.push('Critical constraints: only the surface appearance may change. The geometry, edge profiles, joints, seams, and overall UV orientation must remain exactly as they are. Do not affect any adjacent materials or introduce new objects.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'lighting') {
    parts.push('Relight this scene to transform its mood and atmosphere while keeping all physical elements in place.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const lighting = workflow.visualLighting;
    if (lighting.mode === 'sun') {
      parts.push(`Illuminate the scene with ${describeSunPosition(lighting.sun.azimuth, lighting.sun.elevation)}. ${describeSunIntensity(lighting.sun.intensity)}, casting light with ${describeColorTemperature(lighting.sun.colorTemp)}.`);
      const shadowDesc = lighting.sun.shadowSoftness > 60 ? 'soft, diffused shadows' :
        lighting.sun.shadowSoftness > 30 ? 'moderately soft shadows' : 'crisp, defined shadows';
      parts.push(`Create ${shadowDesc}.`);
    } else if (lighting.mode === 'hdri') {
      const hdriDescriptions: Record<string, string> = {
        'studio': 'clean, professional studio lighting wrapping around the subject',
        'overcast': 'soft, even overcast sky light with gentle shadows',
        'sunset': 'warm, golden sunset illumination with rich color',
        'blue-hour': 'cool, ethereal blue hour lighting with magical quality',
        'interior': 'balanced interior lighting as through large windows',
      };
      const hdriDesc = hdriDescriptions[lighting.hdri.preset] || `${lighting.hdri.preset} environment lighting`;
      const intensityDesc = lighting.hdri.intensity > 80 ? 'bright and prominent' :
        lighting.hdri.intensity > 50 ? 'naturally balanced' : 'subtle and understated';
      parts.push(`Bathe the scene in ${hdriDesc}, rendered ${intensityDesc}.`);
    } else {
      const lightTypes: Record<string, string> = {
        'point': 'a focused point light source',
        'spot': 'a directional spotlight',
        'area': 'a soft area light',
        'linear': 'a linear light strip',
      };
      const typeDesc = lightTypes[lighting.artificial.type] || 'artificial lighting';
      parts.push(`Add ${typeDesc} with ${lighting.artificial.color} tones, creating ${lighting.artificial.falloff > 60 ? 'dramatic, rapid falloff' : 'gentle, gradual falloff'} from the light source.`);
    }

    const ambientDesc = lighting.ambient > 60 ? 'generous ambient fill preventing harsh shadows' :
      lighting.ambient > 30 ? 'moderate ambient fill for balanced contrast' : 'minimal ambient light allowing dramatic shadows';
    parts.push(`The scene should have ${ambientDesc}.`);

    if (lighting.preserveShadows) {
      parts.push('Preserve the essential character of existing shadows while adjusting the overall lighting.');
    }

    parts.push('Constraints: modify only the lighting. Do not replace the sky, alter any materials or textures, or change the geometry. Keep the camera position fixed. If a selection is active, relight only within that region with smooth, natural falloff at the edges.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'object') {
    const object = workflow.visualObject;
    const replace = workflow.visualReplace;
    const replacePrompt = replace.prompt?.trim();

    if (object.placementMode === 'replace') {
      parts.push('Replace the existing object within the selection with a new one that fits naturally into the scene.');
      parts.push(...selectionParts);
      parts.push(describeUserIntent(userPrompt));

      if (replace.mode === 'similar') {
        const variationDesc = replace.variation > 60 ? 'with noticeable variety' :
          replace.variation > 30 ? 'with subtle variations' : 'closely matching the original';
        parts.push(`Find and replace with a similar object ${variationDesc}.`);
      } else {
        parts.push(`Replace with a ${object.subcategory || ''} ${object.category || 'object'}${object.assetId ? ` (specifically: ${object.assetId})` : ''}.`);
      }

      if (replace.style) {
        parts.push(`The replacement should have a ${replace.style} aesthetic.`);
      }
      if (replacePrompt) {
        parts.push(`Additional guidance: ${replacePrompt}.`);
      }

      const matchingFeatures: string[] = [];
      if (replace.matchScale) matchingFeatures.push('matching the original scale');
      if (replace.matchLighting) matchingFeatures.push('responding correctly to scene lighting');
      if (replace.preserveShadows) matchingFeatures.push('casting appropriate shadows');
      if (matchingFeatures.length > 0) {
        parts.push(`The replacement should integrate seamlessly, ${matchingFeatures.join(', ')}.`);
      }
    } else {
      parts.push('Place a new object into the scene that integrates naturally with the existing environment.');
      parts.push(...selectionParts);
      parts.push(describeUserIntent(userPrompt));
      parts.push(`Add a ${object.subcategory || ''} ${object.category || 'object'}${object.assetId ? ` (specifically: ${object.assetId})` : ''}.`);
    }

    // Placement details in natural language
    const placementDesc: string[] = [];
    if (object.scale !== 100) {
      placementDesc.push(object.scale > 100 ? 'scaled up for prominence' : 'scaled down for subtlety');
    }
    if (object.rotation !== 0) {
      placementDesc.push(`rotated ${object.rotation} degrees`);
    }
    if (object.autoPerspective) {
      placementDesc.push('automatically aligned to the scene perspective');
    }
    if (object.shadow) {
      placementDesc.push('with realistic contact shadows');
    }
    if (object.groundContact) {
      placementDesc.push('firmly grounded on the surface');
    }

    if (placementDesc.length > 0) {
      parts.push(`Place the object ${placementDesc.join(', ')}.`);
    }

    if (selectionCount === 0) {
      parts.push('Since no specific area is selected, intelligently choose the most appropriate location based on the context and keep the addition minimal and purposeful.');
    }

    parts.push('Critical constraints: only add or replace objects as specified. Do not modify the building architecture, change materials, or alter the spatial layout. Ensure correct perspective alignment, appropriate scale relative to surroundings, proper occlusion with other elements, and convincing contact shadows. The object must not float, overlap incorrectly, or clip through surfaces.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'people') {
    const people = workflow.visualPeople;
    parts.push('Focus exclusively on 3D people in this architectural render. Preserve all architecture, materials, landscaping, vehicles, and background elements exactly.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    if (selectionCount === 0) {
      parts.push('No selection is provided; auto-detect all people across the frame and target them only.');
    }

    if (people.mode === 'enhance') {
      parts.push('Enhance existing people without changing the overall count unless absolutely necessary for realism.');
    } else if (people.mode === 'repopulate') {
      parts.push('Repopulate the scene with better-quality people, adjusting the count to match the desired density.');
    } else {
      parts.push('Clean up the people: remove artifacts, fix distortions, and eliminate unrealistic silhouettes.');
    }

    const densityDesc = people.density > 75
      ? 'high occupancy with lively activity'
      : people.density > 45
        ? 'balanced occupancy with a realistic crowd level'
        : people.density > 15
          ? 'lightly populated with a few intentional figures'
          : 'minimal people presence';
    parts.push(`Population density: ${densityDesc}.`);

    const realismDesc = people.realism > 75
      ? 'ultra-realistic, cinematic-quality people'
      : people.realism > 45
        ? 'natural, believable people'
        : 'subtle cleanup with minimal stylization';
    parts.push(`Realism goal: ${realismDesc}.`);

    const sharpnessDesc = people.sharpness > 75
      ? 'crisp edges and readable micro-details in clothing and faces'
      : people.sharpness > 45
        ? 'clean, moderately sharp people'
        : 'softer detail with minimal sharpening';
    parts.push(`Detail sharpness: ${sharpnessDesc}.`);

    const varietyDesc = people.variety > 75
      ? 'wide variety of ages, postures, and wardrobe'
      : people.variety > 45
        ? 'some variation while keeping cohesion'
        : 'consistent, cohesive set of people';
    parts.push(`Variety level: ${varietyDesc}.`);

    const scaleDesc = people.scaleAccuracy > 75
      ? 'strict scale accuracy relative to the architecture'
      : people.scaleAccuracy > 45
        ? 'balanced scale accuracy'
        : 'gentle scale adjustments, never oversized';
    parts.push(`Scale accuracy: ${scaleDesc}.`);

    const placementDesc = people.placementDiscipline > 75
      ? 'strict placement on walkable surfaces with proper spacing'
      : people.placementDiscipline > 45
        ? 'realistic placement and spacing'
        : 'looser placement while still believable';
    parts.push(`Placement discipline: ${placementDesc}.`);

    const luggageDesc = people.luggage > 70
      ? 'visible luggage, bags, or props where appropriate'
      : people.luggage > 40
        ? 'some accessories and light props'
        : 'minimal props and accessories';
    parts.push(`Accessories: ${luggageDesc}.`);

    const motionDesc = people.motionBlur > 70
      ? 'pronounced motion blur for moving figures'
      : people.motionBlur > 40
        ? 'subtle motion blur where needed'
        : 'mostly sharp, frozen motion';
    parts.push(`Motion treatment: ${motionDesc}.`);

    const wardrobeMap: Record<string, string> = {
      business: 'business and professional attire',
      casual: 'casual everyday clothing',
      travel: 'travel-ready outfits with backpacks or luggage',
      mixed: 'a balanced mix of business, casual, and travel attire',
    };
    parts.push(`Wardrobe direction: ${wardrobeMap[people.wardrobeStyle] || people.wardrobeStyle}.`);

    if (people.preserveExisting) {
      parts.push('Preserve existing people where possible, refining instead of replacing.');
    } else {
      parts.push('Allow replacing or removing existing people to achieve the desired result.');
    }
    if (people.matchLighting) {
      parts.push('Match scene lighting precisely on all people: intensity, direction, and color temperature.');
    }
    if (people.matchPerspective) {
      parts.push('Match camera perspective and lens distortion so people sit naturally in the scene.');
    }
    if (people.groundContact) {
      parts.push('Ensure perfect ground contact with correct shadows and no floating.');
    }
    if (people.removeArtifacts) {
      parts.push('Remove AI artifacts: extra limbs, warped faces, smeared textures, or inconsistent silhouettes.');
    }

    parts.push('Critical constraints: ONLY modify people. Do not change the building, landscape, vehicles, sky, or materials. Keep camera, perspective, and composition locked. Any edits must integrate seamlessly with the original render.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'sky') {
    parts.push('Replace the sky to transform the entire atmosphere and mood of this architectural scene.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const sky = workflow.visualSky;
    const skyPresets: Record<string, string> = {
      'clear': 'a pristine clear blue sky',
      'partly-cloudy': 'a dynamic sky with scattered clouds',
      'overcast': 'a soft, evenly overcast sky',
      'dramatic': 'a dramatic sky with striking cloud formations',
      'sunset': 'a warm, golden sunset sky',
      'sunrise': 'a fresh sunrise sky with delicate colors',
      'twilight': 'a dusky twilight sky transitioning between day and night',
      'night': 'a deep night sky',
      'stormy': 'a moody, stormy sky full of tension',
    };
    const skyDesc = skyPresets[sky.preset] || `a ${sky.preset} sky`;
    parts.push(`Create ${skyDesc}.`);

    const cloudDesc = sky.cloudDensity > 70 ? 'abundant, dramatic clouds' :
      sky.cloudDensity > 40 ? 'moderate cloud coverage' :
      sky.cloudDensity > 10 ? 'light, wispy clouds' : 'virtually no clouds';
    parts.push(`The sky should feature ${cloudDesc}.`);

    if (sky.atmosphere > 30) {
      const hazeDesc = sky.atmosphere > 60 ? 'significant atmospheric haze adding depth' : 'subtle atmospheric haze';
      parts.push(`Add ${hazeDesc}.`);
    }

    const brightnessDesc = sky.brightness > 70 ? 'bright and luminous' :
      sky.brightness > 40 ? 'naturally balanced' : 'subdued and moody';
    parts.push(`The overall sky brightness should be ${brightnessDesc}.`);

    if (sky.reflectInGlass) {
      parts.push('Reflect this new sky appropriately in any glass surfaces.');
    }
    if (sky.matchLighting) {
      parts.push('Adjust the scene lighting to match the new sky conditions.');
    }
    if (sky.sunFlare) {
      parts.push('Include a natural sun flare effect where appropriate.');
    }

    parts.push('The sky replacement affects the entire image. Constraints: only replace the sky and atmospheric elements. Preserve the precise building silhouettes, maintain accurate horizon alignment, and keep the foreground exposure consistent. Do not modify any geometry or add objects to the scene.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'remove') {
    parts.push('Cleanly remove the specified unwanted elements from this image, reconstructing the background naturally.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const remove = workflow.visualRemove;
    const modeDesc: Record<string, string> = {
      'object': 'specific objects that have been selected',
      'brush': 'areas painted with the removal brush',
      'auto': 'automatically detected unwanted elements',
    };
    parts.push(`Remove ${modeDesc[remove.mode] || 'the selected content'}.`);

    if (remove.quickRemove.length > 0) {
      parts.push(`Automatically detect and remove all instances of: ${remove.quickRemove.join(', ')} throughout the image.`);
    }

    if (remove.autoDetectEdges) {
      parts.push('Intelligently detect edges to ensure clean removal boundaries.');
    }
    if (remove.preserveStructure) {
      parts.push('Carefully preserve structural and architectural lines when reconstructing.');
    }

    parts.push('Constraints: remove only what is specified. Reconstruct the revealed background using materials, textures, and patterns consistent with the surrounding area. Maintain straight lines where architectural elements continue behind removed objects. Never remove structural or important architectural elements unless they are explicitly selected for removal.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'adjust') {
    parts.push('Apply precise color grading and tonal adjustments to this architectural image. Follow these exact numerical specifications (values range from -100 to +100 where 0 is neutral):');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const adjust = workflow.visualAdjust;

    // Helper to describe intensity with number
    const describeValue = (val: number, posDesc: string, negDesc: string) => {
      const sign = val > 0 ? '+' : '';
      return `${sign}${val} (${val > 0 ? posDesc : negDesc})`;
    };

    // Aspect ratio change
    if (adjust.aspectRatio && adjust.aspectRatio !== 'same') {
      parts.push(`[ASPECT RATIO] Change to ${adjust.aspectRatio}. Preserve composition and perspective. Prefer extending canvas with content-aware fill rather than cropping; if cropping is unavoidable, crop minimally without stretching.`);
    }

    // === BASIC TONE CURVE ===
    const toneChanges: string[] = [];
    if (adjust.exposure !== 0) {
      toneChanges.push(`Exposure: ${describeValue(adjust.exposure, 'brighter', 'darker')}`);
    }
    if (adjust.contrast !== 0) {
      toneChanges.push(`Contrast: ${describeValue(adjust.contrast, 'more punch/separation', 'flatter/softer')}`);
    }
    if (adjust.highlights !== 0) {
      toneChanges.push(`Highlights: ${describeValue(adjust.highlights, 'lift bright areas', 'recover/pull down bright areas')}`);
    }
    if (adjust.shadows !== 0) {
      toneChanges.push(`Shadows: ${describeValue(adjust.shadows, 'open up dark areas', 'deepen/crush dark areas')}`);
    }
    if (adjust.whites !== 0) {
      toneChanges.push(`Whites: ${describeValue(adjust.whites, 'expand white point', 'compress white point')}`);
    }
    if (adjust.blacks !== 0) {
      toneChanges.push(`Blacks: ${describeValue(adjust.blacks, 'lift blacks', 'crush to true black')}`);
    }
    if (adjust.gamma !== 0) {
      toneChanges.push(`Gamma: ${describeValue(adjust.gamma, 'brighten midtones', 'darken midtones')}`);
    }
    if (toneChanges.length > 0) {
      parts.push(`[TONE CURVE] ${toneChanges.join('; ')}.`);
    }

    // === COLOR ADJUSTMENTS ===
    const colorChanges: string[] = [];
    if (adjust.saturation !== 0) {
      colorChanges.push(`Saturation: ${describeValue(adjust.saturation, 'more vivid colors', 'toward monochrome')}`);
    }
    if (adjust.vibrance !== 0) {
      colorChanges.push(`Vibrance: ${describeValue(adjust.vibrance, 'boost muted colors', 'reduce muted colors')}`);
    }
    if (adjust.temperature !== 0) {
      colorChanges.push(`Temperature: ${describeValue(adjust.temperature, 'warmer/orange', 'cooler/blue')}`);
    }
    if (adjust.tint !== 0) {
      colorChanges.push(`Tint: ${describeValue(adjust.tint, 'toward magenta', 'toward green')}`);
    }
    if (adjust.hueShift !== 0) {
      const degrees = Math.round(adjust.hueShift * 1.8);
      colorChanges.push(`Hue Shift: ${degrees}° rotation on color wheel`);
    }
    if (colorChanges.length > 0) {
      parts.push(`[COLOR] ${colorChanges.join('; ')}.`);
    }

    // === DETAIL & PRESENCE ===
    const detailChanges: string[] = [];
    if (adjust.clarity !== 0) {
      detailChanges.push(`Clarity: ${describeValue(adjust.clarity, 'enhance local midtone contrast', 'soften local contrast')}`);
    }
    if (adjust.texture !== 0) {
      detailChanges.push(`Texture: ${describeValue(adjust.texture, 'enhance surface detail', 'smooth surfaces')}`);
    }
    if (adjust.dehaze !== 0) {
      detailChanges.push(`Dehaze: ${describeValue(adjust.dehaze, 'reduce atmospheric haze', 'add atmospheric haze')}`);
    }
    if (adjust.sharpness !== 0) {
      detailChanges.push(`Sharpness: ${describeValue(adjust.sharpness, 'sharpen edges', 'soften/blur')}`);
      if (adjust.sharpnessRadius !== 0) {
        detailChanges.push(`Sharpness Radius: ${adjust.sharpnessRadius} (${adjust.sharpnessRadius > 50 ? 'wide/large structures' : 'tight/fine details'})`);
      }
      if (adjust.sharpnessDetail !== 0) {
        detailChanges.push(`Sharpness Detail: ${adjust.sharpnessDetail} (${adjust.sharpnessDetail > 50 ? 'emphasize high-freq' : 'suppress noise'})`);
      }
      if (adjust.sharpnessMasking !== 0) {
        detailChanges.push(`Sharpness Masking: ${adjust.sharpnessMasking} (${adjust.sharpnessMasking > 50 ? 'edges only' : 'uniform'})`);
      }
    }
    if (detailChanges.length > 0) {
      parts.push(`[DETAIL/PRESENCE] ${detailChanges.join('; ')}.`);
    }

    // === NOISE REDUCTION ===
    const noiseChanges: string[] = [];
    if (adjust.noiseReduction !== 0) {
      noiseChanges.push(`Luminance NR: ${adjust.noiseReduction}%`);
    }
    if (adjust.noiseReductionColor !== 0) {
      noiseChanges.push(`Color NR: ${adjust.noiseReductionColor}%`);
    }
    if (adjust.noiseReductionDetail !== 0) {
      noiseChanges.push(`NR Detail Preservation: ${adjust.noiseReductionDetail}%`);
    }
    if (noiseChanges.length > 0) {
      parts.push(`[NOISE REDUCTION] ${noiseChanges.join('; ')}.`);
    }

    // === HSL PER-CHANNEL ADJUSTMENTS ===
    const hslChanges: string[] = [];
    const hslChannels = [
      { name: 'Reds', hue: adjust.hslRedsHue, sat: adjust.hslRedsSaturation, lum: adjust.hslRedsLuminance },
      { name: 'Oranges', hue: adjust.hslOrangesHue, sat: adjust.hslOrangesSaturation, lum: adjust.hslOrangesLuminance },
      { name: 'Yellows', hue: adjust.hslYellowsHue, sat: adjust.hslYellowsSaturation, lum: adjust.hslYellowsLuminance },
      { name: 'Greens', hue: adjust.hslGreensHue, sat: adjust.hslGreensSaturation, lum: adjust.hslGreensLuminance },
      { name: 'Aquas', hue: adjust.hslAquasHue, sat: adjust.hslAquasSaturation, lum: adjust.hslAquasLuminance },
      { name: 'Blues', hue: adjust.hslBluesHue, sat: adjust.hslBluesSaturation, lum: adjust.hslBluesLuminance },
      { name: 'Purples', hue: adjust.hslPurplesHue, sat: adjust.hslPurplesSaturation, lum: adjust.hslPurplesLuminance },
      { name: 'Magentas', hue: adjust.hslMagentasHue, sat: adjust.hslMagentasSaturation, lum: adjust.hslMagentasLuminance },
    ];
    for (const ch of hslChannels) {
      const changes: string[] = [];
      if (ch.hue !== 0) changes.push(`H:${ch.hue > 0 ? '+' : ''}${ch.hue}`);
      if (ch.sat !== 0) changes.push(`S:${ch.sat > 0 ? '+' : ''}${ch.sat}`);
      if (ch.lum !== 0) changes.push(`L:${ch.lum > 0 ? '+' : ''}${ch.lum}`);
      if (changes.length > 0) {
        hslChanges.push(`${ch.name}[${changes.join(',')}]`);
      }
    }
    if (hslChanges.length > 0) {
      parts.push(`[HSL COLOR TARGETING] Per-channel adjustments: ${hslChanges.join('; ')}.`);
    }

    // === COLOR GRADING (SPLIT TONING) ===
    const gradeChanges: string[] = [];
    if (adjust.colorGradeShadowsHue !== 0 || adjust.colorGradeShadowsSaturation !== 0) {
      gradeChanges.push(`Shadows: Hue=${adjust.colorGradeShadowsHue}°, Sat=${adjust.colorGradeShadowsSaturation}%`);
    }
    if (adjust.colorGradeMidtonesHue !== 0 || adjust.colorGradeMidtonesSaturation !== 0) {
      gradeChanges.push(`Midtones: Hue=${adjust.colorGradeMidtonesHue}°, Sat=${adjust.colorGradeMidtonesSaturation}%`);
    }
    if (adjust.colorGradeHighlightsHue !== 0 || adjust.colorGradeHighlightsSaturation !== 0) {
      gradeChanges.push(`Highlights: Hue=${adjust.colorGradeHighlightsHue}°, Sat=${adjust.colorGradeHighlightsSaturation}%`);
    }
    if (adjust.colorGradeBalance !== 0) {
      gradeChanges.push(`Balance: ${adjust.colorGradeBalance > 0 ? '+' : ''}${adjust.colorGradeBalance} (${adjust.colorGradeBalance > 0 ? 'bias highlights' : 'bias shadows'})`);
    }
    if (gradeChanges.length > 0) {
      parts.push(`[COLOR GRADING/SPLIT TONING] ${gradeChanges.join('; ')}.`);
    }

    // === EFFECTS ===
    const effects: string[] = [];
    if (adjust.vignette !== 0) {
      effects.push(`Vignette: ${adjust.vignette > 0 ? '+' : ''}${adjust.vignette} (${adjust.vignette > 0 ? 'darken corners' : 'brighten corners'}), Midpoint=${adjust.vignetteMidpoint}%, Roundness=${adjust.vignetteRoundness}, Feather=${adjust.vignetteFeather}%`);
    }
    if (adjust.grain !== 0) {
      effects.push(`Film Grain: Amount=${adjust.grain}%, Size=${adjust.grainSize}, Roughness=${adjust.grainRoughness}%`);
    }
    if (adjust.bloom !== 0) {
      effects.push(`Bloom/Glow: ${adjust.bloom}%`);
    }
    if (adjust.chromaticAberration !== 0) {
      effects.push(`Chromatic Aberration: ${adjust.chromaticAberration}%`);
    }
    if (effects.length > 0) {
      parts.push(`[EFFECTS] ${effects.join('; ')}.`);
    }

    // === TRANSFORM ===
    const transforms: string[] = [];
    if (adjust.transformRotate !== 0) {
      transforms.push(`Rotation: ${adjust.transformRotate.toFixed(1)}° (${adjust.transformRotate > 0 ? 'clockwise' : 'counter-clockwise'})`);
    }
    if (adjust.transformHorizontal !== 0) {
      transforms.push(`Horizontal Perspective: ${adjust.transformHorizontal > 0 ? '+' : ''}${adjust.transformHorizontal} (${adjust.transformHorizontal > 0 ? 'keystone right' : 'keystone left'})`);
    }
    if (adjust.transformVertical !== 0) {
      transforms.push(`Vertical Perspective: ${adjust.transformVertical > 0 ? '+' : ''}${adjust.transformVertical} (${adjust.transformVertical > 0 ? 'correct converging verticals upward' : 'keystone downward'})`);
    }
    if (adjust.transformDistortion !== 0) {
      transforms.push(`Lens Distortion: ${adjust.transformDistortion > 0 ? '+' : ''}${adjust.transformDistortion} (${adjust.transformDistortion > 0 ? 'barrel correction' : 'pincushion correction'})`);
    }
    if (adjust.transformPerspective !== 0) {
      transforms.push(`Perspective Depth: ${adjust.transformPerspective > 0 ? '+' : ''}${adjust.transformPerspective} (${adjust.transformPerspective > 0 ? 'increase depth' : 'flatten'})`);
    }
    if (transforms.length > 0) {
      parts.push(`[TRANSFORM/GEOMETRY] ${transforms.join('; ')}.`);
    }

    // === STYLE STRENGTH / GLOBAL INTENSITY ===
    const intensityPercent = Math.round(adjust.styleStrength);
    if (adjust.styleStrength !== 50) {
      parts.push(`[GLOBAL INTENSITY] Apply all above adjustments at ${intensityPercent}% strength (100%=full effect, 50%=normal, 0%=no effect). ${
        intensityPercent > 75 ? 'Bold, dramatic result expected.' :
        intensityPercent > 50 ? 'Slightly stronger than normal.' :
        intensityPercent > 25 ? 'Subtle, natural-looking adjustments.' :
        'Very subtle, barely perceptible changes.'
      }`);
    }

    // Final constraints
    parts.push(
      adjust.aspectRatio && adjust.aspectRatio !== 'same'
        ? '[CONSTRAINTS] Apply ONLY the specified color, tone, and adjustment parameters above. Do NOT add, remove, replace, or relocate any objects, people, or elements. Do NOT alter the architectural geometry, structure, or perspective beyond specified transform corrections. If a selection mask is active, limit ALL adjustments strictly to that masked region only, with smooth natural blending at edges.'
        : '[CONSTRAINTS] Apply ONLY the specified color, tone, and adjustment parameters above. Do NOT add, remove, replace, or relocate any objects, people, or elements. Do NOT alter the architectural geometry, structure, perspective, or crop/resize the image in any way. If a selection mask is active, limit ALL adjustments strictly to that masked region only, with smooth natural blending at edges.'
    );
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'extend') {
    parts.push('Extend this image beyond its current boundaries, seamlessly continuing the scene.');
    parts.push(...selectionParts);
    parts.push(describeUserIntent(userPrompt));

    const extend = workflow.visualExtend;
    const directionDesc: Record<string, string> = {
      'left': 'to the left',
      'right': 'to the right',
      'top': 'upward',
      'bottom': 'downward',
      'horizontal': 'horizontally on both sides',
      'vertical': 'vertically above and below',
      'all': 'in all directions',
    };

    if (extend.direction === 'none') {
      parts.push('No extension direction is specified - keep the image unchanged.');
      return parts.filter(Boolean).join(' ');
    }

    const amountDesc = extend.amount > 75 ? 'significantly' :
      extend.amount > 40 ? 'moderately' : 'slightly';
    parts.push(`Extend the canvas ${amountDesc} ${directionDesc[extend.direction] || extend.direction}.`);

    if (extend.targetAspectRatio !== 'custom') {
      parts.push(`Target a ${extend.targetAspectRatio} aspect ratio.`);
    } else {
      parts.push(`Target a ${extend.customRatio.width}:${extend.customRatio.height} aspect ratio.`);
    }

    if (extend.seamlessBlend) {
      parts.push('Ensure the new content blends seamlessly with existing pixels.');
    }
    if (extend.highDetail) {
      parts.push('Maintain high detail and quality in the extended areas.');
    }

    parts.push('Critical constraints: do not modify any existing pixels in the original image area. Only paint into the new canvas space, continuing the existing perspective lines, horizon placement, architectural materials, and lighting conditions seamlessly. Avoid duplicating, repeating, or warping elements from the original image.');
    return parts.filter(Boolean).join(' ');
  }

  if (tool === 'background') {
    parts.push('Replace the background of this architectural image while preserving the selected area completely untouched.');
    parts.push(...selectionParts);
    const background = workflow.visualBackground;
    const backgroundPrompt = background.prompt?.trim() || userPrompt;

    if (background.mode === 'image' && background.referenceImage) {
      parts.push('Background Reference: A reference image is provided showing the desired background environment.');
      parts.push('IMPORTANT: The selected area must remain COMPLETELY UNCHANGED - do not modify, retouch, or alter any pixels within the selection. Only replace the background around it.');

      if (background.referenceMode === 'absolute') {
        parts.push('Treat the reference image as the exact background to integrate into. Preserve its layout, horizon line, dominant elements, and overall composition. Do not introduce new background elements that conflict with the reference.');
      } else {
        parts.push('Use the reference image as creative guidance. Match its mood, palette, and environmental cues, but allow tasteful variation and creativity in the background.');
      }

      if (background.matchPerspective) {
        parts.push('Match the perspective and horizon line from the reference image, ensuring the background aligns naturally with the architectural elements in the preserved selection.');
      }

      if (background.matchLighting) {
        parts.push('Match the lighting conditions from the reference: time of day, sky conditions, ambient light color temperature, and shadow directions. The preserved selection should appear as if it was photographed in the reference environment.');
      }

      if (background.seamlessBlend) {
        parts.push('Create a seamless blend at the edges of the selection. The transition between the preserved area and new background must be natural and imperceptible, with proper atmospheric perspective and depth integration.');
      }

      if (background.preserveDepth) {
        parts.push('Maintain proper depth relationships. Apply appropriate atmospheric haze and desaturation to background elements based on their distance, ensuring the preserved selection appears naturally integrated into the space.');
      }

      parts.push('The final image must look like a single cohesive photograph where the preserved area naturally exists in the new background environment.');
    } else {
      if (backgroundPrompt) {
        parts.push(`Background direction: "${backgroundPrompt}".`);
      } else {
        parts.push('No background reference is provided. Apply a natural background replacement based on the context and user instructions.');
      }
    }

    const qualityDesc = background.quality === 'high' ? 'with maximum detail and photorealism' :
      background.quality === 'standard' ? 'with balanced quality' : 'with faster processing';
    parts.push(`Process ${qualityDesc}.`);

    parts.push('Critical constraints: ABSOLUTELY NO modifications to pixels within the selected area. Only replace the background. Ensure matching horizon lines, consistent color grading, unified atmospheric conditions, proper ground plane integration, and natural depth cues. The selection and new background must appear as a single unified photograph, never as a composite or collage.');
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
  const hasSourceImage = Boolean(state.sourceImage || state.uploadedImage);

  const parts: string[] = [];

  // Evocative opening based on CAD drawing type
  const cadTypeDescriptions: Record<string, string> = {
    'plan': 'Transform this architectural floor plan into a stunning visualization that brings the spatial layout to life',
    'section': 'Convert this architectural section drawing into a vivid visualization revealing the building\'s inner workings',
    'elevation': 'Render this elevation drawing into a photorealistic facade visualization',
    'site': 'Transform this site plan into an immersive bird\'s eye visualization of the development',
  };

  const projectionDescriptions: Record<string, string> = {
    plan: 'viewed directly from above in true orthographic projection',
    section: 'cut cleanly through the building to reveal its internal organization',
    elevation: 'viewed straight-on showing the true proportions of the facade',
    site: 'surveyed from directly overhead capturing the full site context',
  };

  parts.push(`${cadTypeDescriptions[workflow.cadDrawingType] || 'Create an architectural visualization from this CAD drawing'}, ${projectionDescriptions[workflow.cadDrawingType] || 'in orthographic projection'}.`);

  if (workflow.cadScale) {
    parts.push(`The drawing is prepared at ${workflow.cadScale} scale.`);
  }

  // Fidelity constraints in natural language
  parts.push('Treat the CAD drawing as the absolute source of truth. Every wall position, opening, grid line, and dimensional relationship must be preserved exactly. Do not rotate, skew, crop, or reframe the drawing in any way. No elements may be added, removed, or relocated. The viewpoint, horizon, and perspective must remain locked precisely as shown.');

  if (workflow.cadLayerDetectionEnabled && workflow.cadLayers?.length) {
    const visibleLayers = workflow.cadLayers.filter(layer => layer.visible).map(layer => layer.name);
    if (visibleLayers.length) {
      parts.push(`Focus on rendering these visible layers: ${visibleLayers.join(', ')}.`);
    }
  }

  // Space description
  const space = workflow.cadSpace;
  const roomDescriptions: Record<string, string> = {
    'living': 'a comfortable living space',
    'bedroom': 'a restful bedroom',
    'kitchen': 'a functional kitchen',
    'bathroom': 'a clean bathroom',
    'office': 'a productive office environment',
    'commercial': 'a professional commercial space',
    'retail': 'an inviting retail environment',
    'restaurant': 'a welcoming dining space',
  };
  parts.push(`This is ${roomDescriptions[space.roomType] || `a ${space.roomType}`}.`);

  const ceilingDescMap: Record<string, string> = {
    'flat': 'clean, flat ceilings',
    'coffered': 'elegant coffered ceilings',
    'exposed': 'honest exposed structure above',
    'beams': 'exposed ceiling beams adding character',
    'vaulted': 'dramatic vaulted ceilings',
  };
  const ceilingDesc = ceilingDescMap[space.ceilingStyle] || `${space.ceilingStyle} ceilings`;
  parts.push(`The space features ${ceilingDesc}, ${space.windowStyle} windows, and ${space.doorStyle} doors.`);

  if (hasSourceImage) {
    parts.push('The input image establishes the ground-truth for geometry and material choices.');
  }

  // Style
  if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      const atmosphereWords = style.promptBundle.renderingLanguage.atmosphere;
      parts.push(`Infuse the visualization with a feeling that is ${atmosphereWords.join(', ')}.`);
    }
  }

  // Camera in natural language
  const cam = workflow.cadCamera;
  const heightDesc = cam.height < 1.2 ? 'low, intimate viewpoint as if seated' :
    cam.height < 1.7 ? 'natural eye-level perspective' :
    cam.height < 2.5 ? 'slightly elevated viewpoint' : 'commanding elevated perspective';
  parts.push(`The view is captured from a ${heightDesc}, using ${describeLens(cam.focalLength)}.`);

  if (cam.position) {
    parts.push(`Camera position on plan: ${Math.round(cam.position.x)}% from left, ${Math.round(cam.position.y)}% from top.`);
  }

  const lookAtDesc: Record<string, string> = {
    n: 'looking north',
    ne: 'looking northeast',
    e: 'looking east',
    se: 'looking southeast',
    s: 'looking south',
    sw: 'looking southwest',
    w: 'looking west',
    nw: 'looking northwest',
  };
  if (cam.lookAt) {
    parts.push(`View direction is ${lookAtDesc[cam.lookAt] || `looking ${cam.lookAt}`}.`);
  }

  if (cam.verticalCorrection) {
    parts.push('Vertical lines are corrected to appear perfectly straight, as in professional architectural photography.');
  }

  // Furnishing description
  const furn = workflow.cadFurnishing;
  const occupancyDesc: Record<string, string> = {
    'empty': 'completely empty, showing pure architectural space',
    'minimal': 'minimally furnished with essential pieces only',
    'moderate': 'comfortably furnished with a lived-in feel',
    'full': 'fully furnished and styled for presentation',
  };
  parts.push(`The space is ${occupancyDesc[furn.occupancy] || furn.occupancy}.`);

  const clutterDesc = furn.clutter > 60 ? 'with realistic everyday items adding authenticity' :
    furn.clutter > 30 ? 'with tasteful accessories and details' : 'kept clean and uncluttered';
  parts.push(`Styling is ${clutterDesc}.`);

  if (furn.people) {
    const entourageDesc = furn.entourage < 30 ? 'a few people adding human scale' :
      furn.entourage < 70 ? 'people naturally occupying the space' :
      'a lively gathering of people bringing energy to the scene';
    parts.push(`Include ${entourageDesc}.`);
  }

  // Context
  const cadContext = workflow.cadContext;
  const envDesc: Record<string, string> = {
    'urban': 'an urban setting with city views beyond',
    'suburban': 'a peaceful suburban neighborhood',
    'rural': 'a serene rural landscape',
    'coastal': 'a beautiful coastal environment',
  };
  const seasonDesc: Record<string, string> = {
    'spring': 'fresh spring atmosphere with new growth',
    'summer': 'warm summer ambiance with full foliage',
    'autumn': 'rich autumn colors in the landscape',
    'winter': 'crisp winter setting',
  };
  parts.push(`Place this in ${envDesc[cadContext.environment] || `a ${cadContext.environment} environment`} with ${cadContext.landscape} landscaping and ${seasonDesc[cadContext.season] || `${cadContext.season} atmosphere`}.`);

  // Geometry rendering
  const geo = r3d.geometry;
  parts.push(`Render with ${describeEdgeMode(geo.edgeMode)} and ${describeLOD(geo.lod.level)}.`);

  const lodFeatures: string[] = [];
  if (geo.lod.preserveOrnaments) lodFeatures.push('decorative ornaments');
  if (geo.lod.preserveMoldings) lodFeatures.push('molding profiles');
  if (geo.lod.preserveTrim) lodFeatures.push('trim details');
  if (lodFeatures.length > 0) {
    parts.push(`Carefully preserve ${lodFeatures.join(', ')}.`);
  }

  if (geo.smoothing.enabled) {
    parts.push(`Apply ${describeSmoothing(geo.smoothing.intensity, geo.smoothing.preserveHardEdges)}.`);
  }

  if (geo.depthLayers.enabled) {
    parts.push(`Create ${describeDepthLayers(geo.depthLayers.foreground, geo.depthLayers.midground, geo.depthLayers.background)}.`);
  }

  // Lighting
  const light = r3d.lighting;
  parts.push(`The scene is bathed in ${formatTimePreset(light.preset)}.`);

  if (light.sun.enabled) {
    parts.push(`${describeSunPosition(light.sun.azimuth, light.sun.elevation)}, with ${describeSunIntensity(light.sun.intensity)} and ${describeColorTemperature(light.sun.colorTemp)}.`);
  }

  if (light.shadows.enabled) {
    parts.push(`Shadows are ${describeShadows(light.shadows.softness, light.shadows.intensity)}.`);
  }

  // Materials
  const mat = r3d.materials;
  const emphasis = getEmphasisMaterials(mat.emphasis);
  if (emphasis.length > 0) {
    parts.push(`Pay special attention to rendering the ${emphasis.join(', ')} with exceptional detail.`);
  }
  parts.push(`Surfaces exhibit ${describeReflectivity(mat.reflectivity)} and ${describeRoughness(mat.roughness)}.`);

  if (mat.weathering.enabled) {
    parts.push(`Materials show ${describeWeathering(mat.weathering.intensity)}.`);
  }

  // Atmosphere
  const atm = r3d.atmosphere;
  parts.push(`The overall atmosphere conveys ${describeAtmosphericMood(atm.mood, atm.temp)}.`);

  if (atm.fog.enabled) {
    parts.push(describeFog(atm.fog.density) + '.');
  }

  if (atm.bloom.enabled) {
    parts.push(`Highlights have ${describeBloom(atm.bloom.intensity)}.`);
  }

  // Scene elements
  const scene = r3d.scenery;
  if (scene.people.enabled) {
    parts.push(`${describePeopleActivity(scene.people.count)}.`);
  }
  if (scene.trees.enabled) {
    parts.push(`The landscaping features ${describeVegetation(scene.trees.count)}.`);
  }
  if (scene.cars.enabled) {
    parts.push('Vehicles are realistically placed in the scene.');
  }

  // Background Reference - Environment matching instruction
  if (workflow.backgroundReferenceEnabled && workflow.backgroundReferenceImage) {
    parts.push(`**Environment Reference (CRITICAL):** A reference photo showing the desired environment context is provided. IMPORTANT: Do NOT simply paste or composite the background behind the subject. Instead, use the reference to understand and recreate the environmental qualities: the time of day, sky conditions, ambient light color temperature, atmospheric haze and depth, weather mood, and overall color grading. The architecture must appear as if it was actually photographed in that environment - with matching shadow directions, consistent horizon line, natural atmospheric perspective (distant elements should have appropriate haze/desaturation), unified color palette, and seamless ground plane integration. The final image must look like a single cohesive photograph, not a collage.`);
  }

  // Output quality
  const rend = r3d.render;
  parts.push(`${describeResolution(rend.resolution)} ${describeAspectRatio(rend.aspectRatio)}, rendered with ${describeQuality(rend.quality)}.`);

  // Closing
  const qualityClosing = rend.resolution === '4k' || rend.resolution === 'print'
    ? 'The final image should reward close inspection, with every texture, reflection, and shadow rendered to perfection. This should be indistinguishable from professional architectural photography.'
    : 'Create a high-fidelity photorealistic visualization with believable materials, accurate lighting, and compelling spatial quality.';

  parts.push(qualityClosing);

  return parts.filter(p => p.trim()).join(' ');
}

function generateSketchPrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles } = state;
  const r3d = workflow.render3d;
  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';

  const parts: string[] = [];

  // Opening - describe the transformation
  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Transform this hand-drawn architectural sketch into a stunning photorealistic visualization that brings the designer\'s vision to life.');
  }

  // Sketch type description
  const sketchTypeDesc: Record<string, string> = {
    'concept': 'This is an early concept sketch capturing the initial design idea',
    'development': 'This is a development sketch showing refined design thinking',
    'presentation': 'This is a presentation-quality sketch ready for client visualization',
    'quick': 'This is a quick study sketch',
    'detailed': 'This is a detailed architectural sketch with careful linework',
  };
  parts.push(`${sketchTypeDesc[workflow.sketchType] || `This is a ${workflow.sketchType} sketch`}.`);

  // Perspective and composition constraints
  const perspDesc: Record<string, string> = {
    'one-point': 'one-point perspective with a central vanishing point',
    'two-point': 'two-point perspective with converging horizontals',
    'three-point': 'dramatic three-point perspective',
    'isometric': 'clean isometric projection',
    'axonometric': 'axonometric view',
  };
  parts.push(`The sketch uses ${perspDesc[workflow.sketchPerspectiveType] || workflow.sketchPerspectiveType}.`);

  // Main fidelity constraints in natural language
  parts.push('Treat this sketch as the sacred blueprint for composition and form. The viewpoint must remain exactly as drawn - no reframing, cropping, or rotation is permitted. Preserve the silhouette, proportions, and the position of every line. Only the surface materials, lighting quality, and photorealistic rendering may be enhanced.');

  if (workflow.sketchDetectedPerspective) {
    parts.push(`The detected perspective (${workflow.sketchDetectedPerspective}) must be matched precisely.`);
  }

  if (workflow.sketchVanishingPoints.length > 0) {
    parts.push('Maintain the exact vanishing points established in the sketch.');
  }

  if (!workflow.sketchAllowExtend) {
    parts.push('Do not extend the image beyond the original sketch boundaries.');
  }

  // Line quality interpretation
  const lineQualityDesc = workflow.sketchLineQuality > 80 ? 'exceptionally clean and confident' :
    workflow.sketchLineQuality > 60 ? 'clear and readable' :
    workflow.sketchLineQuality > 40 ? 'somewhat rough but interpretable' : 'rough and gestural';

  const completenessDesc = workflow.sketchCompleteness > 80 ? 'highly complete with most details defined' :
    workflow.sketchCompleteness > 60 ? 'substantially complete' :
    workflow.sketchCompleteness > 40 ? 'partially complete with areas left to interpretation' : 'sparse, leaving much to be imagined';

  parts.push(`The sketch linework is ${lineQualityDesc} and ${completenessDesc}.`);

  // Line processing in natural language
  const lineProcessing: string[] = [];
  if (workflow.sketchEnhanceFaint) lineProcessing.push('strengthen faint, tentative lines');
  if (workflow.sketchConnectLines) lineProcessing.push('intelligently connect broken line segments');
  if (workflow.sketchStraighten) lineProcessing.push('gently straighten wobbly hand-drawn lines');
  if (workflow.sketchRemoveConstruction) lineProcessing.push('ignore construction and guide lines');

  if (lineProcessing.length > 0) {
    parts.push(`When interpreting the sketch: ${lineProcessing.join(', ')}.`);
  }

  if (workflow.sketchPerspectiveCorrect) {
    const correctionStrength = workflow.sketchPerspectiveStrength > 70 ? 'strongly' :
      workflow.sketchPerspectiveStrength > 40 ? 'moderately' : 'subtly';
    parts.push(`${correctionStrength.charAt(0).toUpperCase() + correctionStrength.slice(1)} correct any perspective inconsistencies${workflow.sketchFixVerticals ? ', especially ensuring vertical lines are truly vertical' : ''}.`);
  }

  // Creative interpretation level
  const interpretationDesc = workflow.sketchInterpretation > 70 ? 'significant creative freedom to interpret ambiguous areas and add architectural details' :
    workflow.sketchInterpretation > 40 ? 'moderate creative license to fill in undefined areas while respecting the design intent' :
    'minimal interpretation, staying very close to what is explicitly drawn';
  parts.push(`Allow ${interpretationDesc}.`);

  // What to preserve
  const preserveElements: string[] = [];
  if (workflow.sketchPreserveOutline) preserveElements.push('the overall building outline and massing');
  if (workflow.sketchPreserveOpenings) preserveElements.push('the exact positions of windows and doors');
  if (workflow.sketchPreserveRoof) preserveElements.push('the roof form and profile');
  if (workflow.sketchPreserveFloors) preserveElements.push('the floor levels and horizontal datums');
  if (workflow.sketchPreserveProportions) preserveElements.push('the proportions and scale relationships');

  if (preserveElements.length > 0) {
    parts.push(`Strictly preserve ${preserveElements.join(', ')}.`);
  }

  // What creative additions are allowed
  const allowedVariations: string[] = [];
  if (workflow.sketchAllowDetails) allowedVariations.push('invent appropriate architectural details not shown in the sketch');
  if (workflow.sketchAllowMaterials) allowedVariations.push('select and render realistic material textures');
  if (workflow.sketchAllowEntourage) allowedVariations.push('add people, vegetation, and contextual elements');
  if (workflow.sketchAllowExtend) allowedVariations.push('extend the scene beyond the sketch boundaries where appropriate');

  if (allowedVariations.length > 0) {
    parts.push(`You may ${allowedVariations.join(', ')}.`);
  }

  // Ambiguity handling
  const ambiguityDesc: Record<string, string> = {
    'conservative': 'When encountering ambiguous areas, make conservative, safe interpretations that don\'t add unnecessary complexity',
    'neutral': 'Handle ambiguous areas with balanced judgment, neither too conservative nor too creative',
    'creative': 'Where the sketch is ambiguous, feel free to make creative decisions that enhance the architectural vision',
  };
  parts.push(`${ambiguityDesc[workflow.sketchAmbiguityMode] || 'Handle ambiguous areas thoughtfully'}.`);

  // Style
  if (!isNoStyle && style) {
    parts.push(style.description);
    if (style.promptBundle?.renderingLanguage?.atmosphere) {
      const atmosphereWords = style.promptBundle.renderingLanguage.atmosphere;
      parts.push(`Infuse the render with an atmosphere that feels ${atmosphereWords.join(', ')}.`);
    }
  }

  // Reference images
  if (workflow.sketchRefs.length > 0) {
    const counts = workflow.sketchRefs.reduce(
      (acc, ref) => {
        acc[ref.type] += 1;
        return acc;
      },
      { style: 0, material: 0, mood: 0 }
    );

    const refParts: string[] = [];
    if (counts.style > 0) refParts.push(`${counts.style} style reference${counts.style > 1 ? 's' : ''}`);
    if (counts.material > 0) refParts.push(`${counts.material} material reference${counts.material > 1 ? 's' : ''}`);
    if (counts.mood > 0) refParts.push(`${counts.mood} mood reference${counts.mood > 1 ? 's' : ''}`);

    const influenceDesc = workflow.sketchRefInfluence > 70 ? 'strongly' :
      workflow.sketchRefInfluence > 40 ? 'moderately' : 'subtly';
    parts.push(`Use the provided ${refParts.join(' and ')} to ${influenceDesc} guide the visualization.`);
  }

  if (workflow.sketchRefType === 'material') {
    parts.push(`Draw the material palette from the ${workflow.sketchMaterialPalette} collection.`);
  }
  if (workflow.sketchRefType === 'mood') {
    parts.push(`The overall mood should evoke ${workflow.sketchMoodPreset}.`);
  }

  // Render mode
  parts.push(describeRenderMode(workflow.renderMode));

  // Geometry rendering
  const geo = r3d.geometry;
  parts.push(`Render with ${describeEdgeMode(geo.edgeMode)} and ${describeLOD(geo.lod.level)}.`);

  const lodFeatures: string[] = [];
  if (geo.lod.preserveOrnaments) lodFeatures.push('decorative ornaments');
  if (geo.lod.preserveMoldings) lodFeatures.push('molding profiles');
  if (geo.lod.preserveTrim) lodFeatures.push('trim elements');
  if (lodFeatures.length > 0) {
    parts.push(`Pay special attention to ${lodFeatures.join(', ')}.`);
  }

  if (geo.smoothing.enabled) {
    parts.push(`Apply ${describeSmoothing(geo.smoothing.intensity, geo.smoothing.preserveHardEdges)}.`);
  }

  if (geo.depthLayers.enabled) {
    parts.push(`Create ${describeDepthLayers(geo.depthLayers.foreground, geo.depthLayers.midground, geo.depthLayers.background)}.`);
  }

  if (geo.displacement.enabled) {
    parts.push(`Add ${describeDisplacement(geo.displacement.scale, geo.displacement.strength, geo.displacement.adaptToMaterial)}.`);
  }

  // Lighting
  const light = r3d.lighting;
  parts.push(`Illuminate the scene with ${formatTimePreset(light.preset)}.`);

  if (light.sun.enabled) {
    parts.push(`${describeSunPosition(light.sun.azimuth, light.sun.elevation)}, casting ${describeSunIntensity(light.sun.intensity)} with ${describeColorTemperature(light.sun.colorTemp)}.`);
  }

  if (light.shadows.enabled) {
    parts.push(`Create ${describeShadows(light.shadows.softness, light.shadows.intensity)}.`);
  }

  // Camera
  const cam = r3d.camera;
  parts.push(`Render through ${describeLens(cam.lens)}, with ${describeFOV(cam.fov)}.`);

  if (cam.autoCorrect) {
    parts.push('Correct vertical lines to appear perfectly straight.');
  }

  if (cam.dof.enabled) {
    parts.push(`Apply ${describeDepthOfField(cam.dof.aperture, cam.dof.focusDist)}.`);
  }

  // Materials
  const mat = r3d.materials;
  const emphasizedMats = getEmphasisMaterials(mat.emphasis);
  if (emphasizedMats.length > 0) {
    parts.push(`Feature ${emphasizedMats.join(', ')} prominently in the material palette.`);
  }

  parts.push(`Surfaces should exhibit ${describeReflectivity(mat.reflectivity)} and ${describeRoughness(mat.roughness)}.`);

  if (mat.weathering.enabled) {
    parts.push(`Add ${describeWeathering(mat.weathering.intensity)}.`);
  }

  // Atmosphere
  const atm = r3d.atmosphere;
  parts.push(`The atmosphere should convey ${describeAtmosphericMood(atm.mood, atm.temp)}.`);

  if (atm.fog.enabled) {
    parts.push(describeFog(atm.fog.density) + '.');
  }

  if (atm.bloom.enabled) {
    parts.push(`Add ${describeBloom(atm.bloom.intensity)}.`);
  }

  // Context and scenery
  const scene = r3d.scenery;
  if (scene.people.enabled) {
    parts.push(`Populate the scene with ${describePeopleActivity(scene.people.count)}.`);
  }

  if (scene.trees.enabled) {
    parts.push(`Include ${describeVegetation(scene.trees.count)}.`);
  }

  if (scene.cars.enabled) {
    parts.push('Add realistically placed vehicles where appropriate.');
  }

  // Output quality
  const rend = r3d.render;
  parts.push(`${describeResolution(rend.resolution)} ${describeAspectRatio(rend.aspectRatio)}, with ${describeQuality(rend.quality)}.`);

  // Closing
  const qualityClosing = rend.resolution === '4k' || rend.resolution === 'print'
    ? 'The transformation should be magical - taking rough pencil strokes and breathing photorealistic life into them. Every texture should be believable, every shadow should feel real, and the final image should be worthy of the design vision captured in the original sketch.'
    : 'Transform this sketch into a compelling photorealistic visualization that honors the original design intent while bringing it to life with believable materials, realistic lighting, and professional quality.';

  parts.push(qualityClosing);

  return parts.filter(p => p.trim()).join(' ');
}

function generateUpscalePrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];
  const userPrompt = state.prompt?.trim();
  const outputResolution = state.output?.resolution?.toUpperCase?.() || '4K';
  const describeSlider = (value: number, low: string, high: string) => {
    if (value <= 20) return `${low} (very low)`;
    if (value <= 40) return `${low} (low)`;
    if (value <= 60) return 'balanced';
    if (value <= 80) return `${high} (high)`;
    return `${high} (very high)`;
  };

  parts.push('Ultra-premium cinematic enhancement and extreme-resolution upscaling with absolute content preservation.');
  parts.push('The input image is the single, immutable source of truth.');
  parts.push(`Target upscale factor: ${workflow.upscaleFactor}.`);
  parts.push('Upscaler control settings (must be reflected in the result):');
  parts.push(`Output resolution target: ${outputResolution}.`);
  parts.push(`Sharpness: ${workflow.upscaleSharpness}/100 (${describeSlider(workflow.upscaleSharpness, 'soft', 'crisp')}).`);
  parts.push(`Clarity: ${workflow.upscaleClarity}/100 (${describeSlider(workflow.upscaleClarity, 'low', 'high')}).`);
  parts.push(`Edge definition: ${workflow.upscaleEdgeDefinition}/100 (${describeSlider(workflow.upscaleEdgeDefinition, 'soft', 'sharp')}).`);
  parts.push(`Fine detail: ${workflow.upscaleFineDetail}/100 (${describeSlider(workflow.upscaleFineDetail, 'smooth', 'detailed')}).`);

  if (userPrompt) {
    parts.push(`User notes: ${userPrompt}.`);
  }

  parts.push('1. ABSOLUTE CONTENT & FRAME LOCK -- NON-NEGOTIABLE');
  parts.push('Preserve the original image exactly as it is, edge to edge.');
  parts.push('No cropping, no zooming, no shifting, no reframing.');
  parts.push('No aspect-ratio changes.');
  parts.push('Composition, perspective, and camera position are fully locked.');
  parts.push('Do not add, remove, replace, or reinterpret anything:');
  parts.push('No new or missing people.');
  parts.push('No altered architecture or geometry.');
  parts.push('No substituted materials.');
  parts.push('All proportions, spacing, and relationships must remain pixel-identical to the source image.');

  parts.push('2. RESOLUTION & PERCEPTUAL DETAIL -- PUSH TO THE LIMIT');
  parts.push('Upscale to true ultra-HD clarity (8K-12K perceptual detail).');
  parts.push('Every edge must be surgically sharp and perfectly clean.');
  parts.push('Fine lines, joints, seams, and structural details must read clearly, even at distance.');
  parts.push('Zero blur, zero softness, zero noise, zero compression artifacts.');
  parts.push('The image should feel as if it were rendered with infinite samples and flawless precision.');

  parts.push('3. VISUAL GOAL -- "CINEMATIC FUTURE REALISM"');
  parts.push('Aim for a flagship sci-fi airport terminal look:');
  parts.push('High-budget cinematic realism.');
  parts.push('Competition-grade architectural visualization.');
  parts.push('Hyper-real and physically plausible.');
  parts.push('Not stylized. Not painterly. Not cartoonish.');
  parts.push('More real than reality -- but never fake.');

  parts.push('4. LIFE & MICRO-DETAILS -- THIS IS CRITICAL');
  parts.push('Small elements are what make the scene feel alive.');
  parts.push('Enhance them carefully, without changing or inventing anything:');
  parts.push('Trees & vegetation: clearer silhouettes, refined leaves, natural depth and layering.');
  parts.push('People: crisp outlines, readable posture, natural scale -- no smoothing or distortion.');
  parts.push('Cars & vehicles: sharper body lines, cleaner reflections, readable details.');
  parts.push('Planes & distant objects: enhanced clarity and definition, not exaggerated scale.');
  parts.push('Street elements (signage, lights, markings): legible, precise, and grounded.');
  parts.push('Nothing new is added -- only clarity, presence, and realism are increased.');

  parts.push('5. COLOR & CINEMATIC ENERGY');
  parts.push('Elevate the image with controlled cinematic richness:');
  parts.push('Selective, intelligent saturation -- never flat, never overdone.');
  parts.push('Whites should feel clean, luminous, and premium.');
  parts.push('Shadows should be deep but detailed, never crushed.');
  parts.push('Strong local contrast to separate forms and layers.');
  parts.push('Use subtle glow only where physically justified (lighting, glass, reflections).');
  parts.push('The image should feel vibrant, alive, and high-end -- not neutral or dull.');

  parts.push('6. LIGHTING -- INTENTIONAL & ART-DIRECTED');
  parts.push('Lighting must feel designed, not accidental:');
  parts.push('Balanced exposure across the entire frame.');
  parts.push('Clear depth separation: foreground, midground, background.');
  parts.push('Materials must read cleanly under light -- no muddy or flat surfaces.');

  parts.push('7. MATERIAL & SURFACE FIDELITY -- CRITICAL FOR ARCHITECTURAL PRESENTATIONS');
  parts.push('ABSOLUTE PRIORITY: PRESERVE ORIGINAL MATERIAL COLORS AND TEXTURES EXACTLY AS THEY APPEAR.');
  parts.push('Materials define the architectural design -- any change to color or texture destroys the presentation.');
  parts.push('');
  parts.push('MANDATORY COLOR PRESERVATION:');
  parts.push('The exact color of every material MUST be retained pixel-perfect.');
  parts.push('No color shifts, no tint changes, no saturation adjustments to materials.');
  parts.push('No warming or cooling of material colors.');
  parts.push('No color "corrections" or "improvements" to materials.');
  parts.push('If a material is beige, it stays beige. If it is grey, it stays grey. If it is white, it stays white.');
  parts.push('Color accuracy is non-negotiable -- match the source image exactly.');
  parts.push('');
  parts.push('MANDATORY TEXTURE PRESERVATION:');
  parts.push('The exact texture pattern of every material MUST be retained exactly.');
  parts.push('No texture substitution, no pattern changes, no detail invention.');
  parts.push('Grain direction, pattern scale, and texture rhythm must match the original precisely.');
  parts.push('Do not add texture detail where none exists -- only sharpen what is already there.');
  parts.push('Do not smooth or simplify existing textures.');
  parts.push('');
  parts.push('WHERE MATERIALS ARE CLEARLY VISIBLE:');
  parts.push('Color and texture are LOCKED -- absolutely zero modifications allowed.');
  parts.push('The exact appearance of applied materials is sacred -- this is architectural presentation work.');
  parts.push('Only enhance sharpness and resolution -- never change color, texture, or finish.');
  parts.push('Think: "I am scanning this at higher resolution, not redesigning it."');
  parts.push('');
  parts.push('WHERE MATERIALS ARE DIFFICULT TO RECOGNIZE (blurry, distant, or unclear):');
  parts.push('You may make small modifications only if absolutely necessary for clarity.');
  parts.push('Stay as close to the original color and texture as humanly possible.');
  parts.push('Match the approximate color tone, texture pattern, and surface character visible in the original.');
  parts.push('When in doubt, preserve rather than enhance -- better slightly blurry than wrong.');
  parts.push('');
  parts.push('MATERIAL-SPECIFIC GUIDELINES:');
  parts.push('Metal: preserve exact color (grey/bronze/black/etc.), exact finish (brushed/polished/matte), reflection character.');
  parts.push('Glass: maintain exact transparency level, exact tint color, and reflection properties.');
  parts.push('Wood: preserve exact wood tone, exact grain pattern, exact finish without adding or removing detail.');
  parts.push('Stone/Concrete: maintain exact color, exact texture pattern, exact surface character.');
  parts.push('Floors: preserve exact material color, exact texture, exact polish level, exact reflection characteristics.');
  parts.push('Fabrics/Textiles: maintain exact color, exact weave pattern, exact surface texture without invention.');
  parts.push('Paint/Coatings: preserve exact color and exact finish (matte/satin/gloss) as shown.');
  parts.push('Skin & clothing: crisp silhouettes, natural texture, no AI smearing.');
  parts.push('');
  parts.push('REMEMBER: The materials shown were carefully selected by architects and designers.');
  parts.push('Your job is to upscale, not to redesign. Preserve color and texture with absolute fidelity.');

  parts.push('8. STRICT ANTI-AI RULES');
  parts.push('Do not hallucinate or invent details.');
  parts.push('Do not introduce textures, objects, or people.');
  parts.push('If something is unclear, improve clarity, not content.');
  parts.push('No painterly effects, no fantasy lighting, no AI artifacts.');

  parts.push('FINAL QUALITY BAR');
  parts.push('The final image must look like:');
  parts.push('A hero shot from a top-tier sci-fi architectural competition.');
  parts.push('A magazine-cover-ready, print-grade visualization.');
  parts.push('It should make viewers think: "This looks impossibly sharp, alive, and premium."');

  parts.push('OVERRIDING RULE');
  parts.push('If there is ever a conflict between enhancement and preservation: PRESERVE THE IMAGE EXACTLY AS PROVIDED. ALWAYS.');
  parts.push('This is super important, when i zoom in i want to be able to see every detail.');

  return parts.filter(p => p.trim()).join('\n');
}

function generateImageTo3DPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];
  const inputs = workflow.img3dInputs || [];
  const primary = inputs.find((input) => input.isPrimary);
  const hasSourceImage = Boolean(state.sourceImage || state.uploadedImage);
  const userPrompt = state.prompt?.trim();

  // Evocative opening
  const inputCount = inputs.length;
  const inputDesc = inputCount === 1 ? 'a single reference image' :
    inputCount <= 3 ? `${inputCount} reference views` : `${inputCount} comprehensive reference views`;

  parts.push(`Reconstruct a detailed 3D architectural model from ${inputDesc}, accurately capturing the building\'s form, proportions, and spatial qualities.`);

  if (userPrompt) {
    parts.push(`Specific guidance: ${userPrompt}.`);
  }

  // Describe input views
  if (inputs.length > 0) {
    const viewDescriptions = inputs.slice(0, 6).map((input, index) => {
      const label = input.view?.trim() || `view ${index + 1}`;
      return input.isPrimary ? `${label} (primary reference)` : label;
    });
    parts.push(`Working from ${viewDescriptions.join(', ')}${inputs.length > 6 ? ' and additional views' : ''}.`);

    if (primary?.view) {
      parts.push(`The ${primary.view} view serves as the primary reference and should be given priority when resolving any ambiguities between views.`);
    }
  }

  // Output format description
  const formatDesc: Record<string, string> = {
    'obj': 'a universally compatible OBJ format',
    'fbx': 'FBX format for seamless integration with professional 3D software',
    'gltf': 'efficient glTF format optimized for real-time viewing',
    'usd': 'USD format for pipeline integration',
  };
  parts.push(`Export the model in ${formatDesc[workflow.img3dOutputFormat.toLowerCase()] || `${workflow.img3dOutputFormat} format`}.`);

  // Texture handling
  if (workflow.img3dIncludeTextures) {
    parts.push('Generate clean, well-organized UV maps with consistent albedo textures. Avoid visible seams at UV boundaries, texture stretching, or mismatched scale between different parts of the model. Textures should accurately represent the materials visible in the reference images.');
  } else {
    parts.push('Focus on creating clean, accurate geometry without fabricating textures. Organize the model with logical material groups that can be textured later, but do not invent surface details not clearly visible in the references.');
  }

  // Constraints in natural language
  if (hasSourceImage) {
    parts.push('The reference images establish the ground truth for appearance, proportions, and architectural character.');
  }

  parts.push('Create a single, coherent 3D model that reconciles all provided views. When views show conflicting information, prioritize the primary reference view. Maintain accurate overall scale, proper vertical alignment (walls should be truly vertical), and correct building proportions. Keep walls straight, edges crisp, and surfaces flat where they should be flat.');

  parts.push('Model all visible openings including doors and windows with accurate proportions and placement. Do not invent architectural elements, structures, or props that are not clearly visible in the references. Where the building is occluded or unclear, make conservative assumptions that maintain architectural continuity and structural logic.');

  parts.push('Produce clean topology suitable for export and further use. The mesh should be watertight where architecturally appropriate, without floating geometry, self-intersections, or other artifacts. Preserve the key silhouette and important facade details that define the building\'s character.');

  return parts.filter(p => p.trim()).join(' ');
}

function generateMultiAnglePrompt(state: AppState): string {
  const { workflow, activeStyleId, customStyles, lighting, context, camera } = state;
  const parts: string[] = [];
  const availableStyles = [...BUILT_IN_STYLES, ...(customStyles ?? [])];
  const style = availableStyles.find(s => s.id === activeStyleId);
  const isNoStyle = style?.id === 'no-style';
  const hasSourceImage = Boolean(state.sourceImage || state.uploadedImage);

  // Evocative opening (single view)
  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Generate a single photorealistic architectural view of the subject at the specified camera angle.');
  }

  // Preset descriptions (single view guidance)
  const presetDescriptions: Record<string, string> = {
    turntable: 'Use a turntable-style viewpoint around the building, orbiting at a fixed distance and steady eye level.',
    architectural: 'Capture the building from a professional architectural photography angle at eye level, keeping vertical lines perfectly straight.',
    'birds-eye': 'View the building from an elevated angle that reveals the roof forms, site relationships, and overall massing.',
    custom: 'Follow the precisely specified camera position and angle.',
  };
  parts.push(presetDescriptions[workflow.multiAnglePreset] || '');

  // Style
  if (!isNoStyle && style) {
    parts.push(`Render all views in the ${style.name} style.`);
    if (style.description) {
      parts.push(style.description);
    }
    if (style.promptBundle) {
      const vocab = style.promptBundle.architectureVocabulary || [];
      const mats = style.promptBundle.materialBias || {};
      if (vocab.length > 0) {
        parts.push(`The architecture should express ${vocab.slice(0, 3).join(', ')}.`);
      }
      const primaryMats = mats.primary || [];
      if (primaryMats.length > 0) {
        parts.push(`Feature materials including ${primaryMats.join(', ')}.`);
      }
    }
  }

  // Lighting description
  const timeDesc: Record<string, string> = {
    'dawn': 'soft early morning light',
    'morning': 'fresh morning sunlight',
    'noon': 'midday sun',
    'afternoon': 'warm afternoon light',
    'golden-hour': 'rich golden hour illumination',
    'sunset': 'dramatic sunset colors',
    'dusk': 'fading twilight',
    'night': 'nighttime illumination',
  };
  const weatherDesc: Record<string, string> = {
    'clear': 'under clear skies',
    'partly-cloudy': 'with scattered clouds',
    'overcast': 'under soft overcast conditions',
    'stormy': 'with dramatic storm clouds',
  };
  parts.push(`Illuminate this view with ${timeDesc[lighting.timeOfDay] || lighting.timeOfDay} ${weatherDesc[lighting.weather] || ''}, with ${lighting.cloudType} cloud formations.`);

  // Context
  if (context.vegetation) {
    const vegDesc = context.vegetationDensity > 50 ? 'lush, abundant' : 'tasteful, restrained';
    parts.push(`Surround the building with ${vegDesc} ${context.season} landscaping.`);
  }
  if (context.people) {
    parts.push('Include people to provide human scale and life to the scenes.');
  }

  // Camera
  parts.push(`Use ${camera.viewType} framing with ${camera.projection} projection.`);

  // Consistency constraints
  if (hasSourceImage) {
    parts.push('The reference image establishes the exact subject, scale, and material appearance that must be maintained across all views.');
  }

  parts.push('Critical consistency requirements: The building must be identical across the multi-angle set - same geometry, same proportions, same materials, same colors. Only the camera angle changes. Maintain consistent focal length, lens characteristics, and relative scale so the building appears the same size regardless of angle.');

  if (workflow.multiAngleLockConsistency) {
    parts.push('Lock all environmental factors across the multi-angle set: same lighting direction, same exposure level, same weather, same time of day, same color grading, same background and sky. The only difference between views should be the camera position.');
  } else {
    parts.push('Maintain consistent materials and overall style. Allow only the natural, subtle lighting variations that would occur from viewing the same scene at different angles (different shadows, slightly different sky appearance).');
  }

  parts.push('Do not add, remove, or swap any objects, vegetation, vehicles, or people between views. Every element that appears in one view must appear identically in all views, only seen from a different angle.');

  return parts.filter(p => p.trim()).join(' ');
}

const formatYesNo = (value: boolean) => (value ? 'yes' : 'no');

function generateMasterplanPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  // Evocative opening
  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    const planTypeDescriptions: Record<string, string> = {
      site: 'Create a compelling site plan visualization that clearly communicates the development layout and spatial relationships',
      urban: 'Generate an urban masterplan visualization showing the broader district context and city fabric',
      zoning: 'Produce a clear zoning diagram that effectively communicates land use designations and boundaries',
      massing: 'Create a massing study visualization that reveals the volumetric relationships between buildings',
    };
    parts.push(`${planTypeDescriptions[workflow.mpPlanType] || 'Create a masterplan visualization'}.`);
  }

  // Scale context
  const scaleValue = workflow.mpScale === 'custom' ? `1:${workflow.mpCustomScale}` : workflow.mpScale;
  const scaleDesc = scaleValue.includes('500') ? 'detailed site scale' :
    scaleValue.includes('1000') ? 'neighborhood scale' :
    scaleValue.includes('2500') ? 'district scale' : `${scaleValue} scale`;
  parts.push(`Render at ${scaleDesc} with north oriented ${Math.round(workflow.mpNorthRotation) === 0 ? 'to the top of the image' : `${Math.round(workflow.mpNorthRotation)} degrees from vertical`}.`);

  // Fidelity constraints
  const boundaryMode = workflow.mpBoundary?.mode || 'auto';
  parts.push('If a masterplan drawing is provided as input, treat it as the authoritative layout. Preserve every site boundary, parcel edge, road alignment, water feature, and building footprint exactly as shown. Do not rotate, mirror, or reframe the plan. Enhancement should be limited to presentation styling, landscaping visualization, labels, and legend elements.');

  if (boundaryMode === 'custom') {
    parts.push('Respect the custom site boundary exactly as defined.');
  }

  // Output style
  const styleDescriptions: Record<string, string> = {
    'realistic': 'Render in a realistic aerial photography style with natural materials, shadows, and textures',
    'illustrative': 'Create an elegant illustrative style with stylized graphics and clear visual hierarchy',
    'diagrammatic': 'Produce a clean diagrammatic representation optimized for clarity and information',
    'watercolor': 'Render in a soft watercolor aesthetic appropriate for presentation boards',
  };
  parts.push(`${styleDescriptions[workflow.mpOutputStyle] || `Use ${workflow.mpOutputStyle} styling`}.`);

  // View angle
  if (workflow.mpViewAngle === 'custom') {
    const perspDesc = workflow.mpViewCustom.perspective > 50 ? 'with noticeable perspective depth' : 'with minimal perspective distortion';
    parts.push(`View the plan from an elevated angle ${perspDesc}.`);
  } else {
    const viewDescriptions: Record<string, string> = {
      'top-down': 'View directly from above in true plan view',
      'axon': 'Present in axonometric projection revealing building heights while maintaining measurability',
      'perspective': 'Use a gentle aerial perspective that adds depth while keeping the plan readable',
    };
    parts.push(`${viewDescriptions[workflow.mpViewAngle] || workflow.mpViewAngle}.`);
  }

  // Buildings
  const buildings = workflow.mpBuildings;
  const buildingStyleDesc: Record<string, string> = {
    'massing': 'as simple volumetric masses focusing on form and scale',
    'detailed': 'with detailed facades and architectural character',
    'schematic': 'as schematic blocks with clear footprints',
    'realistic': 'with realistic materials and architectural detail',
  };
  parts.push(`Render buildings ${buildingStyleDesc[buildings.style] || `in ${buildings.style} style`}.`);

  const heightDesc = buildings.heightMode === 'vary'
    ? `Heights should vary naturally between ${buildings.heightRange.min}m and ${buildings.heightRange.max}m to create a dynamic skyline`
    : buildings.heightMode === 'from-color'
      ? 'Building heights should be derived from the color coding in the source'
      : `Buildings should be rendered at a uniform ${buildings.defaultHeight}m height`;
  parts.push(`${heightDesc}, with ${buildings.roofStyle} roof forms.`);

  if (buildings.showShadows) {
    parts.push('Cast realistic shadows to communicate building heights and sun position.');
  }
  if (buildings.transparent) {
    parts.push('Render buildings with some transparency to reveal ground-level activity beneath.');
  }
  if (buildings.facadeVariation) {
    parts.push('Add subtle facade variations to differentiate individual buildings.');
  }

  // Landscape
  const landscape = workflow.mpLandscape;
  const seasonDesc: Record<string, string> = {
    'spring': 'fresh spring colors with new growth',
    'summer': 'lush summer foliage at full density',
    'autumn': 'warm autumn tones with changing leaves',
    'winter': 'sparse winter vegetation',
  };
  parts.push(`Show ${seasonDesc[landscape.season] || landscape.season} landscaping.`);

  const vegDensityDesc = landscape.vegetationDensity > 70 ? 'abundant, park-like' :
    landscape.vegetationDensity > 40 ? 'balanced' : 'minimal, urban';
  parts.push(`The vegetation should be ${vegDensityDesc} in character.`);

  const landscapeFeatures: string[] = [];
  if (landscape.trees) landscapeFeatures.push('mature trees providing canopy');
  if (landscape.grass) landscapeFeatures.push('manicured lawns and green spaces');
  if (landscape.water) landscapeFeatures.push('water features and bodies');
  if (landscape.pathways) landscapeFeatures.push('pedestrian paths and walkways');
  if (landscape.streetFurniture) landscapeFeatures.push('street furniture and urban amenities');
  if (landscape.vehicles) landscapeFeatures.push('parked vehicles indicating activity');
  if (landscape.people) landscapeFeatures.push('people animating public spaces');

  if (landscapeFeatures.length > 0) {
    parts.push(`Include ${landscapeFeatures.join(', ')}.`);
  }

  // Annotations
  const annotations = workflow.mpAnnotations;
  const annotationElements: string[] = [];
  if (annotations.zoneLabels) annotationElements.push('clear zone labels');
  if (annotations.streetNames) annotationElements.push('street names');
  if (annotations.buildingLabels) annotationElements.push('building identifiers');
  if (annotations.lotNumbers) annotationElements.push('lot numbers');
  if (annotations.scaleBar) annotationElements.push('a graphic scale bar');
  if (annotations.northArrow) annotationElements.push('a north arrow');
  if (annotations.dimensions) annotationElements.push('key dimensions');
  if (annotations.areaCalc) annotationElements.push('area calculations');
  if (annotations.contourLabels) annotationElements.push('topographic contour labels');

  if (annotationElements.length > 0) {
    parts.push(`Add ${annotationElements.join(', ')} using ${annotations.labelStyle} typography that is legible and professional.`);
  }

  // Legend
  const legend = workflow.mpLegend;
  if (legend.include) {
    const legendElements: string[] = [];
    if (legend.showZones) legendElements.push('land use zones');
    if (legend.showZoneAreas) legendElements.push('zone areas');
    if (legend.showBuildings) legendElements.push('building types');
    if (legend.showLandscape) legendElements.push('landscape elements');
    if (legend.showInfrastructure) legendElements.push('infrastructure');

    if (legendElements.length > 0) {
      parts.push(`Include a ${legend.style} legend in the ${legend.position} showing ${legendElements.join(', ')}.`);
    }
  }

  // Context
  if (workflow.mpContext?.location) {
    parts.push(`This development is located in ${workflow.mpContext.location}.`);
  }

  // Quality closing
  parts.push('The final visualization should be presentation-ready, communicating the design intent clearly while being visually compelling.');

  return parts.filter(Boolean).join(' ');
}

function generateExplodedPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  // Evocative opening
  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Create a compelling exploded axonometric view that reveals the building\'s construction logic, showing how individual components and systems come together to form the whole.');
  }

  // Fidelity constraints
  parts.push('Treat the input model as the definitive source for all geometry. Each component must maintain its exact shape, scale, and internal alignment. Separate the parts only along the specified explosion axis without introducing any rotation, distortion, or scaling changes. Do not add or remove any components. Keep the camera framing consistent with the source view.');

  // Explosion direction
  const directionDesc: Record<string, string> = {
    'vertical': 'Separate the building layers vertically, lifting floor plates, roof, and systems upward to reveal the stacking logic',
    'horizontal': 'Pull components apart horizontally to show how the building assembles from side to side',
    'radial': 'Explode components outward from the center, revealing the core and peripheral relationships',
    'custom': 'Separate components along the specified custom axis',
  };
  parts.push(`${directionDesc[workflow.explodedDirection] || `Explode ${workflow.explodedDirection}`}.`);

  // Separation amount
  const separationDesc = workflow.explodedView.separation > 100 ? 'generous spacing that clearly separates each component' :
    workflow.explodedView.separation > 50 ? 'moderate spacing for clear component identification' :
    'tight spacing that maintains spatial relationships while revealing connections';
  parts.push(`Use ${separationDesc}.`);

  // View description
  const view = workflow.explodedView;
  if (view.type === 'axon') {
    const angleDesc: Record<string, string> = {
      'isometric': 'true isometric projection with equal foreshortening on all axes',
      '30-60': 'a 30-60 axonometric that emphasizes one facade',
      '45-45': 'a balanced 45-45 axonometric showing two facades equally',
      'military': 'military projection preserving true plan dimensions',
    };
    parts.push(`Present the exploded view in ${angleDesc[view.angle] || `${view.angle} axonometric projection`}.`);
  } else {
    const heightDesc = view.cameraHeight < 5 ? 'intimate, low angle' :
      view.cameraHeight < 15 ? 'comfortable eye-level perspective' : 'elevated overview';
    parts.push(`View the exploded assembly from a ${heightDesc}, with a field of view that captures all components in context.`);
  }

  // Dissection style (make this highly specific to avoid similar results)
  const style = workflow.explodedStyle;
  const dissectionDesc: Record<string, string[]> = {
    'stacked': [
      'Dissection style: stacked layers.',
      'Split the building into clear horizontal strata (foundation/core, floor plates, roof, and major systems).',
      'Keep every layer perfectly aligned on a single vertical axis with equal, consistent spacing.',
      'No rotation or lateral drift; the stack should read as a clean vertical assembly diagram.'
    ],
    'radial': [
      'Dissection style: radial burst.',
      'Explode all components outward from the geometric center in 360° while keeping their original orientation.',
      'Maintain a fixed core at the center and place components on concentric rings with increasing radius.',
      'The layout should feel like a starburst diagram with clear radial gaps between parts.'
    ],
    'sequential': [
      'Dissection style: sequential assembly.',
      'Lay components along a single primary axis in a strict order of assembly (start → finish).',
      'Use progressive spacing so the order is unambiguous, like frames in an assembly timeline.',
      'Keep components aligned to the axis with no rotation; the sequence should read left-to-right or bottom-to-top.'
    ],
    'core-shell': [
      'Dissection style: core-shell separation.',
      'Keep the structural core fixed and separate the envelope and roof as distinct shells around it.',
      'Pull the facade and roof outward evenly, preserving their alignment to the core.',
      'The result should clearly show the relationship between core, interior, and envelope layers.'
    ],
    'slice': [
      'Dissection style: slice-lift.',
      'Cut the building into a small number of thick slices (3-6) perpendicular to the main axis.',
      'Lift or offset each slice evenly while preserving perfect registration between slices.',
      'The slices should read like clean cross-sections with visible cut faces.'
    ],
    'systems': [
      'Dissection style: systems separation.',
      'Group components by system (structure, envelope, MEP, interior) and separate each group into its own band.',
      'Keep parts within each system tightly clustered and aligned, with clear gaps between systems.',
      'The diagram should read as distinct system layers rather than individual parts scattered evenly.'
    ],
  };
  const dissection = dissectionDesc[style.render] || [`Dissection style: ${style.render}.`];
  parts.push(...dissection);

  // Color treatment
  const colorDesc: Record<string, string> = {
    'material': 'Color each component according to its actual material appearance',
    'system': 'Use a color-coding scheme to differentiate building systems',
    'monochrome': 'Keep the palette monochromatic to emphasize form over material',
    'white': 'Render all components in clean white to create a pure massing study',
  };
  parts.push(`${colorDesc[style.colorMode] || `Use ${style.colorMode} coloring`}.`);

  // Edge treatment
  const edgeStyleDesc: Record<string, string> = {
    'hidden-removed': 'clean edges with hidden lines removed for clarity',
    'hidden-dashed': 'technical style with hidden lines shown as dashes',
    'all-visible': 'all edges visible for complete structural understanding',
    'silhouette': 'bold silhouette edges emphasizing overall form',
  };
  const edgeDesc = edgeStyleDesc[style.edgeStyle] || `${style.edgeStyle} edge treatment`;
  const weightDesc = style.lineWeight > 2 ? 'bold line weights for clear hierarchy' :
    style.lineWeight < 1 ? 'delicate line weights for a refined look' : 'balanced line weights';
  parts.push(`Apply ${edgeDesc} with ${weightDesc}.`);

  // Components
  const activeComponents = workflow.explodedComponents.filter((comp) => comp.active);
  if (activeComponents.length > 0) {
    const names = activeComponents.slice(0, 6).map((comp) => comp.title || comp.name);
    parts.push(`Feature these key components in the explosion: ${names.join(', ')}${activeComponents.length > 6 ? ' and others' : ''}.`);
  }

  // Annotations
  const annotations = workflow.explodedAnnotations;
  const annotationElements: string[] = [];
  if (annotations.labels) annotationElements.push('clear component labels');
  if (annotations.leaders) annotationElements.push('leader lines connecting labels to parts');
  if (annotations.dimensions) annotationElements.push('key dimensions');
  if (annotations.assemblyNumbers) annotationElements.push('assembly sequence numbers');
  if (annotations.materialCallouts) annotationElements.push('material callouts');

  if (annotationElements.length > 0) {
    parts.push(`Add ${annotationElements.join(', ')} using ${annotations.labelStyle} typography.`);
  }

  // Animation
  const anim = workflow.explodedAnim;
  if (anim.generate) {
    const easingDesc: Record<string, string> = {
      'linear': 'smooth, constant speed',
      'ease-in-out': 'graceful acceleration and deceleration',
      'ease-out': 'energetic start settling to a gentle stop',
      'bounce': 'playful bounce as components reach position',
    };
    parts.push(`Generate an animation that ${anim.type === 'explosion' ? 'separates the components outward' : 'assembles the components together'} over ${anim.duration} seconds with ${easingDesc[anim.easing] || anim.easing}.`);
  }

  // Output
  const output = workflow.explodedOutput;
  const bgDesc: Record<string, string> = {
    'white': 'a clean white background',
    'transparent': 'a transparent background for compositing',
    'gradient': 'a subtle gradient backdrop',
    'studio': 'a professional studio environment',
  };
  parts.push(`Render against ${bgDesc[output.background] || output.background}.`);

  if (output.groundPlane) {
    parts.push('Include a ground plane to anchor the assembly.');
  }
  if (output.shadow) {
    parts.push('Cast soft shadows to enhance depth and component separation.');
  }
  if (output.grid) {
    parts.push('Show a reference grid for scale.');
  }

  parts.push('The final image should clearly communicate the building\'s assembly logic while being visually striking enough for presentation.');

  return parts.filter(Boolean).join(' ');
}

function generateSectionPrompt(state: AppState): string {
  const { workflow } = state;
  const parts: string[] = [];

  // Evocative opening
  if (state.prompt?.trim()) {
    parts.push(state.prompt.trim());
  } else {
    parts.push('Create a revealing section cutaway that slices through the building to expose its inner spatial qualities, construction logic, and the relationships between interior and exterior.');
  }

  // Fidelity constraints
  parts.push('Treat the input model or drawing as the authoritative source for all geometry. The cut plane must be positioned exactly as specified - no shifting of the section location, depth, or cutting direction. Preserve the exact scale, orientation, and alignment of all elements. Do not relocate any architectural components or alter proportions. Only reveal what the cut and visibility settings allow.');

  // Cut description
  const cut = workflow.sectionCut;
  const cutTypeDesc: Record<string, string> = {
    'vertical': 'Cut vertically through the building, revealing the stacked spatial sequence from foundation to roof',
    'horizontal': 'Cut horizontally at the specified height to expose the plan-level organization',
    'longitudinal': 'Cut longitudinally through the building, revealing the sequence of spaces from front to back',
    'transverse': 'Cut transversely across the building, showing the cross-sectional organization',
    'diagonal': 'Cut diagonally to reveal unique spatial relationships',
    'stepped': 'Use a stepped section that shifts to reveal multiple conditions',
  };
  parts.push(`${cutTypeDesc[cut.type] || `Make a ${cut.type} cut`}.`);

  const depthDesc = cut.depth > 70 ? 'deep into the building, revealing multiple layers' :
    cut.depth > 40 ? 'through the primary spaces' : 'at a shallow depth focusing on the facade zone';
  parts.push(`The section cuts ${depthDesc}.`);

  // Reveal style
  const reveal = workflow.sectionReveal;
  const revealStyleDesc: Record<string, string[]> = {
    'front-peel': [
      'Reveal style: front peel.',
      'Pull the front facade forward as a single, clean slab to expose the interior behind it.',
      'Keep the peeled layer parallel to the original facade plane; do not tilt or warp it.',
      'Show a clear gap between the peeled facade and the remaining building mass to emphasize depth.',
      'Interior elements should be fully visible and undistorted, with the peeled face acting as a foreground layer.',
      'Example: a townhouse where the street facade is peeled forward to reveal rooms and stairs inside.',
    ],
    'slice-lift': [
      'Reveal style: slice + lift.',
      'Extract a vertical slice of the building and lift it upward, keeping the slice thickness consistent.',
      'The lifted slice should remain aligned with the original cut plane and stay orthographic, not skewed.',
      'Expose the void left behind with clean cut faces and a readable interior cross-section.',
      'Maintain the original stacking and spacing of floors within the lifted slice.',
      'Example: an office tower with a central slice lifted to show floor plates and core alignment.',
    ],
    'stacked-floors': [
      'Reveal style: stacked floors.',
      'Separate each floor plate and its immediate program layer into clean, horizontal strata.',
      'Stack the floors upward with equal spacing, keeping them perfectly aligned in plan.',
      'Maintain consistent thickness for slabs, ceilings, and floor assemblies across all layers.',
      'Expose the vertical voids (stairs, cores, atriums) by aligning them through the stack.',
      'Use clear gaps between floors so the hierarchy of levels reads instantly.',
      'Example: a residential block with four floor plates separated vertically, showing rooms, slabs, and the core aligned through all levels.',
    ],
    'core-focus': [
      'Reveal style: core focus.',
      'Emphasize the central core (stairs, elevators, shafts) as the primary element in the section.',
      'De-emphasize perimeter rooms with lighter line weight or translucency.',
      'Keep the core solid, high-contrast, and uninterrupted through all floors.',
      'Show structural connections from the core to the floor plates clearly.',
      'Example: a mid-rise where the core is bold and dark, with lighter surrounding rooms.',
    ],
    'program-color': [
      'Reveal style: program blocks.',
      'Divide the section into clear program zones and color each zone distinctly.',
      'Use large, legible color blocks with minimal texture so program reads at a glance.',
      'Keep cut faces and structure visible beneath or alongside color fields.',
      'Maintain consistent program colors across all levels for coherence.',
      'Example: a school section with classrooms, circulation, and services each in different colors.',
    ],
    circulation: [
      'Reveal style: circulation.',
      'Highlight circulation paths (stairs, corridors, ramps) with strong contrast or a single accent color.',
      'Keep program spaces secondary so circulation reads as the dominant graphic.',
      'Show vertical connections clearly through multiple levels, emphasizing continuity.',
      'Use simplified, clean linework for circulation elements to avoid clutter.',
      'Example: a museum section where stair and corridor paths are highlighted in dark gray.',
    ],
    services: [
      'Reveal style: services.',
      'Emphasize mechanical, electrical, and plumbing routes in the section.',
      'Use distinct linework or color for ducts, risers, and service zones.',
      'Keep architectural spaces visible but lighter than the service network.',
      'Make service runs continuous and legible across floors.',
      'Example: a hospital section showing bold service bands and vertical risers throughout.',
    ],
    sharp: [
      'Reveal style: sharp cut.',
      'Use crisp, hard edges at the cut plane with no feathering, blur, or glow.',
      'Keep the cut line perfectly straight and planar, exposing material faces cleanly and uniformly.',
      'Make the cut faces read like freshly sliced material, with tight edges and no softness.',
      'Maintain strong contrast between cut surfaces and uncut context so the section reads instantly.',
      'Use solid pochÃ© or firm hatching on cut faces; avoid gradients or translucency.',
      'Keep interior linework lighter than the cut to preserve a clear hierarchy.',
      'Example: a library section with bold black cut walls, sharp slab edges, and clear interior spaces visible beyond.',
    ],
    gradient: [
      'Reveal style: gradient cut.',
      'Let the cut edge transition smoothly into the interior with a clear depth falloff.',
      'Fade foreground cut surfaces first, then soften secondary elements deeper in the section.',
      'Use a controlled tonal ramp so the cut plane remains readable while depth cues build.',
      'Avoid sudden drop-offs; the reveal should feel atmospheric and layered, not erased.',
      'Keep a subtle but visible edge line at the cut plane to anchor the section.',
      'Let glazing and thin elements remain legible as they fade, rather than disappearing abruptly.',
      'Example: an office section where the cut edge is firm, then fades into lighter interior details and background structure.',
    ],
    outlined: [
      'Reveal style: outlined cut.',
      'Draw bold outlines around cut faces and sectional edges to emphasize the slice.',
      'Use a strong graphic contour to separate cut materials from background geometry.',
      'Keep outlines continuous and clean, with consistent line weight and no sketchiness.',
      'Let the outline act as a visual boundary for the section plane, framing the interior.',
      'Use minimal fill or flat, light fills so the outline carries the graphic weight.',
      'Interior detail should be thinner and lighter than the outline to avoid clutter.',
      'Example: a residential section where the cut plane is traced in a heavy line, with lighter interior lines and minimal fills.',
    ],
    ghosted: [
      'Reveal style: ghosted cut.',
      'Make the removed material semi-transparent so the void is implied rather than fully erased.',
      'Leave a faint silhouette of the cut mass while keeping interior elements readable.',
      'Use translucency to show both the removed volume and the revealed interior in balance.',
      'Keep the cut plane visible but subtle, like a thin veil over the removed material.',
      'Ghost the removed volume with low opacity and keep interior structure at higher opacity for clarity.',
      'Avoid heavy pochÃ©; use light tonal overlays to suggest mass without blocking the interior.',
      'Example: a factory section with the cut volume lightly ghosted while structure and spaces stay clear and readable.',
    ],
  };
  const revealStyleLines = revealStyleDesc[reveal.style] || [`Reveal style: ${reveal.style}.`];
  parts.push(...revealStyleLines);

  const focusDesc: Record<string, string> = {
    'interior': 'Focus attention on the interior spaces and their qualities',
    'structure': 'Emphasize the structural system and load paths',
    'circulation': 'Highlight circulation routes and vertical connections',
    'envelope': 'Focus on the building envelope and its layers',
  };
  if (reveal.focus) {
    parts.push(`${focusDesc[reveal.focus] || `Focus on ${reveal.focus}`}.`);
  }

  // Facade and depth treatment
  const facadeDesc = reveal.facadeOpacity > 70 ? 'Keep the facade mostly opaque, with the section revealing what lies behind' :
    reveal.facadeOpacity > 30 ? 'Make the facade semi-transparent to hint at interior conditions' :
    'Ghost the facade almost completely to prioritize the sectional view';
  parts.push(`${facadeDesc}.`);

  if (reveal.depthFade > 30) {
    const fadeDesc = reveal.depthFade > 60 ? 'Fade elements significantly with depth, creating atmospheric perspective' :
      'Apply subtle depth fade to enhance spatial reading';
    parts.push(`${fadeDesc}.`);
  }

  // Section areas
  const areas = workflow.sectionAreas || [];
  const activeAreas = areas.filter((area) => area.active);
  if (activeAreas.length > 0) {
    const areaNames = activeAreas.slice(0, 6).map(area => {
      const title = area.title?.trim() || 'Untitled space';
      return title;
    });
    parts.push(`Highlight these key spaces in the section: ${areaNames.join(', ')}${activeAreas.length > 6 ? ' and others' : ''}.`);
  }

  // Program visualization
  const program = workflow.sectionProgram;
  const colorModeDesc: Record<string, string> = {
    'by-program': 'Color-code spaces by their programmatic use',
    'by-floor': 'Differentiate floor levels with distinct colors',
    'monochrome': 'Keep the section monochromatic for a clean, technical look',
    'material': 'Show actual material colors in the section',
  };
  parts.push(`${colorModeDesc[program.colorMode] || `Use ${program.colorMode} coloring`}.`);

  const programAnnotations: string[] = [];
  if (program.labels) programAnnotations.push('space labels');
  if (program.leaderLines) programAnnotations.push('leader lines');
  if (program.areaTags) programAnnotations.push('area measurements');

  if (programAnnotations.length > 0) {
    parts.push(`Add ${programAnnotations.join(', ')} using ${program.labelStyle} typography.`);
  }

  // Section style
  const style = workflow.sectionStyle;
  const pocheDesc: Record<string, string> = {
    'solid': 'Render cut materials as solid black poché',
    'hatched': 'Apply traditional hatching to indicate cut materials',
    'gradient': 'Use gradient fills in cut areas',
    'none': 'Leave cut areas unfilled',
  };
  parts.push(`${pocheDesc[style.poche] || `Use ${style.poche} poché`}.`);

  if (style.hatch) {
    const hatchDesc: Record<string, string> = {
      'solid': 'solid fill hatching',
      'diag': 'diagonal line hatching',
      'cross': 'cross-hatch patterns',
    };
    parts.push(`Apply ${hatchDesc[style.hatch] || style.hatch} patterns to differentiate materials.`);
  }

  const weightDescMap: Record<string, string> = {
    'light': 'delicate line weights for a refined drawing',
    'medium': 'balanced line weights',
    'heavy': 'bold line weights that read clearly at any scale',
  };
  const weightDesc = weightDescMap[style.weight] || 'balanced line weights';
  parts.push(`Use ${weightDesc}.`);

  if (style.showBeyond > 50) {
    parts.push('Show elements beyond the cut plane to provide context and depth.');
  } else if (style.showBeyond > 20) {
    parts.push('Lightly indicate elements beyond the cut plane.');
  }

  parts.push('The final section should be both technically informative and visually compelling, clearly communicating the building\'s spatial organization and construction.');

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

  if (state.mode === 'render-sketch') {
    return generateSketchPrompt(state);
  }
  if (state.mode === 'upscale') {
    return generateUpscalePrompt(state);
  }
  if (state.mode === 'img-to-3d') {
    return generateImageTo3DPrompt(state);
  }
  if (state.mode === 'multi-angle') {
    return generateMultiAnglePrompt(state);
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

  // 1. Base Prompt / Subject - More evocative opening
  if (state.prompt) {
    promptParts.push(state.prompt);
  } else if (style && !isNoStyle) {
    promptParts.push(`Create a stunning ${style.name.toLowerCase()} architectural visualization that captures the essence of this design`);
  } else {
    promptParts.push('Create a compelling architectural visualization that brings this design to life');
  }

  // 2. Style Specifics - Enhanced descriptions
  if (!isNoStyle && style?.description) {
    const styleDescription = style.description.trim();
    promptParts.push(styleDescription.endsWith('.') ? styleDescription : `${styleDescription}.`);
  }
  if (!isNoStyle && style?.promptBundle) {
    const architectureVocabulary = style.promptBundle.architectureVocabulary || [];
    const materialBias = style.promptBundle.materialBias || {};
    if (architectureVocabulary.length > 0) {
      promptParts.push(`The architecture should express ${architectureVocabulary.slice(0, 3).join(', ')}.`);
    }
    const primaryMaterials = materialBias.primary || [];
    const secondaryMaterials = materialBias.secondary || [];
    if (primaryMaterials.length > 0 || secondaryMaterials.length > 0) {
      const primaryText = primaryMaterials.length > 0 ? primaryMaterials.join(', ') : 'balanced materials';
      const secondaryText = secondaryMaterials.slice(0, 2).join(', ');
      const materialsText = secondaryText ? `${primaryText} complemented by ${secondaryText}` : primaryText;
      promptParts.push(`The material palette features ${materialsText}.`);
    }
  }

  // 3. Lighting - Natural language descriptions
  const timeDescriptions: Record<string, string> = {
    'dawn': 'Illuminate the scene with soft, ethereal dawn light as the sun begins to rise',
    'morning': 'Bathe the building in fresh, clear morning light',
    'noon': 'Light the scene with bright midday sun',
    'afternoon': 'Warm the scene with golden afternoon light',
    'golden-hour': 'Capture the magic of golden hour with rich, warm illumination',
    'sunset': 'Paint the scene with dramatic sunset colors',
    'dusk': 'Show the building in the fading light of dusk',
    'night': 'Illuminate the building at night, showcasing its artificial lighting',
  };

  const weatherDescriptions: Record<string, string> = {
    'clear': 'under a pristine clear sky',
    'partly-cloudy': 'with scattered clouds adding interest to the sky',
    'overcast': 'under soft, even overcast conditions',
    'cloudy': 'beneath dramatic cloud formations',
    'stormy': 'with moody storm clouds gathering',
    'foggy': 'with atmospheric fog adding mystery',
  };

  const timeDesc = timeDescriptions[lighting.timeOfDay] || `during ${lighting.timeOfDay}`;
  const weatherDesc = weatherDescriptions[lighting.weather] || lighting.weather;
  promptParts.push(`${timeDesc} ${weatherDesc}.`);

  // 4. Context - Vivid environmental description
  if (context.vegetation) {
    const densityDesc = context.vegetationDensity > 70 ? 'lush, abundant' :
      context.vegetationDensity > 40 ? 'thoughtfully landscaped' : 'minimal, carefully placed';
    const seasonDescriptions: Record<string, string> = {
      'spring': 'fresh spring greenery with new growth',
      'summer': 'full summer foliage in vibrant greens',
      'autumn': 'warm autumn colors with changing leaves',
      'winter': 'stark winter landscape',
    };
    const seasonDesc = seasonDescriptions[context.season] || `${context.season} vegetation`;
    promptParts.push(`Surround the building with ${densityDesc} ${seasonDesc}.`);
  }

  if (context.people) {
    promptParts.push('Include people to provide human scale and bring life to the scene.');
  }

  // 5. Camera/Technical - Natural descriptions
  const viewTypeDescriptions: Record<string, string> = {
    'eye-level': 'Capture from a natural eye-level perspective that a visitor would experience',
    'elevated': 'View from an elevated vantage point that reveals the building\'s form',
    'aerial': 'Present an aerial view showing the building in its context',
    'worms-eye': 'Look up dramatically from below, emphasizing the building\'s presence',
    'interior': 'Reveal the interior spaces and their spatial qualities',
  };

  const projectionDescriptions: Record<string, string> = {
    'perspective': 'with natural perspective',
    'orthographic': 'in measured orthographic projection',
    'isometric': 'in clean isometric view',
  };

  const viewDesc = viewTypeDescriptions[camera.viewType] || `Show a ${camera.viewType} view`;
  const projDesc = projectionDescriptions[camera.projection] || camera.projection;
  promptParts.push(`${viewDesc} ${projDesc}.`);

  // Material emphasis
  if (materials.concreteEmphasis > 70) {
    promptParts.push('Pay special attention to rendering the concrete with rich texture and subtle color variations.');
  }

  // Quality closing
  promptParts.push('Render with exceptional photorealistic quality - believable materials, accurate lighting, and the level of detail expected in professional architectural photography.');

  return promptParts.join(' ');
}
