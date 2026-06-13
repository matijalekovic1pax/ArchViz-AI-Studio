import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../../store';
import type { VisualSelectionPoint, VisualSelectionShape } from '../../../types';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionDesc, SliderControl, SunPositionWidget, ColorPicker } from './SharedRightComponents';
import { AUTO_SELECTION_MODEL, ImageUtils, getGeminiService, initGeminiService, isGeminiServiceInitialized } from '../../../services/geminiService';
import { isGatewayAuthenticated } from '../../../services/apiGateway';
import { nanoid } from 'nanoid';
import { MATERIAL_CATEGORIES, MATERIAL_SWATCHES, getMaterialById } from '../../../lib/materialCatalog';
import {
  Image as ImageIcon,
  Palette,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Wrench,
  Search,
  X,
  Check,
  Users,
  User,
  UserRound,
  Shield,
  HardHat,
  Luggage,
  Backpack,
  Plane,
  PlaneTakeoff,
  Car,
  CarFront,
  CarTaxiFront,
  Truck,
  BusFront,
  Bike,
  ShoppingCart,
  Armchair,
  Sofa,
  RockingChair,
  Table,
  Table2,
  Monitor,
  Fence,
  Trash2,
  Palmtree,
  TreePine,
  Leaf,
  LeafyGreen,
  Flower2,
  Sprout,
  Briefcase,
  Signpost,
  SignpostBig,
  ScanBarcode,
  ScanLine,
  DoorOpen,
  RotateCw,
  TrafficCone,
  AlertTriangle,
  Laptop,
  BookOpen,
  Upload,
  Eraser,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

const selectionTargets = [
  'Building',
  'Facade',
  'Windows',
  'Doors',
  'Roof',
  'Walls',
  'Floors',
  'Ceilings',
  'Columns',
  'Structure',
  'Glass',
  'Signage',
  'Lighting',
  'Seating',
  'Furniture',
  'Counters',
  'People',
  'Vehicles',
  'Aircraft',
  'Trains',
  'Buses',
  'Jet Bridges',
  'Luggage Carts',
  'Platforms',
  'Roads',
  'Parking',
  'Ground',
  'Water',
  'Vegetation',
  'Sky',
  'Background',
];
const selectionExamples = [
  'Replace with modern glass facade',
  'Add greenery and climbing plants',
  'Change to brick material',
  'Remove and fill with background',
  'Add people walking',
];

const MAX_AUTO_SELECTION_SHAPES = 80;

const autoSelectionTargetHints: Record<string, string> = {
  Building: 'complete visible building masses and envelopes; exclude sky, ground, unrelated context, and loose foreground objects',
  Facade: 'visible facade planes, cladding, curtain wall fields, mullion fields, and exterior/interior envelope faces; exclude sky and ground',
  Windows: 'window panes, curtain-wall glass modules, storefront panes, and window openings; avoid surrounding solid wall unless inseparable',
  Doors: 'door leaves, entries, portals, gates, and visible door frames that belong to the doorway',
  Roof: 'roof planes, canopies, soffit edges, skylights attached to the roof, and visible rooftop forms',
  Walls: 'wall planes and partitions; keep furniture, signage, people, plants, and floor/ceiling outside the intended wall target',
  Floors: 'walkable floor slabs, concourse floors, paving, platforms, and visible interior ground planes',
  Ceilings: 'ceiling planes, soffits, exposed ceiling fields, acoustic panels, and overhead finishes',
  Columns: 'columns, pillars, piers, posts, and vertical structural supports',
  Structure: 'beams, trusses, braces, frames, slabs, columns, and other structural members',
  Glass: 'glass surfaces including windows, railings, curtain walls, and transparent panels; avoid solid frames unless integral',
  Signage: 'signs, wayfinding panels, boards, labels, logos, posters, screens with informational content, and display faces',
  Lighting: 'light fixtures, linear light strips, lamps, downlights, luminaires, and lit objects; do not select general bright areas',
  Seating: 'chairs, benches, seat rows, sofas, stools, lounge seating, and built-in seating',
  Furniture: 'tables, desks, counters, chairs, sofas, shelves, kiosks, loose furniture, and movable interior objects',
  Counters: 'service counters, check-in desks, bars, reception desks, retail counters, and transaction surfaces',
  People: 'complete visible human figures, including clothing, hair, carried bags, luggage handles, personal accessories, contact shadows, and reflections when attached',
  Vehicles: 'cars, vans, trucks, taxis, service vehicles, carts with engines, and visible vehicle reflections or shadows when attached',
  Aircraft: 'airplanes, helicopters, visible fuselage parts, wings, tails, engines, landing gear, and attached service equipment',
  Trains: 'train cars, metro cars, tram cars, rail vehicles, and visible train doors/windows',
  Buses: 'buses, shuttles, coaches, and bus-like transit vehicles',
  'Jet Bridges': 'boarding bridges, passenger boarding corridors, telescoping bridge parts, and attached bridge supports',
  'Luggage Carts': 'luggage carts, baggage trolleys, baggage dollies, cart handles, wheels, and stacked luggage carried by the cart',
  Platforms: 'raised platform slabs, boarding platforms, train platforms, and concourse platform edges',
  Roads: 'road lanes, driveways, asphalt streets, curbs, taxiways, and vehicle circulation surfaces',
  Parking: 'parking lots, stalls, painted parking markings, ramps, drive aisles, and parked-car zones',
  Ground: 'terrain, plaza paving, sidewalks, landscape ground, dirt, grass fields, and exterior ground surfaces',
  Water: 'pools, ponds, canals, sea, fountains, reflecting water, and water surfaces only',
  Vegetation: 'trees, shrubs, hedges, planters, grass, vines, leaves, planting beds, and green walls',
  Sky: 'visible sky only, including clouds and atmospheric gradient; exclude buildings, trees, wires, and horizon objects',
  Background: 'distant environment behind the main subject, including context buildings, landscape, horizon, and far scenery; exclude the main building or foreground subject unless selected separately',
};

const autoSelectionIntentRules: Record<string, string> = {
  select: 'The selection will guide the editable target. Prefer complete visible subjects with a small natural context margin over tiny fragments or razor-tight cutouts.',
  material: 'The selection will guide material replacement. Prefer continuous surface planes and material regions with enough edge context for blending; do not grab unrelated objects sitting on the surface.',
  lighting: 'The selection will guide localized lighting changes. Select coherent illuminated regions or fixture objects with enough surrounding falloff context, without scattering across unrelated highlights.',
  object: 'The selection will guide object placement or replacement. Select complete replaceable object instances with enough surrounding context for scale, grounding, shadows, and occlusion.',
  remove: 'The selection will guide removal. Select whole removable foreground subjects, including attached accessories, contact shadows, reflections, and a little surrounding reconstruction context.',
  adjust: 'The selection will guide local color and detail adjustment. Select broad coherent regions with soft context, not isolated texture noise.',
  extend: 'The selection will guide image extension. Select only the edge or context area that should be continued.',
  background: 'The selection may protect or separate foreground from background. Keep foreground/background roles clear and avoid mixing them in one polygon.',
  people: 'The selection will guide people editing. Select each person as a whole visible figure, including clothing, hair, bags, luggage, immediate contact shadow, and modest cleanup context.',
  sky: 'The selection will guide sky/background work. Select sky or background cleanly, with enough edge context to avoid a visible cut around building silhouettes.',
};

const getAutoSelectionIntentRule = (activeTool: string) =>
  autoSelectionIntentRules[activeTool] || autoSelectionIntentRules.select;

const buildAutoSelectionPrompt = (
  targets: string[],
  activeTool: string,
  width: number,
  height: number,
  editPrompt: string
) => {
  const targetLines = targets
    .map((target) => `- ${target}: ${autoSelectionTargetHints[target] || 'the visible object or region named by this target'}`)
    .join('\n');
  const promptContext = editPrompt.trim()
    ? `\nUser edit intent for disambiguation only: ${editPrompt.trim().slice(0, 500)}`
    : '';

  return [
    'You are an expert segmentation assistant for an architectural visual editor.',
    `Image dimensions are ${width}x${height}, but all returned coordinates must use the normalized 0 to 1000 coordinate space.`,
    `Active edit tool: ${activeTool}. ${getAutoSelectionIntentRule(activeTool)}`,
    'Detect only the requested target categories:',
    targetLines,
    promptContext,
    'Output requirements:',
    '- Return JSON only. Do not include markdown, code fences, comments, prose, or explanations.',
    '- Use this exact schema: {"polygons":[{"label":"target label","confidence":0.0,"points":[{"x":0,"y":0}]}]}.',
    '- Coordinates must be integers from 0 to 1000. x=0 is left, y=0 is top.',
    '- Return one polygon per distinct visible target instance or one polygon per coherent continuous surface region.',
    '- Enclose the complete visible target with 8 to 24 points and a modest context margin for natural blending. Avoid razor-precise tracing unless the active tool is protecting a foreground/background boundary.',
    '- Use rectangles only when the intended target area is genuinely rectangular; otherwise use a simple polygon that reads as guidance, not a cutout stencil.',
    '- Include occluded visible portions as one polygon if they clearly belong to the same object. Do not invent hidden parts behind other objects.',
    '- For people, vehicles, aircraft, furniture, luggage carts, and removable objects, capture the complete visible subject including attached accessories and contact shadows/reflections when needed.',
    '- For surfaces such as walls, floors, ceilings, sky, roads, glass, facade, and background, return coherent regions and avoid unrelated foreground objects.',
    '- Do not select the entire image unless the requested target genuinely occupies the full frame.',
    '- If no requested targets are clearly visible, return {"polygons":[]}.',
  ].join('\n');
};

type PeopleChipOption = { value: string; label: string };

const toggleChip = (items: string[], value: string) =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

const Chip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-1.5 py-1 text-[10px] font-medium rounded border transition-all duration-150 text-center leading-tight truncate min-w-0",
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-surface-sunken text-foreground-muted border-border-subtle hover:border-border hover:text-foreground-secondary"
    )}
  >
    {label}
  </button>
);

const ChipGrid2 = ({ items, selected, onToggle }: { items: PeopleChipOption[]; selected: string[]; onToggle: (val: string) => void }) => (
  <div className="grid grid-cols-2 gap-1">
    {items.map((item) => (
      <Chip key={item.value} active={selected.includes(item.value)} label={item.label} onClick={() => onToggle(item.value)} />
    ))}
  </div>
);

const ChipGrid3 = ({ items, selected, onToggle }: { items: PeopleChipOption[]; selected: string[]; onToggle: (val: string) => void }) => (
  <div className="grid grid-cols-3 gap-1">
    {items.map((item) => (
      <Chip key={item.value} active={selected.includes(item.value)} label={item.label} onClick={() => onToggle(item.value)} />
    ))}
  </div>
);

const SingleChipGrid2 = ({ items, value, onChange }: { items: PeopleChipOption[]; value: string; onChange: (val: string) => void }) => (
  <div className="grid grid-cols-2 gap-1">
    {items.map((item) => (
      <Chip key={item.value} active={value === item.value} label={item.label} onClick={() => onChange(item.value)} />
    ))}
  </div>
);

const SingleChipGrid3 = ({ items, value, onChange }: { items: PeopleChipOption[]; value: string; onChange: (val: string) => void }) => (
  <div className="grid grid-cols-3 gap-1">
    {items.map((item) => (
      <Chip key={item.value} active={value === item.value} label={item.label} onClick={() => onChange(item.value)} />
    ))}
  </div>
);

const PeopleSection = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t border-border-subtle pt-1.5">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-1 group">
        <span className="text-[10px] uppercase tracking-wider text-foreground-muted group-hover:text-foreground-secondary transition-colors">{title}</span>
        <span className={cn("text-[9px] text-foreground-muted transition-transform duration-150", open ? "rotate-0" : "-rotate-90")}>&#9660;</span>
      </button>
      {open && <div className="space-y-2.5 pt-1.5 pb-0.5">{children}</div>}
    </div>
  );
};

const SectionLabel = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px] text-foreground-secondary">{children}</span>
    {right}
  </div>
);

const AllToggle = ({ count, total, onToggle }: { count: number; total: number; onToggle: () => void }) => (
  <button onClick={onToggle} className="text-[9px] text-foreground-muted hover:text-foreground-secondary transition-colors">
    {count === total ? 'Clear' : 'All'}
  </button>
);

const regionOptions: PeopleChipOption[] = [
  { value: 'european', label: 'European' },
  { value: 'east-asian', label: 'East Asian' },
  { value: 'south-asian', label: 'South Asian' },
  { value: 'southeast-asian', label: 'SE Asian' },
  { value: 'middle-eastern', label: 'Mid. Eastern' },
  { value: 'african', label: 'African' },
  { value: 'latin-american', label: 'Latin Amer.' },
  { value: 'pacific-islander', label: 'Pacific Isl.' },
  { value: 'central-asian', label: 'Central Asian' },
];

const activityOptions: PeopleChipOption[] = [
  { value: 'walking', label: 'Walking' },
  { value: 'standing', label: 'Standing' },
  { value: 'sitting', label: 'Sitting' },
  { value: 'rushing', label: 'Rushing' },
  { value: 'queuing', label: 'Queuing' },
  { value: 'browsing-shops', label: 'Shopping' },
  { value: 'eating', label: 'Eating' },
  { value: 'phone-use', label: 'On Phone' },
  { value: 'reading', label: 'Reading' },
  { value: 'conversation', label: 'Chatting' },
  { value: 'sleeping', label: 'Sleeping' },
  { value: 'working-laptop', label: 'Laptop' },
  { value: 'taking-photos', label: 'Photos' },
  { value: 'pushing-stroller', label: 'Stroller' },
  { value: 'wheelchair', label: 'Wheelchair' },
];

const luggageTypeOptions: PeopleChipOption[] = [
  { value: 'rolling-suitcase', label: 'Roller' },
  { value: 'backpack', label: 'Backpack' },
  { value: 'carry-on', label: 'Carry-on' },
  { value: 'duffel-bag', label: 'Duffel' },
  { value: 'oversized', label: 'Oversized' },
  { value: 'shopping-bags', label: 'Shopping' },
  { value: 'duty-free', label: 'Duty Free' },
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'garment-bag', label: 'Garment' },
];

type ObjectCategory = 'People' | 'Vehicles' | 'Furniture' | 'Vegetation' | 'Props';

const objectCategoryOptions: Array<{
  value: ObjectCategory;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { value: 'People', label: 'People', shortLabel: 'People', icon: Users },
  { value: 'Vehicles', label: 'Vehicles', shortLabel: 'Vehicles', icon: Car },
  { value: 'Furniture', label: 'Furniture', shortLabel: 'Furniture', icon: Armchair },
  { value: 'Vegetation', label: 'Vegetation', shortLabel: 'Veg', icon: TreePine },
  { value: 'Props', label: 'Props', shortLabel: 'Props', icon: Briefcase },
];

const objectIconMap = {
  Users,
  User,
  UserRound,
  Shield,
  HardHat,
  Luggage,
  Backpack,
  Plane,
  PlaneTakeoff,
  Car,
  CarFront,
  CarTaxiFront,
  Truck,
  BusFront,
  Bike,
  ShoppingCart,
  Armchair,
  Sofa,
  RockingChair,
  Table,
  Table2,
  Monitor,
  Fence,
  Trash2,
  Palmtree,
  TreePine,
  Leaf,
  LeafyGreen,
  Flower2,
  Sprout,
  Briefcase,
  Signpost,
  SignpostBig,
  ScanBarcode,
  ScanLine,
  DoorOpen,
  RotateCw,
  TrafficCone,
  AlertTriangle,
  Laptop,
  BookOpen,
  Wrench,
};

type ObjectIconKey = keyof typeof objectIconMap;

interface ObjectAsset {
  id: string;
  label: string;
  category: ObjectCategory;
  subcategory: string;
  tags: string[];
  icon: ObjectIconKey;
}

const fallbackMaterialPreview = MATERIAL_SWATCHES[0]?.fallbackPreviewUrl || MATERIAL_SWATCHES[0]?.previewUrl || '';
const materialSwatches = MATERIAL_SWATCHES;
const materialCategories = MATERIAL_CATEGORIES;
const MATERIAL_BROWSER_BATCH_SIZE = 48;

const hdriPresets = ['Studio', 'Outdoor', 'Overcast', 'Interior', 'Night'];
const skyPresets = [
  'Clear Blue',
  'Cloudy',
  'Overcast',
  'Sunset',
  'Golden Hour',
  'Blue Hour',
  'Dusk',
  'Night',
  'Stormy',
  'Dramatic',
];

const removeQuickOptions = [
  'People',
  'Vehicles',
  'Wires',
  'Signs',
  'Shadows',
  'Streetlights',
  'Poles',
  'Fences',
  'Trash',
  'Graffiti',
  'Reflections',
  'Glare',
  'Scaffolding',
  'Cones',
  'Construction Barriers',
  'Temporary Fencing',
  'Luggage Carts',
  'Queue Barriers',
  'Stanchions',
  'Cables',
  'Pipes',
  'HVAC Units',
  'Security Cameras',
  'Fire Extinguishers',
  'Exit Signs',
  'Wayfinding Displays',
  'Ad Posters',
  'Benches',
  'Chairs',
  'Plants',
  'Bollards',
  'Road Markings',
  'Puddles',
  'Birds',
  'Tree Branches',
];

const objectAssets: ObjectAsset[] = [
  {
    id: 'people-standing-business-man',
    label: 'Business Man',
    category: 'People',
    subcategory: 'Standing',
    tags: ['business', 'professional', 'standing', 'male'],
    icon: 'User',
  },
  {
    id: 'people-standing-business-woman',
    label: 'Business Woman',
    category: 'People',
    subcategory: 'Standing',
    tags: ['business', 'professional', 'standing', 'female'],
    icon: 'UserRound',
  },
  {
    id: 'people-standing-casual-man',
    label: 'Casual Man',
    category: 'People',
    subcategory: 'Standing',
    tags: ['casual', 'standing', 'male'],
    icon: 'User',
  },
  {
    id: 'people-standing-casual-woman',
    label: 'Casual Woman',
    category: 'People',
    subcategory: 'Standing',
    tags: ['casual', 'standing', 'female'],
    icon: 'UserRound',
  },
  {
    id: 'people-standing-security-guard',
    label: 'Security Guard',
    category: 'People',
    subcategory: 'Standing',
    tags: ['security', 'guard', 'standing', 'uniform'],
    icon: 'Shield',
  },
  {
    id: 'people-standing-airport-staff',
    label: 'Airport Staff',
    category: 'People',
    subcategory: 'Standing',
    tags: ['airport', 'staff', 'standing', 'uniform'],
    icon: 'HardHat',
  },
  {
    id: 'people-standing-tourist',
    label: 'Tourist',
    category: 'People',
    subcategory: 'Standing',
    tags: ['tourist', 'standing', 'traveler'],
    icon: 'Luggage',
  },
  {
    id: 'people-standing-family',
    label: 'Family Group',
    category: 'People',
    subcategory: 'Standing',
    tags: ['family', 'group', 'standing'],
    icon: 'Users',
  },
  {
    id: 'people-standing-crew',
    label: 'Crew Member',
    category: 'People',
    subcategory: 'Standing',
    tags: ['crew', 'standing', 'uniform'],
    icon: 'Shield',
  },
  {
    id: 'people-walking-single',
    label: 'Walking Single',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'single'],
    icon: 'User',
  },
  {
    id: 'people-walking-couple',
    label: 'Walking Couple',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'couple'],
    icon: 'Users',
  },
  {
    id: 'people-walking-group',
    label: 'Walking Group',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'group'],
    icon: 'Users',
  },
  {
    id: 'people-walking-rushing',
    label: 'Rushing Traveler',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'rushing', 'traveler'],
    icon: 'Luggage',
  },
  {
    id: 'people-walking-with-luggage',
    label: 'Walking + Luggage',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'luggage', 'traveler'],
    icon: 'Luggage',
  },
  {
    id: 'people-walking-child',
    label: 'Walking Child',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'child', 'family'],
    icon: 'UserRound',
  },
  {
    id: 'people-walking-business',
    label: 'Walking Business',
    category: 'People',
    subcategory: 'Walking',
    tags: ['walking', 'business', 'professional'],
    icon: 'User',
  },
  {
    id: 'people-sitting-waiting',
    label: 'Seated Waiting',
    category: 'People',
    subcategory: 'Sitting',
    tags: ['sitting', 'waiting'],
    icon: 'UserRound',
  },
  {
    id: 'people-sitting-working',
    label: 'Seated Working',
    category: 'People',
    subcategory: 'Sitting',
    tags: ['sitting', 'working', 'laptop'],
    icon: 'Laptop',
  },
  {
    id: 'people-sitting-reading',
    label: 'Seated Reading',
    category: 'People',
    subcategory: 'Sitting',
    tags: ['sitting', 'reading'],
    icon: 'BookOpen',
  },
  {
    id: 'people-sitting-phone',
    label: 'Seated Phone',
    category: 'People',
    subcategory: 'Sitting',
    tags: ['sitting', 'phone', 'waiting'],
    icon: 'UserRound',
  },
  {
    id: 'people-sitting-sleeping',
    label: 'Seated Sleeping',
    category: 'People',
    subcategory: 'Sitting',
    tags: ['sitting', 'sleeping', 'rest'],
    icon: 'UserRound',
  },
  {
    id: 'people-sitting-child',
    label: 'Seated Child',
    category: 'People',
    subcategory: 'Sitting',
    tags: ['sitting', 'child', 'family'],
    icon: 'UserRound',
  },
  {
    id: 'people-luggage-suitcase',
    label: 'Traveler + Suitcase',
    category: 'People',
    subcategory: 'With Luggage',
    tags: ['traveler', 'suitcase', 'luggage'],
    icon: 'Luggage',
  },
  {
    id: 'people-luggage-backpack',
    label: 'Traveler + Backpack',
    category: 'People',
    subcategory: 'With Luggage',
    tags: ['traveler', 'backpack', 'luggage'],
    icon: 'Backpack',
  },
  {
    id: 'people-luggage-family',
    label: 'Family with Bags',
    category: 'People',
    subcategory: 'With Luggage',
    tags: ['family', 'bags', 'luggage'],
    icon: 'Users',
  },
  {
    id: 'people-luggage-rolling',
    label: 'Rolling Carry-on',
    category: 'People',
    subcategory: 'With Luggage',
    tags: ['rolling', 'carry-on', 'traveler'],
    icon: 'Luggage',
  },
  {
    id: 'people-luggage-stroller',
    label: 'Stroller + Bags',
    category: 'People',
    subcategory: 'With Luggage',
    tags: ['stroller', 'family', 'bags'],
    icon: 'Users',
  },
  {
    id: 'people-service-pilot',
    label: 'Pilot',
    category: 'People',
    subcategory: 'Service',
    tags: ['pilot', 'uniform', 'airline'],
    icon: 'PlaneTakeoff',
  },
  {
    id: 'people-service-attendant',
    label: 'Flight Attendant',
    category: 'People',
    subcategory: 'Service',
    tags: ['flight', 'attendant', 'airline', 'uniform'],
    icon: 'Plane',
  },
  {
    id: 'people-service-ground',
    label: 'Ground Crew',
    category: 'People',
    subcategory: 'Service',
    tags: ['ground', 'crew', 'maintenance'],
    icon: 'HardHat',
  },
  {
    id: 'people-service-cleaning',
    label: 'Cleaning Staff',
    category: 'People',
    subcategory: 'Service',
    tags: ['cleaning', 'staff', 'maintenance'],
    icon: 'Wrench',
  },
  {
    id: 'people-service-immigration',
    label: 'Immigration Officer',
    category: 'People',
    subcategory: 'Service',
    tags: ['immigration', 'officer', 'security'],
    icon: 'Shield',
  },
  {
    id: 'people-service-medical',
    label: 'Medical Staff',
    category: 'People',
    subcategory: 'Service',
    tags: ['medical', 'staff', 'support'],
    icon: 'User',
  },
  {
    id: 'people-service-porter',
    label: 'Porter',
    category: 'People',
    subcategory: 'Service',
    tags: ['porter', 'service', 'luggage'],
    icon: 'Luggage',
  },
  {
    id: 'people-queue-checkin',
    label: 'Check-in Queue',
    category: 'People',
    subcategory: 'Queue',
    tags: ['queue', 'check-in', 'line'],
    icon: 'Users',
  },
  {
    id: 'people-queue-security',
    label: 'Security Line',
    category: 'People',
    subcategory: 'Queue',
    tags: ['queue', 'security', 'line'],
    icon: 'Users',
  },
  {
    id: 'vehicle-aircraft-commercial',
    label: 'Commercial Jet',
    category: 'Vehicles',
    subcategory: 'Aircraft',
    tags: ['aircraft', 'jet', 'commercial'],
    icon: 'Plane',
  },
  {
    id: 'vehicle-aircraft-private',
    label: 'Private Jet',
    category: 'Vehicles',
    subcategory: 'Aircraft',
    tags: ['aircraft', 'jet', 'private'],
    icon: 'PlaneTakeoff',
  },
  {
    id: 'vehicle-aircraft-cargo',
    label: 'Cargo Plane',
    category: 'Vehicles',
    subcategory: 'Aircraft',
    tags: ['aircraft', 'cargo'],
    icon: 'Plane',
  },
  {
    id: 'vehicle-aircraft-helicopter',
    label: 'Helicopter',
    category: 'Vehicles',
    subcategory: 'Aircraft',
    tags: ['aircraft', 'helicopter'],
    icon: 'Plane',
  },
  {
    id: 'vehicle-aircraft-regional',
    label: 'Regional Jet',
    category: 'Vehicles',
    subcategory: 'Aircraft',
    tags: ['aircraft', 'regional', 'jet'],
    icon: 'Plane',
  },
  {
    id: 'vehicle-aircraft-prop',
    label: 'Prop Plane',
    category: 'Vehicles',
    subcategory: 'Aircraft',
    tags: ['aircraft', 'prop', 'plane'],
    icon: 'Plane',
  },
  {
    id: 'vehicle-car-sedan',
    label: 'Sedan',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'sedan'],
    icon: 'Car',
  },
  {
    id: 'vehicle-car-suv',
    label: 'SUV',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'suv'],
    icon: 'CarFront',
  },
  {
    id: 'vehicle-car-taxi',
    label: 'Taxi',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'taxi'],
    icon: 'CarTaxiFront',
  },
  {
    id: 'vehicle-car-luxury',
    label: 'Luxury Car',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'luxury'],
    icon: 'CarFront',
  },
  {
    id: 'vehicle-car-police',
    label: 'Police Car',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'police'],
    icon: 'Shield',
  },
  {
    id: 'vehicle-car-rideshare',
    label: 'Rideshare',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'rideshare', 'transport'],
    icon: 'Car',
  },
  {
    id: 'vehicle-car-van',
    label: 'Service Van',
    category: 'Vehicles',
    subcategory: 'Cars',
    tags: ['car', 'van', 'service'],
    icon: 'CarFront',
  },
  {
    id: 'vehicle-service-luggage-cart',
    label: 'Luggage Cart',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'luggage', 'cart'],
    icon: 'ShoppingCart',
  },
  {
    id: 'vehicle-service-catering',
    label: 'Catering Truck',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'catering', 'truck'],
    icon: 'Truck',
  },
  {
    id: 'vehicle-service-fuel',
    label: 'Fuel Truck',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'fuel', 'truck'],
    icon: 'Truck',
  },
  {
    id: 'vehicle-service-bus',
    label: 'Bus',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'bus'],
    icon: 'BusFront',
  },
  {
    id: 'vehicle-service-shuttle',
    label: 'Shuttle Van',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'shuttle', 'van'],
    icon: 'Car',
  },
  {
    id: 'vehicle-service-tug',
    label: 'Baggage Tug',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'tug', 'baggage'],
    icon: 'Truck',
  },
  {
    id: 'vehicle-service-deicing',
    label: 'De-icing Truck',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'de-icing', 'truck'],
    icon: 'Truck',
  },
  {
    id: 'vehicle-service-air-stairs',
    label: 'Air Stairs',
    category: 'Vehicles',
    subcategory: 'Service',
    tags: ['service', 'air stairs', 'ground'],
    icon: 'Truck',
  },
  {
    id: 'vehicle-other-bicycle',
    label: 'Bicycle',
    category: 'Vehicles',
    subcategory: 'Other',
    tags: ['bicycle', 'bike'],
    icon: 'Bike',
  },
  {
    id: 'vehicle-other-motorcycle',
    label: 'Motorcycle',
    category: 'Vehicles',
    subcategory: 'Other',
    tags: ['motorcycle', 'bike'],
    icon: 'Bike',
  },
  {
    id: 'vehicle-other-scooter',
    label: 'Electric Scooter',
    category: 'Vehicles',
    subcategory: 'Other',
    tags: ['scooter', 'electric'],
    icon: 'Bike',
  },
  {
    id: 'vehicle-other-golf-cart',
    label: 'Golf Cart',
    category: 'Vehicles',
    subcategory: 'Other',
    tags: ['golf', 'cart', 'utility'],
    icon: 'CarFront',
  },
  {
    id: 'vehicle-other-skate',
    label: 'Service Scooter',
    category: 'Vehicles',
    subcategory: 'Other',
    tags: ['scooter', 'service'],
    icon: 'Bike',
  },
  {
    id: 'furniture-seating-chair-row',
    label: 'Airport Chair Row',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'chair', 'airport'],
    icon: 'Armchair',
  },
  {
    id: 'furniture-seating-lounge',
    label: 'Lounge Sofa',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'sofa', 'lounge'],
    icon: 'Sofa',
  },
  {
    id: 'furniture-seating-bar-stool',
    label: 'Bar Stool',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'stool', 'bar'],
    icon: 'RockingChair',
  },
  {
    id: 'furniture-seating-bench',
    label: 'Bench',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'bench'],
    icon: 'Sofa',
  },
  {
    id: 'furniture-seating-recliner',
    label: 'Recliner',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'recliner', 'lounge'],
    icon: 'Armchair',
  },
  {
    id: 'furniture-seating-ottoman',
    label: 'Ottoman',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'ottoman'],
    icon: 'Armchair',
  },
  {
    id: 'furniture-seating-club-chair',
    label: 'Club Chair',
    category: 'Furniture',
    subcategory: 'Seating',
    tags: ['seating', 'chair', 'club'],
    icon: 'Armchair',
  },
  {
    id: 'furniture-tables-cafe',
    label: 'Cafe Table',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['table', 'cafe'],
    icon: 'Table',
  },
  {
    id: 'furniture-tables-work',
    label: 'Work Desk',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['table', 'desk', 'work'],
    icon: 'Table2',
  },
  {
    id: 'furniture-tables-coffee',
    label: 'Coffee Table',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['table', 'coffee'],
    icon: 'Table',
  },
  {
    id: 'furniture-tables-counter',
    label: 'Counter',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['counter', 'table'],
    icon: 'Table2',
  },
  {
    id: 'furniture-tables-bar',
    label: 'Bar Counter',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['bar', 'counter', 'table'],
    icon: 'Table2',
  },
  {
    id: 'furniture-tables-workstation',
    label: 'Workstation',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['workstation', 'desk', 'table'],
    icon: 'Table2',
  },
  {
    id: 'furniture-tables-high',
    label: 'High Table',
    category: 'Furniture',
    subcategory: 'Tables',
    tags: ['high', 'table', 'bar'],
    icon: 'Table',
  },
  {
    id: 'furniture-fixtures-checkin',
    label: 'Check-in Desk',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['check-in', 'desk', 'fixture'],
    icon: 'Table2',
  },
  {
    id: 'furniture-fixtures-kiosk',
    label: 'Information Kiosk',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['information', 'kiosk', 'fixture'],
    icon: 'Monitor',
  },
  {
    id: 'furniture-fixtures-barrier',
    label: 'Barrier Post',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['barrier', 'post', 'queue'],
    icon: 'Fence',
  },
  {
    id: 'furniture-fixtures-trash',
    label: 'Trash Bin',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['trash', 'bin'],
    icon: 'Trash2',
  },
  {
    id: 'furniture-fixtures-ticketing',
    label: 'Ticketing Counter',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['ticketing', 'counter', 'fixture'],
    icon: 'Table2',
  },
  {
    id: 'furniture-fixtures-charging',
    label: 'Charging Station',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['charging', 'station', 'fixture'],
    icon: 'Monitor',
  },
  {
    id: 'furniture-fixtures-security',
    label: 'Security Belt',
    category: 'Furniture',
    subcategory: 'Fixtures',
    tags: ['security', 'belt', 'fixture'],
    icon: 'Fence',
  },
  {
    id: 'vegetation-indoor-palm',
    label: 'Potted Palm',
    category: 'Vegetation',
    subcategory: 'Indoor',
    tags: ['plant', 'palm', 'indoor'],
    icon: 'Palmtree',
  },
  {
    id: 'vegetation-indoor-ficus',
    label: 'Ficus Tree',
    category: 'Vegetation',
    subcategory: 'Indoor',
    tags: ['plant', 'ficus', 'indoor'],
    icon: 'TreePine',
  },
  {
    id: 'vegetation-indoor-monstera',
    label: 'Monstera',
    category: 'Vegetation',
    subcategory: 'Indoor',
    tags: ['plant', 'monstera', 'indoor'],
    icon: 'Leaf',
  },
  {
    id: 'vegetation-indoor-succulent',
    label: 'Succulent Arrangement',
    category: 'Vegetation',
    subcategory: 'Indoor',
    tags: ['plant', 'succulent', 'indoor'],
    icon: 'Sprout',
  },
  {
    id: 'vegetation-indoor-fern',
    label: 'Fern Cluster',
    category: 'Vegetation',
    subcategory: 'Indoor',
    tags: ['plant', 'fern', 'indoor'],
    icon: 'Leaf',
  },
  {
    id: 'vegetation-indoor-orchid',
    label: 'Orchid Pot',
    category: 'Vegetation',
    subcategory: 'Indoor',
    tags: ['plant', 'orchid', 'indoor'],
    icon: 'Flower2',
  },
  {
    id: 'vegetation-outdoor-street-tree',
    label: 'Street Tree',
    category: 'Vegetation',
    subcategory: 'Outdoor',
    tags: ['tree', 'outdoor', 'street'],
    icon: 'TreePine',
  },
  {
    id: 'vegetation-outdoor-bush',
    label: 'Bush',
    category: 'Vegetation',
    subcategory: 'Outdoor',
    tags: ['bush', 'outdoor'],
    icon: 'LeafyGreen',
  },
  {
    id: 'vegetation-outdoor-flower-bed',
    label: 'Flower Bed',
    category: 'Vegetation',
    subcategory: 'Outdoor',
    tags: ['flowers', 'outdoor'],
    icon: 'Flower2',
  },
  {
    id: 'vegetation-outdoor-grass',
    label: 'Grass Patch',
    category: 'Vegetation',
    subcategory: 'Outdoor',
    tags: ['grass', 'outdoor'],
    icon: 'Sprout',
  },
  {
    id: 'vegetation-outdoor-hedge',
    label: 'Hedge',
    category: 'Vegetation',
    subcategory: 'Outdoor',
    tags: ['hedge', 'outdoor'],
    icon: 'LeafyGreen',
  },
  {
    id: 'vegetation-outdoor-palm',
    label: 'Outdoor Palm',
    category: 'Vegetation',
    subcategory: 'Outdoor',
    tags: ['palm', 'outdoor'],
    icon: 'Palmtree',
  },
  {
    id: 'vegetation-planters-modern',
    label: 'Modern Planter',
    category: 'Vegetation',
    subcategory: 'Planters',
    tags: ['planter', 'modern'],
    icon: 'Leaf',
  },
  {
    id: 'vegetation-planters-stone',
    label: 'Stone Planter',
    category: 'Vegetation',
    subcategory: 'Planters',
    tags: ['planter', 'stone'],
    icon: 'Leaf',
  },
  {
    id: 'vegetation-planters-hanging',
    label: 'Hanging Planter',
    category: 'Vegetation',
    subcategory: 'Planters',
    tags: ['planter', 'hanging'],
    icon: 'Leaf',
  },
  {
    id: 'vegetation-planters-rectangular',
    label: 'Rectangular Planter',
    category: 'Vegetation',
    subcategory: 'Planters',
    tags: ['planter', 'rectangular'],
    icon: 'Leaf',
  },
  {
    id: 'vegetation-planters-round',
    label: 'Round Planter',
    category: 'Vegetation',
    subcategory: 'Planters',
    tags: ['planter', 'round'],
    icon: 'Leaf',
  },
  {
    id: 'props-luggage-carry-on',
    label: 'Carry-on Suitcase',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'carry-on', 'suitcase'],
    icon: 'Luggage',
  },
  {
    id: 'props-luggage-large',
    label: 'Large Suitcase',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'large', 'suitcase'],
    icon: 'Luggage',
  },
  {
    id: 'props-luggage-backpack',
    label: 'Backpack',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'backpack'],
    icon: 'Backpack',
  },
  {
    id: 'props-luggage-duffle',
    label: 'Duffle Bag',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'duffle'],
    icon: 'Briefcase',
  },
  {
    id: 'props-luggage-briefcase',
    label: 'Briefcase',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'briefcase'],
    icon: 'Briefcase',
  },
  {
    id: 'props-luggage-hardcase',
    label: 'Hardcase',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'hardcase'],
    icon: 'Briefcase',
  },
  {
    id: 'props-luggage-pet-carrier',
    label: 'Pet Carrier',
    category: 'Props',
    subcategory: 'Luggage',
    tags: ['luggage', 'pet', 'carrier'],
    icon: 'Briefcase',
  },
  {
    id: 'props-signage-departure',
    label: 'Departure Board',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'departure', 'board'],
    icon: 'Monitor',
  },
  {
    id: 'props-signage-wayfinding',
    label: 'Wayfinding Sign',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'wayfinding'],
    icon: 'SignpostBig',
  },
  {
    id: 'props-signage-gate',
    label: 'Gate Sign',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'gate'],
    icon: 'Signpost',
  },
  {
    id: 'props-signage-display',
    label: 'Digital Display',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'display', 'digital'],
    icon: 'Monitor',
  },
  {
    id: 'props-signage-gate-screen',
    label: 'Gate Screen',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'gate', 'screen'],
    icon: 'Monitor',
  },
  {
    id: 'props-signage-info',
    label: 'Info Sign',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'info'],
    icon: 'Signpost',
  },
  {
    id: 'props-signage-exit',
    label: 'Exit Sign',
    category: 'Props',
    subcategory: 'Signage',
    tags: ['signage', 'exit', 'emergency'],
    icon: 'SignpostBig',
  },
  {
    id: 'props-equipment-xray',
    label: 'X-ray Scanner',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'x-ray', 'security'],
    icon: 'ScanBarcode',
  },
  {
    id: 'props-equipment-metal',
    label: 'Metal Detector',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'metal', 'detector', 'security'],
    icon: 'ScanLine',
  },
  {
    id: 'props-equipment-boarding',
    label: 'Boarding Gate',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'boarding', 'gate'],
    icon: 'DoorOpen',
  },
  {
    id: 'props-equipment-carousel',
    label: 'Baggage Carousel',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'baggage', 'carousel'],
    icon: 'RotateCw',
  },
  {
    id: 'props-equipment-checkpoint',
    label: 'Security Checkpoint',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'security', 'checkpoint'],
    icon: 'ScanLine',
  },
  {
    id: 'props-equipment-jet-bridge',
    label: 'Jet Bridge',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'jet bridge', 'gate'],
    icon: 'DoorOpen',
  },
  {
    id: 'props-equipment-conveyor',
    label: 'Conveyor Belt',
    category: 'Props',
    subcategory: 'Equipment',
    tags: ['equipment', 'conveyor', 'baggage'],
    icon: 'RotateCw',
  },
  {
    id: 'props-accessories-cart',
    label: 'Luggage Cart',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'luggage', 'cart'],
    icon: 'ShoppingCart',
  },
  {
    id: 'props-accessories-stanchion',
    label: 'Stanchion',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'stanchion', 'queue'],
    icon: 'Fence',
  },
  {
    id: 'props-accessories-cone',
    label: 'Cone',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'cone', 'safety'],
    icon: 'TrafficCone',
  },
  {
    id: 'props-accessories-wet-floor',
    label: 'Wet Floor Sign',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'wet floor', 'warning'],
    icon: 'AlertTriangle',
  },
  {
    id: 'props-accessories-queue-belt',
    label: 'Queue Belt',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'queue', 'belt'],
    icon: 'Fence',
  },
  {
    id: 'props-accessories-floor-decals',
    label: 'Floor Decals',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'floor', 'decals'],
    icon: 'AlertTriangle',
  },
  {
    id: 'props-accessories-pillar-sign',
    label: 'Pillar Sign',
    category: 'Props',
    subcategory: 'Accessories',
    tags: ['accessory', 'pillar', 'sign'],
    icon: 'Signpost',
  },
];

const hslChannelOptions = [
  { label: 'Reds', hueKey: 'hslRedsHue', satKey: 'hslRedsSaturation', lumKey: 'hslRedsLuminance' },
  { label: 'Oranges', hueKey: 'hslOrangesHue', satKey: 'hslOrangesSaturation', lumKey: 'hslOrangesLuminance' },
  { label: 'Yellows', hueKey: 'hslYellowsHue', satKey: 'hslYellowsSaturation', lumKey: 'hslYellowsLuminance' },
  { label: 'Greens', hueKey: 'hslGreensHue', satKey: 'hslGreensSaturation', lumKey: 'hslGreensLuminance' },
  { label: 'Aquas', hueKey: 'hslAquasHue', satKey: 'hslAquasSaturation', lumKey: 'hslAquasLuminance' },
  { label: 'Blues', hueKey: 'hslBluesHue', satKey: 'hslBluesSaturation', lumKey: 'hslBluesLuminance' },
  { label: 'Purples', hueKey: 'hslPurplesHue', satKey: 'hslPurplesSaturation', lumKey: 'hslPurplesLuminance' },
  { label: 'Magentas', hueKey: 'hslMagentasHue', satKey: 'hslMagentasSaturation', lumKey: 'hslMagentasLuminance' },
] as const;

export const VisualEditPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const tool = wf.activeTool;
  const activeTool = tool === 'replace' ? 'object' : tool;

  const [showExamples, setShowExamples] = useState(false);
  const [materialQuery, setMaterialQuery] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [isMaterialBrowserOpen, setIsMaterialBrowserOpen] = useState(false);
  const [materialFilterCategory, setMaterialFilterCategory] = useState('All');
  const [visibleMaterialCount, setVisibleMaterialCount] = useState(MATERIAL_BROWSER_BATCH_SIZE);
  const [extendBaseSize, setExtendBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [autoSelectStatus, setAutoSelectStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [autoSelectMessage, setAutoSelectMessage] = useState('');

  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const materialReferenceInputRef = useRef<HTMLInputElement>(null);
  const autoSelectRequestIdRef = useRef(0);

  const updateWf = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

  const updateSelection = (updates: Partial<typeof wf.visualSelection>) =>
    updateWf({ visualSelection: { ...wf.visualSelection, ...updates } });
  const updateMaterial = (updates: Partial<typeof wf.visualMaterial>) =>
    updateWf({ visualMaterial: { ...wf.visualMaterial, ...updates } });
  const updateLighting = (updates: Partial<typeof wf.visualLighting>) =>
    updateWf({ visualLighting: { ...wf.visualLighting, ...updates } });
  const updateLightingSun = (updates: Partial<typeof wf.visualLighting.sun>) =>
    updateLighting({ sun: { ...wf.visualLighting.sun, ...updates } });
  const updateLightingHdri = (updates: Partial<typeof wf.visualLighting.hdri>) =>
    updateLighting({ hdri: { ...wf.visualLighting.hdri, ...updates } });
  const updateLightingArtificial = (updates: Partial<typeof wf.visualLighting.artificial>) =>
    updateLighting({ artificial: { ...wf.visualLighting.artificial, ...updates } });
  const updateSky = (updates: Partial<typeof wf.visualSky>) =>
    updateWf({ visualSky: { ...wf.visualSky, ...updates } });
  const updateObject = (updates: Partial<typeof wf.visualObject>) =>
    updateWf({ visualObject: { ...wf.visualObject, ...updates } });
  const updateRemove = (updates: Partial<typeof wf.visualRemove>) =>
    updateWf({ visualRemove: { ...wf.visualRemove, ...updates } });
  const updateReplace = (updates: Partial<typeof wf.visualReplace>) =>
    updateWf({ visualReplace: { ...wf.visualReplace, ...updates } });
  const updateAdjust = (updates: Partial<typeof wf.visualAdjust>) =>
    updateWf({ visualAdjust: { ...wf.visualAdjust, ...updates } });
  const updatePeople = (updates: Partial<typeof wf.visualPeople>) =>
    updateWf({ visualPeople: { ...wf.visualPeople, ...updates } });
  const updateExtend = (updates: Partial<typeof wf.visualExtend>) =>
    updateWf({ visualExtend: { ...wf.visualExtend, ...updates } });
  const updateBackground = (updates: Partial<typeof wf.visualBackground>) =>
    updateWf({ visualBackground: { ...wf.visualBackground, ...updates } });

  const ensureAutoSelectService = useCallback(() => {
    if (isGeminiServiceInitialized()) {
      return true;
    }
    if (!isGatewayAuthenticated()) {
      return false;
    }
    initGeminiService();
    return true;
  }, []);

  const loadImageSize = useCallback((dataUrl: string) => {
    return new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }
        resolve({ width, height });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }, []);

  const repairJson = useCallback((text: string): string => {
    let repaired = text;
    // Fix unquoted keys: e.g. , y": or { y": → , "y": or { "y":
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z_]\w*)"(\s*:)/g, '$1"$2"$3');
    // Remove trailing commas before } or ]
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    return repaired;
  }, []);

  const extractJsonPayload = useCallback((text: string) => {
    if (!text) return '';
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced ? fenced[1] : text).trim();
    const start = candidate.search(/[\[{]/);
    if (start === -1) return candidate;
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (end <= start) return candidate.slice(start);
    return candidate.slice(start, end + 1);
  }, []);

  const buildSelectionShapes = useCallback((
    payloadText: string,
    width: number,
    height: number
  ): VisualSelectionShape[] => {
    const jsonText = extractJsonPayload(payloadText);
    if (!jsonText) return [];
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Attempt repair for malformed JSON (e.g. unquoted keys from Gemini)
      try {
        parsed = JSON.parse(repairJson(jsonText));
      } catch {
        return [];
      }
    }

    const rawItems: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.polygons)
        ? parsed.polygons
        : Array.isArray(parsed?.selections)
          ? parsed.selections
          : Array.isArray(parsed?.objects)
            ? parsed.objects
            : Array.isArray(parsed?.instances)
              ? parsed.instances
              : parsed?.points || parsed?.polygon || parsed?.bbox || parsed?.box
                ? [parsed]
                : [];

    if (!rawItems.length) return [];

    const toNumber = (value: unknown) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number.parseFloat(value);
      return NaN;
    };

    const parseMaybeArray = (value: unknown) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== 'string') return null;
      try {
        const parsedArray = JSON.parse(value);
        return Array.isArray(parsedArray) ? parsedArray : null;
      } catch {
        return null;
      }
    };

    const getDistance = (a: VisualSelectionPoint, b: VisualSelectionPoint) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const getPolygonArea = (points: VisualSelectionPoint[]) => {
      let sum = 0;
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        sum += point.x * next.y - next.x * point.y;
      });
      return Math.abs(sum / 2);
    };

    const getBounds = (points: VisualSelectionPoint[]) => {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return {
        x1: Math.min(...xs),
        y1: Math.min(...ys),
        x2: Math.max(...xs),
        y2: Math.max(...ys),
      };
    };

    const getBoundsArea = (bounds: ReturnType<typeof getBounds>) =>
      Math.max(0, bounds.x2 - bounds.x1) * Math.max(0, bounds.y2 - bounds.y1);

    const getBoundsIoU = (a: ReturnType<typeof getBounds>, b: ReturnType<typeof getBounds>) => {
      const x1 = Math.max(a.x1, b.x1);
      const y1 = Math.max(a.y1, b.y1);
      const x2 = Math.min(a.x2, b.x2);
      const y2 = Math.min(a.y2, b.y2);
      const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      if (!intersection) return 0;
      const union = getBoundsArea(a) + getBoundsArea(b) - intersection;
      return union > 0 ? intersection / union : 0;
    };

    const normalizePoints = (points: unknown[]) => {
      const normalizedPoints: Array<{ x: number; y: number }> = points
        .map((point: any) => {
          if (Array.isArray(point)) {
            return { x: toNumber(point[0]), y: toNumber(point[1]) };
          }
          if (point?.point && typeof point.point === 'object') {
            return { x: toNumber(point.point.x), y: toNumber(point.point.y) };
          }
          return { x: toNumber(point.x), y: toNumber(point.y) };
        })
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

      if (!normalizedPoints.length) return [];
      const maxCoord = Math.max(...normalizedPoints.map((point) => Math.max(point.x, point.y)));

      // Detect coordinate range:
      //  - 0..1.5   → normalized 0-1 (multiply by image dimensions)
      //  - 1.5..1050 → Gemini's native 0-1000 range (divide by 1000, then multiply)
      //  - >1050    → absolute pixel coordinates (use as-is)
      const toPixel = (vx: number, vy: number) => {
        if (maxCoord <= 1.5) {
          return { x: vx * width, y: vy * height };
        }
        if (maxCoord <= 1050) {
          return { x: (vx / 1000) * width, y: (vy / 1000) * height };
        }
        return { x: vx, y: vy };
      };

      const minDistance = Math.max(2, Math.min(width, height) * 0.0025);
      const mapped = normalizedPoints.map((point) => {
        const p = toPixel(point.x, point.y);
        return {
          x: Math.round(Math.min(Math.max(p.x, 0), width)),
          y: Math.round(Math.min(Math.max(p.y, 0), height)),
        };
      });

      const deduped = mapped.filter((point, index) => {
        if (index === 0) return true;
        return getDistance(point, mapped[index - 1]) >= minDistance;
      });

      if (deduped.length > 2 && getDistance(deduped[0], deduped[deduped.length - 1]) < minDistance) {
        deduped.pop();
      }

      if (deduped.length <= 48) return deduped;
      const step = Math.ceil(deduped.length / 48);
      return deduped.filter((_, index) => index % step === 0).slice(0, 48);
    };

    const candidates: Array<{
      shape: VisualSelectionShape;
      area: number;
      bounds: ReturnType<typeof getBounds>;
      confidence: number;
    }> = [];
    const minArea = Math.max(24, width * height * 0.00001);

    rawItems.forEach((item) => {
      let points: unknown[] | null = null;
      const pointSource =
        (Array.isArray(item) ? item : null) ||
        item?.points ||
        item?.polygon ||
        item?.contour ||
        item?.outline ||
        item?.vertices;

      const pointArray = parseMaybeArray(pointSource);
      if (pointArray) {
        points = pointArray;
      } else if (item?.bbox || item?.box || item?.boundingBox || item?.bounding_box) {
        const box = item.bbox || item.box || item.boundingBox || item.bounding_box;
        const boxArray = parseMaybeArray(box);
        let x = 0;
        let y = 0;
        let w = 0;
        let h = 0;
        if (boxArray && boxArray.length >= 4) {
          const x1 = toNumber(boxArray[0]);
          const y1 = toNumber(boxArray[1]);
          const x2 = toNumber(boxArray[2]);
          const y2 = toNumber(boxArray[3]);
          if (x2 > x1 && y2 > y1) {
            x = x1;
            y = y1;
            w = x2 - x1;
            h = y2 - y1;
          } else {
            x = x1;
            y = y1;
            w = x2;
            h = y2;
          }
        } else if (box && typeof box === 'object') {
          x = toNumber(box.x ?? box.left ?? box.x1 ?? 0);
          y = toNumber(box.y ?? box.top ?? box.y1 ?? 0);
          const x2 = toNumber(box.x2 ?? box.right ?? NaN);
          const y2 = toNumber(box.y2 ?? box.bottom ?? NaN);
          if (Number.isFinite(x2) && Number.isFinite(y2)) {
            w = x2 - x;
            h = y2 - y;
          } else {
            w = toNumber(box.width ?? box.w ?? 0);
            h = toNumber(box.height ?? box.h ?? 0);
          }
        }

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h)) {
          points = [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ];
        }
      }

      if (!points) return;
      const mapped = normalizePoints(points);
      if (mapped.length < 3) return;
      const area = getPolygonArea(mapped);
      if (area < minArea) return;
      const bounds = getBounds(mapped);
      if (getBoundsArea(bounds) < minArea) return;

      candidates.push({
        shape: {
          id: nanoid(),
          type: 'lasso',
          points: mapped,
        },
        area,
        bounds,
        confidence: toNumber(item?.confidence ?? item?.score ?? 0),
      });
    });

    const sorted = candidates.sort((a, b) => {
      const confidenceDelta = b.confidence - a.confidence;
      if (Math.abs(confidenceDelta) > 0.001) return confidenceDelta;
      return b.area - a.area;
    });
    const kept: typeof candidates = [];

    sorted.forEach((candidate) => {
      if (kept.some((existing) => getBoundsIoU(candidate.bounds, existing.bounds) > 0.9)) return;
      kept.push(candidate);
    });

    return kept
      .slice(0, MAX_AUTO_SELECTION_SHAPES)
      .sort((a, b) => a.bounds.y1 - b.bounds.y1 || a.bounds.x1 - b.bounds.x1)
      .map((candidate) => candidate.shape);
  }, [extractJsonPayload, repairJson]);

  const runAutoSelection = useCallback(async (targets: string[]) => {
    if (!targets.length) return;
    if (!state.uploadedImage) {
      updateWf({ visualAutoSelecting: false });
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'warning',
          message: 'Upload an image before running auto selection.'
        }
      });
      return;
    }
    if (!ensureAutoSelectService()) {
      updateWf({ visualAutoSelecting: false });
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'warning',
          message: 'Please sign in to use AI auto selection.'
        }
      });
      return;
    }

    const requestId = autoSelectRequestIdRef.current + 1;
    autoSelectRequestIdRef.current = requestId;
    setAutoSelectStatus('loading');
    setAutoSelectMessage(`Auto-selecting ${targets.join(', ')}...`);
    updateWf({ visualAutoSelecting: true });

    const loadingStartedAt = Date.now();
    const MIN_LOADING_MS = 1500;

    try {
      const imageData = ImageUtils.dataUrlToImageData(state.uploadedImage);
      if (!imageData) {
        throw new Error('Failed to prepare image data.');
      }
      const imageSize = await loadImageSize(state.uploadedImage);
      if (!imageSize) {
        throw new Error('Failed to read image dimensions.');
      }

      const prompt = buildAutoSelectionPrompt(
        targets,
        activeTool,
        imageSize.width,
        imageSize.height,
        wf.visualPrompt
      );

      const responseText = await getGeminiService().generateText({
        prompt,
        images: [imageData],
        model: AUTO_SELECTION_MODEL,
        generationConfig: {
          temperature: 0.1,
          topP: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'high' }
        }
      });
      if (!responseText.trim()) {
        throw new Error('No text returned from auto-selection request.');
      }

      if (autoSelectRequestIdRef.current !== requestId) return;

      const shapes = buildSelectionShapes(responseText, imageSize.width, imageSize.height);
      if (!shapes.length) {
        throw new Error('No selection polygons returned.');
      }

      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          visualSelections: shapes,
          visualSelectionUndoStack: [...state.workflow.visualSelectionUndoStack, state.workflow.visualSelections],
          visualSelectionRedoStack: [],
        }
      });

      setAutoSelectStatus('idle');
      setAutoSelectMessage('');
    } catch (error) {
      if (autoSelectRequestIdRef.current !== requestId) return;
      setAutoSelectStatus('error');
      const message = error instanceof Error ? error.message : 'Auto selection failed.';
      setAutoSelectMessage(message);
      dispatch({
        type: 'SET_APP_ALERT',
        payload: {
          id: nanoid(),
          tone: 'warning',
          message: `Auto selection failed: ${message}`
        }
      });
    } finally {
      if (autoSelectRequestIdRef.current === requestId) {
        const elapsed = Date.now() - loadingStartedAt;
        const remaining = MIN_LOADING_MS - elapsed;
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        if (autoSelectRequestIdRef.current === requestId) {
          updateWf({ visualAutoSelecting: false });
        }
      }
    }
  }, [
    buildSelectionShapes,
    activeTool,
    dispatch,
    ensureAutoSelectService,
    loadImageSize,
    state.uploadedImage,
    state.workflow.visualSelectionUndoStack,
    state.workflow.visualSelections,
    wf.visualPrompt,
    updateWf
  ]);

  const handleBackgroundUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateBackground({
        referenceImage: dataUrl,
        mode: 'image'
      });
    };
    reader.readAsDataURL(file);

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  }, [updateBackground]);

  const handleRemoveBackground = useCallback(() => {
    updateBackground({
      referenceImage: null
    });
  }, [updateBackground]);

  const handleMaterialReferenceUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateMaterial({
        referenceImage: reader.result as string,
        referenceEnabled: true,
      });
    };
    reader.readAsDataURL(file);

    if (materialReferenceInputRef.current) {
      materialReferenceInputRef.current.value = '';
    }
  }, [updateMaterial]);

  const handleRemoveMaterialReference = useCallback(() => {
    updateMaterial({ referenceImage: null });
  }, [updateMaterial]);

  const selectionIds = useMemo(() => wf.visualSelections.map((shape) => shape.id), [wf.visualSelections]);
  const selectionCount = selectionIds.length;
  const objectPlacementMode = wf.visualObject.placementMode || 'place';

  useEffect(() => {
    if (tool !== 'replace') return;
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        activeTool: 'object',
        visualObject: { ...wf.visualObject, placementMode: 'replace' },
      },
    });
  }, [dispatch, tool, wf.visualObject]);

  useEffect(() => {
    if (wf.visualReplace.mode === 'custom') {
      updateReplace({ mode: 'similar' });
    }
  }, [updateReplace, wf.visualReplace.mode]);

  useEffect(() => {
    const existing = wf.visualObject.selectionIds || [];
    const isSame =
      existing.length === selectionIds.length &&
      existing.every((value, index) => value === selectionIds[index]);
    if (!isSame) {
      updateObject({ selectionIds });
    }
  }, [selectionIds, updateObject, wf.visualObject.selectionIds]);

  useEffect(() => {
    if (!state.uploadedImage) {
      setExtendBaseSize(null);
      return;
    }
    let canceled = false;
    const img = new Image();
    img.onload = () => {
      if (canceled) return;
      setExtendBaseSize({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = () => {
      if (canceled) return;
      setExtendBaseSize(null);
    };
    img.src = state.uploadedImage;
    return () => {
      canceled = true;
    };
  }, [state.uploadedImage]);

  useEffect(() => {
    if (wf.visualSelection.mode !== 'ai' || wf.visualSelection.autoTargets.length === 0) {
      setAutoSelectStatus('idle');
      setAutoSelectMessage('');
      dispatch({ type: 'UPDATE_WORKFLOW', payload: { visualAutoSelecting: false } });
    }
  }, [dispatch, wf.visualSelection.autoTargets.length, wf.visualSelection.mode]);

  useEffect(() => {
    if (!isMaterialBrowserOpen) return;
    materialSwatches.slice(0, 12).forEach((material) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = material.previewUrl;
    });
  }, [isMaterialBrowserOpen]);

  useEffect(() => {
    if (!isMaterialBrowserOpen) return;
    setVisibleMaterialCount(MATERIAL_BROWSER_BATCH_SIZE);
  }, [isMaterialBrowserOpen, materialFilterCategory, materialQuery]);

  const selectedMaterial = useMemo(
    () => getMaterialById(wf.visualMaterial.materialId),
    [wf.visualMaterial.materialId]
  );

  const displayMaterialPresets = useMemo(() => {
    const defaultMaterials = materialSwatches.slice(0, 4);
    const activeMaterial = materialSwatches.find((material) => material.id === wf.visualMaterial.materialId);
    if (activeMaterial && !defaultMaterials.some((material) => material.id === activeMaterial.id)) {
      return [...defaultMaterials.slice(0, 3), activeMaterial];
    }
    return defaultMaterials;
  }, [wf.visualMaterial.materialId]);

  const filteredMaterials = useMemo(() => {
    const query = materialQuery.trim().toLowerCase();
    return materialSwatches.filter((item) => {
      const matchesCategory = materialFilterCategory === 'All' || item.category === materialFilterCategory;
      const searchText = [item.label, item.category, item.description, ...item.tags].join(' ').toLowerCase();
      const matchesQuery = !query || searchText.includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [materialFilterCategory, materialQuery]);

  const visibleMaterials = useMemo(
    () => filteredMaterials.slice(0, visibleMaterialCount),
    [filteredMaterials, visibleMaterialCount]
  );
  const hasMoreMaterials = visibleMaterials.length < filteredMaterials.length;

  const showMoreMaterials = useCallback(() => {
    setVisibleMaterialCount((count) => Math.min(count + MATERIAL_BROWSER_BATCH_SIZE, filteredMaterials.length));
  }, [filteredMaterials.length]);

  const handleMaterialGridScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!hasMoreMaterials) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 240) {
      showMoreMaterials();
    }
  }, [hasMoreMaterials, showMoreMaterials]);

  const objectSubcategories = useMemo(() => {
    const set = new Set<string>();
    objectAssets
      .filter((asset) => asset.category === wf.visualObject.category)
      .forEach((asset) => set.add(asset.subcategory));
    return ['All', ...Array.from(set)];
  }, [wf.visualObject.category]);

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    return objectAssets.filter((asset) => {
      if (asset.category !== wf.visualObject.category) return false;
      if (wf.visualObject.subcategory !== 'All' && asset.subcategory !== wf.visualObject.subcategory) {
        return false;
      }
      if (!query) return true;
      if (asset.label.toLowerCase().includes(query)) return true;
      if (asset.subcategory.toLowerCase().includes(query)) return true;
      return asset.tags.some((tag) => tag.toLowerCase().includes(query));
    });
  }, [assetQuery, wf.visualObject.category, wf.visualObject.subcategory]);

  const objectPickerControls = (
    <>
      <div className="relative">
        <input
          className="w-full bg-surface-elevated border border-border rounded text-xs py-2 px-3 pl-8 outline-none focus:border-accent"
          placeholder="Search objects..."
          value={assetQuery}
          onChange={(event) => setAssetQuery(event.target.value)}
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted">
          <ImageIcon size={12} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-foreground-muted">Category</label>
        <SegmentedControl
          value={wf.visualObject.category}
          onChange={(value) => updateObject({ category: value as ObjectCategory, subcategory: 'All', assetId: '' })}
          options={objectCategoryOptions.map((option) => ({
            value: option.value,
            label: (
              <span className="flex items-center gap-1.5">
                <option.icon size={12} />
                <span>{option.shortLabel}</span>
              </span>
            ),
          }))}
          className="text-[10px]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-foreground-muted">Subcategory</label>
        <select
          className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
          value={objectSubcategories.includes(wf.visualObject.subcategory) ? wf.visualObject.subcategory : 'All'}
          onChange={(event) => updateObject({ subcategory: event.target.value })}
        >
          {objectSubcategories.map((subcategory) => (
            <option key={subcategory} value={subcategory}>
              {subcategory}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto custom-scrollbar p-1">
        {filteredAssets.map((asset) => {
          const active = wf.visualObject.assetId === asset.id;
          const Icon = objectIconMap[asset.icon] ?? ImageIcon;
          return (
            <button
              key={asset.id}
              className={cn(
                'aspect-square border rounded flex flex-col items-center justify-center text-[9px] transition-colors',
                active
                  ? 'border-accent bg-surface-elevated text-foreground'
                  : 'border-border bg-surface-sunken text-foreground-muted hover:border-foreground-muted hover:text-foreground'
              )}
              onClick={() => updateObject({ assetId: asset.id })}
            >
              <div className="w-8 h-8 rounded mb-1 flex items-center justify-center bg-foreground/10 text-foreground">
                <Icon size={18} />
              </div>
              <span className="px-1 text-center leading-tight">{asset.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  const objectTransformControls = (
    <>
      <div className="space-y-2 pt-2 border-t border-border-subtle">
        <SliderControl
          label="Scale"
          value={wf.visualObject.scale}
          min={10}
          max={300}
          step={1}
          unit="%"
          onChange={(value) => updateObject({ scale: value })}
        />
        <SliderControl
          label="Rotation"
          value={wf.visualObject.rotation}
          min={0}
          max={360}
          step={1}
          unit="deg"
          onChange={(value) => updateObject({ rotation: value })}
        />
        <Toggle
          label="Auto-Perspective Match"
          checked={wf.visualObject.autoPerspective}
          onChange={(value) => updateObject({ autoPerspective: value })}
        />
        <Toggle
          label="Cast Shadows"
          checked={wf.visualObject.shadow}
          onChange={(value) => updateObject({ shadow: value })}
        />
        <Toggle
          label="Ground Contact"
          checked={wf.visualObject.groundContact}
          onChange={(value) => updateObject({ groundContact: value })}
        />
      </div>

      <div className="space-y-2 pt-2 border-t border-border-subtle">
        <SegmentedControl
          value={wf.visualObject.depth}
          options={[
            { label: 'Foreground', value: 'foreground' },
            { label: 'Midground', value: 'midground' },
            { label: 'Background', value: 'background' },
          ]}
          onChange={(value) => updateObject({ depth: value })}
        />
      </div>
    </>
  );

  const handleToggleTarget = (target: string) => {
    const next = wf.visualSelection.autoTargets.includes(target)
      ? wf.visualSelection.autoTargets.filter((item) => item !== target)
      : [...wf.visualSelection.autoTargets, target];
    updateSelection({ autoTargets: next });
    if (wf.visualSelection.mode === 'ai') {
      if (next.length === 0) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          payload: {
            visualSelections: [],
            visualSelectionUndoStack: [...wf.visualSelectionUndoStack, wf.visualSelections],
            visualSelectionRedoStack: [],
            visualAutoSelecting: false,
          }
        });
        return;
      }
      runAutoSelection(next);
    }
  };

  const handleQuickRemove = (label: string) => {
    const next = wf.visualRemove.quickRemove.includes(label)
      ? wf.visualRemove.quickRemove.filter((item) => item !== label)
      : [...wf.visualRemove.quickRemove, label];
    updateRemove({ quickRemove: next });
  };

  const handleAdjustPreset = (preset: 'reset' | 'auto' | 'vivid' | 'soft' | 'dramatic') => {
    if (preset === 'reset') {
      updateAdjust({
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        gamma: 0,
        saturation: 0,
        vibrance: 0,
        temperature: 0,
        tint: 0,
        hueShift: 0,
        texture: 0,
        dehaze: 0,
        sharpness: 0,
        sharpnessRadius: 1,
        sharpnessDetail: 0,
        sharpnessMasking: 0,
        noiseReduction: 0,
        noiseReductionColor: 0,
        noiseReductionDetail: 0,
        hslChannel: 'Reds',
        hslRedsHue: 0,
        hslRedsSaturation: 0,
        hslRedsLuminance: 0,
        hslOrangesHue: 0,
        hslOrangesSaturation: 0,
        hslOrangesLuminance: 0,
        hslYellowsHue: 0,
        hslYellowsSaturation: 0,
        hslYellowsLuminance: 0,
        hslGreensHue: 0,
        hslGreensSaturation: 0,
        hslGreensLuminance: 0,
        hslAquasHue: 0,
        hslAquasSaturation: 0,
        hslAquasLuminance: 0,
        hslBluesHue: 0,
        hslBluesSaturation: 0,
        hslBluesLuminance: 0,
        hslPurplesHue: 0,
        hslPurplesSaturation: 0,
        hslPurplesLuminance: 0,
        hslMagentasHue: 0,
        hslMagentasSaturation: 0,
        hslMagentasLuminance: 0,
        colorGradeShadowsHue: 0,
        colorGradeShadowsSaturation: 0,
        colorGradeMidtonesHue: 0,
        colorGradeMidtonesSaturation: 0,
        colorGradeHighlightsHue: 0,
        colorGradeHighlightsSaturation: 0,
        colorGradeBalance: 0,
        clarity: 0,
        vignette: 0,
        vignetteMidpoint: 0,
        vignetteRoundness: 0,
        vignetteFeather: 0,
        grain: 0,
        grainSize: 0,
        grainRoughness: 0,
        bloom: 0,
        chromaticAberration: 0,
        transformRotate: 0,
        transformHorizontal: 0,
        transformVertical: 0,
        transformDistortion: 0,
        transformPerspective: 0,
        styleStrength: 0,
      });
      return;
    }

    if (preset === 'auto') {
      updateAdjust({ exposure: 8, contrast: 14, highlights: -22, shadows: 24, whites: 8, blacks: -12, clarity: 18, vibrance: 12, dehaze: 6 });
      return;
    }

    if (preset === 'vivid') {
      updateAdjust({ contrast: 24, saturation: 18, vibrance: 28, whites: 10, blacks: -14, clarity: 18, texture: 10 });
      return;
    }

    if (preset === 'soft') {
      updateAdjust({ contrast: -12, highlights: -12, shadows: 28, whites: -6, blacks: 10, clarity: -8, texture: -6 });
      return;
    }

    updateAdjust({ exposure: -4, contrast: 30, highlights: -28, shadows: -10, whites: 12, blacks: -24, saturation: 8, clarity: 24, vignette: 20, grain: 8, dehaze: 12 });
  };

  const renderToolOptions = () => {
    switch (activeTool) {
      case 'select':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Select an area, then describe what you want to change.</SectionDesc>
            <SegmentedControl
              value={wf.visualSelection.mode}
              options={[
                { label: 'Rect', value: 'rect' },
                { label: 'Brush', value: 'brush' },
                { label: 'Lasso', value: 'lasso' },
                { label: 'Auto', value: 'ai' },
                { label: 'Adjust', value: 'adjust' },
              ]}
              onChange={(value) => updateSelection({ mode: value })}
            />
            {wf.visualSelection.mode === 'adjust' && (
              <div className="rounded-md border border-blue-200 bg-blue-50/80 px-3 py-2 text-[10px] leading-relaxed text-blue-700">
                Drag a corner point to reshape. Drag an edge point to refine that edge, or drag between points to insert a new control point. Drag inside to move the whole selected shape.
              </div>
            )}
            <button
              type="button"
              onClick={() => updateSelection({ mode: 'erase' })}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors',
                wf.visualSelection.mode === 'erase'
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-surface-elevated border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
              )}
            >
              <Eraser size={14} />
              Erase Traces
            </button>

            {(wf.visualSelection.mode === 'brush' || wf.visualSelection.mode === 'erase') && (
              <div className="space-y-2">
                <SliderControl
                  label="Brush Size"
                  value={wf.visualSelection.brushSize}
                  min={10}
                  max={100}
                  step={5}
                  unit="px"
                  onChange={(value) => updateSelection({ brushSize: value })}
                />
              </div>
            )}

            {wf.visualSelection.mode === 'ai' && (
              <div className="space-y-2">
                <div className="relative">
                  <div className={cn(
                    'grid grid-cols-2 sm:grid-cols-3 gap-2 transition-opacity',
                    wf.visualAutoSelecting && 'opacity-50 pointer-events-none'
                  )}>
                    {selectionTargets.map((target) => {
                      const active = wf.visualSelection.autoTargets.includes(target);
                      return (
                        <button
                          key={target}
                          disabled={wf.visualAutoSelecting}
                          className={cn(
                            'text-[10px] border rounded px-2 py-2 transition-colors',
                            active
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground',
                            wf.visualAutoSelecting && 'cursor-not-allowed'
                          )}
                          onClick={() => handleToggleTarget(target)}
                        >
                          {target}
                        </button>
                      );
                    })}
                  </div>
                  {wf.visualAutoSelecting && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-surface-elevated/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border border-border">
                        <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-medium text-foreground-muted">
                          {autoSelectMessage || 'Auto-selecting...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {autoSelectStatus === 'error' && (
                  <div className="text-[10px] rounded-md px-2 py-1 border border-red-200 text-red-500 bg-red-50/80">
                    {autoSelectMessage || 'Auto selection failed.'}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Edit Prompt</label>
              <textarea
                value={wf.visualPrompt}
                onChange={(event) => updateWf({ visualPrompt: event.target.value })}
                placeholder="Describe what you want to change in the selected area..."
                className="w-full min-h-[96px] resize-none bg-surface-elevated border border-border rounded text-xs p-2 leading-relaxed focus:outline-none focus:border-accent"
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => setShowExamples((prev) => !prev)}
                  className="text-[10px] text-foreground-muted hover:text-foreground transition-colors"
                >
                  {showExamples ? 'Hide examples' : 'Show examples'}
                </button>
                <span className="text-[10px] text-foreground-muted">Free edit prompt</span>
              </div>
              {showExamples && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectionExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => updateWf({ visualPrompt: example })}
                      className="text-[10px] px-2 py-1 rounded border border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        );
      case 'material':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Replace surface materials and tune texture details.</SectionDesc>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateMaterial({ referenceEnabled: false })}
                  className={cn(
                    'h-8 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                    !wf.visualMaterial.referenceEnabled
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-surface-elevated border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                  )}
                >
                  <Palette size={12} />
                  <span>Presets</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateMaterial({ referenceEnabled: true })}
                  className={cn(
                    'h-8 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                    wf.visualMaterial.referenceEnabled
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-surface-elevated border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                  )}
                >
                  <ImageIcon size={12} />
                  <span>Reference Image</span>
                </button>
              </div>

              <input
                ref={materialReferenceInputRef}
                type="file"
                accept="image/*"
                onChange={handleMaterialReferenceUpload}
                className="hidden"
              />

              {wf.visualMaterial.referenceEnabled ? (
                <div className="relative h-40">
                  <button
                    type="button"
                    onClick={() => materialReferenceInputRef.current?.click()}
                    className={cn(
                      'relative h-full w-full overflow-hidden rounded-xl border transition-all duration-200 group',
                      'flex flex-col items-center justify-center gap-2 text-center',
                      wf.visualMaterial.referenceImage
                        ? 'border-border bg-surface-sunken hover:border-foreground-muted'
                        : 'border-dashed border-border bg-surface-sunken/60 hover:border-accent/60 hover:bg-surface-elevated'
                    )}
                    title={wf.visualMaterial.referenceImage ? 'Change material reference' : 'Upload material reference'}
                  >
                    {wf.visualMaterial.referenceImage ? (
                      <>
                        <img
                          src={wf.visualMaterial.referenceImage}
                          alt="Material reference"
                          className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
                        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      </>
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-border bg-surface-elevated flex items-center justify-center text-foreground-muted group-hover:text-accent transition-colors">
                        <Upload size={20} />
                      </div>
                    )}
                    <div className={cn('relative z-10 px-4', wf.visualMaterial.referenceImage ? 'text-white' : 'text-foreground')}>
                      <p className="text-xs font-bold leading-snug">
                        {wf.visualMaterial.referenceImage ? 'Change material reference' : 'Upload material reference'}
                      </p>
                      <p className={cn('mt-1 text-[10px] leading-snug', wf.visualMaterial.referenceImage ? 'text-white/75' : 'text-foreground-muted')}>
                        Use an image to match the material color, grain, pattern, seams, and finish.
                      </p>
                    </div>
                  </button>
                  {wf.visualMaterial.referenceImage && (
                    <button
                      type="button"
                      onClick={handleRemoveMaterialReference}
                      className="absolute top-2 left-2 z-20 w-7 h-7 flex items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-rose-500 transition-colors"
                      title="Remove material reference"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {displayMaterialPresets.map((material) => {
                      const active = wf.visualMaterial.materialId === material.id;
                      return (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => updateMaterial({ materialId: material.id, category: material.category, referenceEnabled: false })}
                          className={cn(
                            'relative h-16 rounded-md overflow-hidden border transition-all duration-200 text-left flex items-center group',
                            active
                              ? 'border-foreground ring-2 ring-foreground shadow-md opacity-100 z-10 scale-[1.02]'
                              : 'border-border opacity-90 hover:opacity-100 hover:border-foreground-muted hover:scale-[1.01]'
                          )}
                        >
                          <img
                            src={material.previewUrl}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            onError={(event) => {
                              event.currentTarget.src = material.fallbackPreviewUrl || fallbackMaterialPreview;
                            }}
                            className="absolute inset-0 z-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            alt={material.label}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent z-0" />
                          <div className="relative z-10 px-2 py-1 w-full min-w-0">
                            <p className="text-white text-[10px] font-bold leading-tight truncate w-full">{material.label}</p>
                            <p className="text-white/75 text-[8px] truncate font-medium">{material.sourceLabel || material.category}</p>
                          </div>
                          {active && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center z-20 shadow-sm">
                              <Check size={8} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMaterialBrowserOpen(true)}
                    className="w-full h-8 flex items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-foreground-muted hover:text-foreground hover:border-foreground-muted hover:bg-surface-elevated transition-all"
                  >
                    <Search size={12} />
                    <span>Browse all materials</span>
                  </button>
                  {selectedMaterial && (
                    <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken/50 p-2">
                      <div className="h-8 w-8 rounded-md border border-border overflow-hidden bg-surface-elevated shrink-0">
                        <img
                          src={selectedMaterial.previewUrl || fallbackMaterialPreview}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.src = selectedMaterial.fallbackPreviewUrl || fallbackMaterialPreview;
                          }}
                          className="w-full h-full object-cover"
                          alt={selectedMaterial.label}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-wider text-foreground-muted">Selected Material</div>
                        <div className="text-xs font-semibold text-foreground truncate">{selectedMaterial.label}</div>
                        <div className="text-[9px] text-foreground-muted truncate">{selectedMaterial.sourceLabel}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-border-subtle">
              <SliderControl
                label="Roughness"
                value={wf.visualMaterial.roughness}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateMaterial({ roughness: value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Color Tint</span>
              <ColorPicker color={wf.visualMaterial.colorTint} onChange={(value) => updateMaterial({ colorTint: value })} />
            </div>
          </div>
        );
      case 'lighting':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Relight the scene for a new mood and direction.</SectionDesc>
            <SegmentedControl
              value={wf.visualLighting.mode}
              options={[
                { label: 'Sun', value: 'sun' },
                { label: 'HDRI', value: 'hdri' },
                { label: 'Artificial', value: 'artificial' },
              ]}
              onChange={(value) => updateLighting({ mode: value })}
            />

            {wf.visualLighting.mode === 'sun' && (
              <div className="space-y-3">
                <SunPositionWidget
                  azimuth={wf.visualLighting.sun.azimuth}
                  elevation={wf.visualLighting.sun.elevation}
                  helperText="Directions are image-relative. Right means light enters from visible doors, windows, or bright openings on the right side of this view."
                  onChange={(azimuth, elevation) => updateLightingSun({ azimuth, elevation })}
                />
                <SliderControl
                  label="Intensity"
                  value={wf.visualLighting.sun.intensity}
                  min={0}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingSun({ intensity: value })}
                />
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-xs font-medium text-foreground">Color Temp</label>
                    <span className="text-[10px] font-mono text-foreground-muted">
                      {wf.visualLighting.sun.colorTemp}K
                    </span>
                  </div>
                  <div className="h-4 w-full relative">
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-border"
                      style={{ background: 'linear-gradient(90deg, #ff6b35, #ffd4a3, #ffffff, #9dc4ff)' }}
                    />
                    <input
                      type="range"
                      min={2000}
                      max={10000}
                      step={100}
                      value={wf.visualLighting.sun.colorTemp}
                      onChange={(event) => updateLightingSun({ colorTemp: parseInt(event.target.value, 10) })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-black/50 pointer-events-none"
                      style={{
                        left: `${((wf.visualLighting.sun.colorTemp - 2000) / 8000) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <SliderControl
                  label="Shadow Softness"
                  value={wf.visualLighting.sun.shadowSoftness}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingSun({ shadowSoftness: value })}
                />
              </div>
            )}

            {wf.visualLighting.mode === 'hdri' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {hdriPresets.map((preset) => {
                    const active = wf.visualLighting.hdri.preset === preset;
                    return (
                      <button
                        key={preset}
                        className={cn(
                          'text-xs border rounded py-2 transition-colors',
                          active
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                        )}
                        onClick={() => updateLightingHdri({ preset })}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <SliderControl
                  label="Rotation"
                  value={wf.visualLighting.hdri.rotation}
                  min={0}
                  max={360}
                  step={1}
                  unit="deg"
                  onChange={(value) => updateLightingHdri({ rotation: value })}
                />
                <SliderControl
                  label="Intensity"
                  value={wf.visualLighting.hdri.intensity}
                  min={0}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingHdri({ intensity: value })}
                />
              </div>
            )}

            {wf.visualLighting.mode === 'artificial' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">Light Type</label>
                  <select
                    className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                    value={wf.visualLighting.artificial.type}
                    onChange={(event) => updateLightingArtificial({ type: event.target.value })}
                  >
                    <option value="point">Point</option>
                    <option value="spot">Spot</option>
                    <option value="area">Area</option>
                  </select>
                </div>
                <div className="text-[10px] text-foreground-muted bg-surface-sunken border border-border rounded p-2">
                  Position picker runs on canvas. Click in the image to place the light.
                </div>
                <SliderControl
                  label="Intensity"
                  value={wf.visualLighting.artificial.intensity}
                  min={0}
                  max={200}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingArtificial({ intensity: value })}
                />
                <SliderControl
                  label="Falloff"
                  value={wf.visualLighting.artificial.falloff}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => updateLightingArtificial({ falloff: value })}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Color</span>
                  <ColorPicker
                    color={wf.visualLighting.artificial.color}
                    onChange={(value) => updateLightingArtificial({ color: value })}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <SliderControl
                label="Ambient Light"
                value={wf.visualLighting.ambient}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateLighting({ ambient: value })}
              />
            </div>
          </div>
        );
      case 'object':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Place new objects or replace existing ones guided by the selection.</SectionDesc>
            <div className="rounded-lg border border-border bg-surface-sunken/60 p-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-foreground-muted">
                <span>{objectPlacementMode === 'replace' ? 'Replacement Target' : 'Placement Target'}</span>
                <span className={selectionCount > 0 ? 'text-foreground' : 'text-foreground-muted'}>Selection</span>
              </div>
              <div className="text-[11px] text-foreground-muted mt-1">
                {selectionCount > 0
                  ? objectPlacementMode === 'replace'
                    ? `${selectionCount} selected area${selectionCount === 1 ? '' : 's'} will guide replacement.`
                    : `${selectionCount} selected area${selectionCount === 1 ? '' : 's'} will guide placement.`
                  : objectPlacementMode === 'replace'
                    ? 'Use the Select tool to define the area to replace.'
                    : 'Use the Select tool to define a placement area.'}
              </div>
            </div>
            <SegmentedControl
              value={objectPlacementMode}
              options={[
                { label: 'Place New', value: 'place' },
                { label: 'Replace Existing', value: 'replace' },
              ]}
              onChange={(value) => updateObject({ placementMode: value })}
            />

            {objectPlacementMode === 'place' ? (
              <>
                {objectPickerControls}
                {objectTransformControls}
              </>
            ) : (
              <>
                <SegmentedControl
                  value={wf.visualReplace.mode === 'custom' ? 'similar' : wf.visualReplace.mode}
                  options={[
                    { label: 'Similar', value: 'similar' },
                    { label: 'Different', value: 'different' },
                  ]}
                  onChange={(value) => updateReplace({ mode: value })}
                />

                {wf.visualReplace.mode === 'similar' && (
                  <>
                    <SliderControl
                      label="Variation"
                      value={wf.visualReplace.variation}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(value) => updateReplace({ variation: value })}
                    />
                    <div className="text-[11px] text-foreground-muted">
                      Auto-matching similar objects from the selection. Category and asset choices are disabled.
                    </div>
                  </>
                )}

                {wf.visualReplace.mode === 'different' && objectPickerControls}
                {objectTransformControls}
              </>
            )}
          </div>
        );
      case 'people': {
        const people = wf.visualPeople;
        const peopleMode = people.mode === 'repopulate' ? 'repopulate' : 'enhance';

        return (
          <div className="space-y-2 animate-fade-in">
            <SectionDesc>
              {peopleMode === 'enhance'
                ? 'Re-render existing 3D people more realistically while preserving their scene placement.'
                : 'Edit and refine people in airport renderings — adjust demographics, wardrobe, luggage, and behavior.'}
            </SectionDesc>

            {peopleMode !== 'enhance' && (
              <div className="rounded-md border border-border bg-surface-sunken/60 px-2.5 py-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-foreground-muted">
                  <span>Scope</span>
                  <span className={selectionCount > 0 ? 'text-foreground' : ''}>
                    {selectionCount > 0 ? `${selectionCount} area${selectionCount === 1 ? '' : 's'}` : 'Full frame'}
                  </span>
                </div>
              </div>
            )}

            {/* Operation Mode */}
            <SegmentedControl
              value={peopleMode}
              options={[
                { label: 'Enhance', value: 'enhance' },
                { label: 'Repopulate', value: 'repopulate' },
              ]}
              onChange={(value) => updatePeople({ mode: value })}
            />
            <div className="text-[10px] text-foreground-muted -mt-0.5">
              {peopleMode === 'enhance'
                ? 'Re-render existing 3D people as realistic humans while preserving pose, placement, scale, and scene integration.'
                : 'Replace or add people to match desired look and density.'}
            </div>

            {peopleMode !== 'enhance' && (
              <>
            {/* Airport Zone */}
            <PeopleSection title="Airport Zone">
              <SingleChipGrid2
                items={[
                  { value: 'terminal-general', label: 'Terminal' },
                  { value: 'check-in', label: 'Check-in' },
                  { value: 'security', label: 'Security' },
                  { value: 'departure-gate', label: 'Dep. Gate' },
                  { value: 'arrival-hall', label: 'Arrivals' },
                  { value: 'baggage-claim', label: 'Bag. Claim' },
                  { value: 'retail-area', label: 'Retail' },
                  { value: 'food-court', label: 'Food Court' },
                  { value: 'lounge', label: 'Lounge' },
                  { value: 'transit-corridor', label: 'Transit' },
                ]}
                value={people.airportZone}
                onChange={(value) => updatePeople({ airportZone: value as typeof people.airportZone })}
              />
            </PeopleSection>

            {/* Demographics */}
            <PeopleSection title="Demographics">
              <SectionLabel right={<AllToggle count={people.regionMix.length} total={regionOptions.length} onToggle={() => updatePeople({ regionMix: people.regionMix.length === regionOptions.length ? [] : regionOptions.map(o => o.value) })} />}>
                Ethnicity / Region
              </SectionLabel>
              <ChipGrid3
                items={regionOptions}
                selected={people.regionMix}
                onToggle={(val) => updatePeople({ regionMix: toggleChip(people.regionMix, val) })}
              />

              <SectionLabel>Age</SectionLabel>
              <SingleChipGrid2
                items={[
                  { value: 'young-adults', label: 'Young Adults' },
                  { value: 'adults', label: 'Adults' },
                  { value: 'mixed-all-ages', label: 'Mixed Ages' },
                  { value: 'families', label: 'Families' },
                  { value: 'elderly-included', label: '+ Elderly' },
                ]}
                value={people.ageDistribution}
                onChange={(value) => updatePeople({ ageDistribution: value as typeof people.ageDistribution })}
              />

              <SectionLabel>Gender</SectionLabel>
              <SegmentedControl
                value={people.genderBalance}
                options={[
                  { label: 'Balanced', value: 'balanced' },
                  { label: 'Male-lean', value: 'male-leaning' },
                  { label: 'Female-lean', value: 'female-leaning' },
                ]}
                onChange={(value) => updatePeople({ genderBalance: value })}
              />
              <SliderControl label="Children" value={people.childrenPresence} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ childrenPresence: value })} />
              <SliderControl label="Body Type Variety" value={people.bodyTypeVariety} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ bodyTypeVariety: value })} />
            </PeopleSection>

            {/* Crowd */}
            <PeopleSection title="Crowd & Flow">
              <SliderControl label="Density" value={people.density} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ density: value })} />

              <SectionLabel>Grouping</SectionLabel>
              <SingleChipGrid2
                items={[
                  { value: 'solo-dominant', label: 'Solo' },
                  { value: 'couples', label: 'Couples' },
                  { value: 'families', label: 'Families' },
                  { value: 'business-groups', label: 'Groups' },
                  { value: 'mixed-groups', label: 'Mixed' },
                ]}
                value={people.grouping}
                onChange={(value) => updatePeople({ grouping: value as typeof people.grouping })}
              />

              <SectionLabel>Flow</SectionLabel>
              <SingleChipGrid2
                items={[
                  { value: 'random', label: 'Random' },
                  { value: 'directional', label: 'Directional' },
                  { value: 'converging', label: 'Converging' },
                  { value: 'dispersing', label: 'Dispersing' },
                  { value: 'queuing', label: 'Queuing' },
                ]}
                value={people.flowPattern}
                onChange={(value) => updatePeople({ flowPattern: value as typeof people.flowPattern })}
              />

              <SectionLabel>Direction</SectionLabel>
              <SingleChipGrid3
                items={[
                  { value: 'mixed', label: 'Mixed' },
                  { value: 'mostly-left', label: 'Left' },
                  { value: 'mostly-right', label: 'Right' },
                  { value: 'toward-camera', label: 'Toward' },
                  { value: 'away-from-camera', label: 'Away' },
                ]}
                value={people.movementDirection}
                onChange={(value) => updatePeople({ movementDirection: value as typeof people.movementDirection })}
              />

              <SectionLabel>Pace</SectionLabel>
              <SegmentedControl
                value={people.paceOfMovement}
                options={[
                  { label: 'Relaxed', value: 'relaxed' },
                  { label: 'Moderate', value: 'moderate' },
                  { label: 'Hurried', value: 'hurried' },
                  { label: 'Mixed', value: 'mixed' },
                ]}
                onChange={(value) => updatePeople({ paceOfMovement: value })}
              />
              <SliderControl label="Clustering" value={people.clusteringTendency} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ clusteringTendency: value })} />
            </PeopleSection>

            {/* Wardrobe */}
            <PeopleSection title="Wardrobe">
              <SectionLabel>Style</SectionLabel>
              <SingleChipGrid3
                items={[
                  { value: 'business', label: 'Business' },
                  { value: 'casual', label: 'Casual' },
                  { value: 'travel', label: 'Travel' },
                  { value: 'luxury', label: 'Luxury' },
                  { value: 'sporty', label: 'Sporty' },
                  { value: 'mixed', label: 'Mixed' },
                ]}
                value={people.wardrobeStyle}
                onChange={(value) => updatePeople({ wardrobeStyle: value as typeof people.wardrobeStyle })}
              />

              <SectionLabel>Season</SectionLabel>
              <SingleChipGrid3
                items={[
                  { value: 'summer', label: 'Summer' },
                  { value: 'winter', label: 'Winter' },
                  { value: 'spring-fall', label: 'Spring' },
                  { value: 'tropical', label: 'Tropical' },
                  { value: 'mixed', label: 'Mixed' },
                ]}
                value={people.seasonalClothing}
                onChange={(value) => updatePeople({ seasonalClothing: value as typeof people.seasonalClothing })}
              />
              <SliderControl label="Formality" value={people.formalityLevel} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ formalityLevel: value })} />
              <SliderControl label="Cultural Attire" value={people.culturalAttire} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ culturalAttire: value })} />
            </PeopleSection>

            {/* Activities */}
            <PeopleSection title="Activities" defaultOpen={false}>
              <SectionLabel right={<AllToggle count={people.activities.length} total={activityOptions.length} onToggle={() => updatePeople({ activities: people.activities.length === activityOptions.length ? [] : activityOptions.map(o => o.value) })} />}>
                Behavior
              </SectionLabel>
              <ChipGrid3
                items={activityOptions}
                selected={people.activities}
                onToggle={(val) => updatePeople({ activities: toggleChip(people.activities, val) })}
              />
              <SliderControl label="Interaction" value={people.interactionLevel} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ interactionLevel: value })} />
            </PeopleSection>

            {/* Luggage */}
            <PeopleSection title="Luggage & Props" defaultOpen={false}>
              <SectionLabel right={<AllToggle count={people.luggageTypes.length} total={luggageTypeOptions.length} onToggle={() => updatePeople({ luggageTypes: people.luggageTypes.length === luggageTypeOptions.length ? [] : luggageTypeOptions.map(o => o.value) })} />}>
                Types
              </SectionLabel>
              <ChipGrid3
                items={luggageTypeOptions}
                selected={people.luggageTypes}
                onToggle={(val) => updatePeople({ luggageTypes: toggleChip(people.luggageTypes, val) })}
              />
              <SliderControl label="Amount" value={people.luggageAmount} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ luggageAmount: value })} />
              <SliderControl label="Trolleys" value={people.trolleyUsage} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ trolleyUsage: value })} />
              <SliderControl label="Devices" value={people.personalDevices} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ personalDevices: value })} />
              <SliderControl label="Accessories" value={people.travelAccessories} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ travelAccessories: value })} />
            </PeopleSection>

            {/* Staff */}
            <PeopleSection title="Staff & Crew" defaultOpen={false}>
              <Toggle label="Airport Staff" checked={people.includeAirportStaff} onChange={(value) => updatePeople({ includeAirportStaff: value })} />
              <Toggle label="Security" checked={people.includeSecurityPersonnel} onChange={(value) => updatePeople({ includeSecurityPersonnel: value })} />
              <Toggle label="Airline Crew" checked={people.includeAirlineCrew} onChange={(value) => updatePeople({ includeAirlineCrew: value })} />
              <Toggle label="Ground Crew" checked={people.includeGroundCrew} onChange={(value) => updatePeople({ includeGroundCrew: value })} />
              <Toggle label="Service Staff" checked={people.includeServiceStaff} onChange={(value) => updatePeople({ includeServiceStaff: value })} />
              <SliderControl
                label="Staff Ratio"
                value={people.staffDensity}
                min={0} max={50} step={1} unit="%"
                disabled={!people.includeAirportStaff && !people.includeSecurityPersonnel && !people.includeAirlineCrew && !people.includeGroundCrew && !people.includeServiceStaff}
                onChange={(value) => updatePeople({ staffDensity: value })}
              />
            </PeopleSection>

            {/* Quality */}
            <PeopleSection title="Quality" defaultOpen={false}>
              <SliderControl label="Realism" value={people.realism} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ realism: value })} />
              <SliderControl label="Sharpness" value={people.sharpness} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ sharpness: value })} />
              <SliderControl label="Scale Accuracy" value={people.scaleAccuracy} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ scaleAccuracy: value })} />
              <SliderControl label="Placement" value={people.placementDiscipline} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ placementDiscipline: value })} />
              <SliderControl label="Motion Blur" value={people.motionBlur} min={0} max={100} step={1} unit="%" onChange={(value) => updatePeople({ motionBlur: value })} />
            </PeopleSection>

            {/* Advanced */}
            <PeopleSection title="Advanced" defaultOpen={false}>
              <Toggle label="Preserve Existing" checked={people.preserveExisting} onChange={(value) => updatePeople({ preserveExisting: value })} />
              <Toggle label="Match Lighting" checked={people.matchLighting} onChange={(value) => updatePeople({ matchLighting: value })} />
              <Toggle label="Match Perspective" checked={people.matchPerspective} onChange={(value) => updatePeople({ matchPerspective: value })} />
              <Toggle label="Ground Contact" checked={people.groundContact} onChange={(value) => updatePeople({ groundContact: value })} />
              <Toggle label="Remove Artifacts" checked={people.removeArtifacts} onChange={(value) => updatePeople({ removeArtifacts: value })} />
            </PeopleSection>
              </>
            )}
          </div>
        );
      }
      case 'sky':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Replace sky and tune atmosphere.</SectionDesc>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {skyPresets.map((preset) => {
                const active = wf.visualSky.preset === preset;
                return (
                  <button
                    key={preset}
                    className={cn(
                      'text-xs border rounded py-2 transition-colors',
                      active
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                    )}
                    onClick={() => updateSky({ preset })}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <SliderControl
                label="Horizon Line"
                value={wf.visualSky.horizonLine}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ horizonLine: value })}
              />
              <SliderControl
                label="Cloud Density"
                value={wf.visualSky.cloudDensity}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ cloudDensity: value })}
              />
              <SliderControl
                label="Atmospheric Haze"
                value={wf.visualSky.atmosphere}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ atmosphere: value })}
              />
              <SliderControl
                label="Sky Brightness"
                value={wf.visualSky.brightness}
                min={0}
                max={200}
                step={1}
                unit="%"
                onChange={(value) => updateSky({ brightness: value })}
              />
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <Toggle
                label="Reflect in Glass/Water"
                checked={wf.visualSky.reflectInGlass}
                onChange={(value) => updateSky({ reflectInGlass: value })}
              />
              <Toggle
                label="Match Building Lighting"
                checked={wf.visualSky.matchLighting}
                onChange={(value) => updateSky({ matchLighting: value })}
              />
              <Toggle
                label="Add Sun Flare"
                checked={wf.visualSky.sunFlare}
                onChange={(value) => updateSky({ sunFlare: value })}
              />
            </div>
          </div>
        );
      case 'remove':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>Remove the main subject centered in each selection and rebuild the background.</SectionDesc>
            <div className="rounded-md border border-border bg-surface-sunken/60 px-3 py-2.5 text-xs leading-relaxed text-foreground-muted">
              Click Apply Edits to remove the content inside your selection. You can also choose targets from the Quick Remove list to auto-remove them.
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Quick Remove</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {removeQuickOptions.map((option) => {
                  const active = wf.visualRemove.quickRemove.includes(option);
                  return (
                    <button
                      key={option}
                      className={cn(
                        'text-[10px] border rounded py-2 transition-colors',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                      )}
                      onClick={() => handleQuickRemove(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <Toggle
                label="Auto-Detect Edges"
                checked={wf.visualRemove.autoDetectEdges}
                onChange={(value) => updateRemove({ autoDetectEdges: value })}
              />
              <Toggle
                label="Preserve Structure"
                checked={wf.visualRemove.preserveStructure}
                onChange={(value) => updateRemove({ preserveStructure: value })}
              />
            </div>
          </div>
        );
      case 'adjust':
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Aspect Ratio</label>
              <div className="grid grid-cols-5 gap-2">
                {(['same', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => updateAdjust({ aspectRatio: ratio })}
                    className={cn(
                      "text-[10px] border rounded py-2 transition-colors",
                      wf.visualAdjust.aspectRatio === ratio
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground"
                    )}
                  >
                    {ratio === 'same' ? 'Same' : ratio}
                  </button>
                ))}
              </div>
            </div>
            <SectionDesc>Global image adjustments and presets.</SectionDesc>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Tone</label>
              <SliderControl
                label="Exposure"
                value={wf.visualAdjust.exposure}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ exposure: value })}
              />
              <SliderControl
                label="Contrast"
                value={wf.visualAdjust.contrast}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ contrast: value })}
              />
              <SliderControl
                label="Highlights"
                value={wf.visualAdjust.highlights}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ highlights: value })}
              />
              <SliderControl
                label="Shadows"
                value={wf.visualAdjust.shadows}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ shadows: value })}
              />
              <SliderControl
                label="Whites"
                value={wf.visualAdjust.whites}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ whites: value })}
              />
              <SliderControl
                label="Blacks"
                value={wf.visualAdjust.blacks}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ blacks: value })}
              />
              <SliderControl
                label="Gamma"
                value={wf.visualAdjust.gamma}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ gamma: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Color</label>
              <SliderControl
                label="Saturation"
                value={wf.visualAdjust.saturation}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ saturation: value })}
              />
              <SliderControl
                label="Vibrance"
                value={wf.visualAdjust.vibrance}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vibrance: value })}
              />
              <SliderControl
                label="Temperature"
                value={wf.visualAdjust.temperature}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ temperature: value })}
              />
              <SliderControl
                label="Tint"
                value={wf.visualAdjust.tint}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ tint: value })}
              />
              <SliderControl
                label="Hue Shift"
                value={wf.visualAdjust.hueShift}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ hueShift: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Presence</label>
              <SliderControl
                label="Texture"
                value={wf.visualAdjust.texture}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ texture: value })}
              />
              <SliderControl
                label="Clarity"
                value={wf.visualAdjust.clarity}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ clarity: value })}
              />
              <SliderControl
                label="Dehaze"
                value={wf.visualAdjust.dehaze}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ dehaze: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">HSL</label>
              <select
                className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                value={
                  hslChannelOptions.some((option) => option.label === wf.visualAdjust.hslChannel)
                    ? wf.visualAdjust.hslChannel
                    : 'Reds'
                }
                onChange={(event) => updateAdjust({ hslChannel: event.target.value })}
              >
                {hslChannelOptions.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(() => {
                const active = hslChannelOptions.find((option) => option.label === wf.visualAdjust.hslChannel) ?? hslChannelOptions[0];
                const hueKey = active.hueKey as keyof typeof wf.visualAdjust;
                const satKey = active.satKey as keyof typeof wf.visualAdjust;
                const lumKey = active.lumKey as keyof typeof wf.visualAdjust;
                return (
                  <>
                    <SliderControl
                      label="Hue"
                      value={wf.visualAdjust[hueKey] as number}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateAdjust({ [hueKey]: value } as any)}
                    />
                    <SliderControl
                      label="Saturation"
                      value={wf.visualAdjust[satKey] as number}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateAdjust({ [satKey]: value } as any)}
                    />
                    <SliderControl
                      label="Luminance"
                      value={wf.visualAdjust[lumKey] as number}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateAdjust({ [lumKey]: value } as any)}
                    />
                  </>
                );
              })()}
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Color Grading</label>
              <SliderControl
                label="Shadows Hue"
                value={wf.visualAdjust.colorGradeShadowsHue}
                min={-180}
                max={180}
                step={1}
                unit="deg"
                onChange={(value) => updateAdjust({ colorGradeShadowsHue: value })}
              />
              <SliderControl
                label="Shadows Sat"
                value={wf.visualAdjust.colorGradeShadowsSaturation}
                min={-100}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateAdjust({ colorGradeShadowsSaturation: value })}
              />
              <SliderControl
                label="Midtones Hue"
                value={wf.visualAdjust.colorGradeMidtonesHue}
                min={-180}
                max={180}
                step={1}
                unit="deg"
                onChange={(value) => updateAdjust({ colorGradeMidtonesHue: value })}
              />
              <SliderControl
                label="Midtones Sat"
                value={wf.visualAdjust.colorGradeMidtonesSaturation}
                min={-100}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateAdjust({ colorGradeMidtonesSaturation: value })}
              />
              <SliderControl
                label="Highlights Hue"
                value={wf.visualAdjust.colorGradeHighlightsHue}
                min={-180}
                max={180}
                step={1}
                unit="deg"
                onChange={(value) => updateAdjust({ colorGradeHighlightsHue: value })}
              />
              <SliderControl
                label="Highlights Sat"
                value={wf.visualAdjust.colorGradeHighlightsSaturation}
                min={-100}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateAdjust({ colorGradeHighlightsSaturation: value })}
              />
              <SliderControl
                label="Balance"
                value={wf.visualAdjust.colorGradeBalance}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ colorGradeBalance: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Detail</label>
              <SliderControl
                label="Sharpness"
                value={wf.visualAdjust.sharpness}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ sharpness: value })}
              />
              <SliderControl
                label="Sharpen Radius"
                value={wf.visualAdjust.sharpnessRadius}
                min={0.5}
                max={3}
                step={0.1}
                onChange={(value) => updateAdjust({ sharpnessRadius: value })}
              />
              <SliderControl
                label="Sharpen Detail"
                value={wf.visualAdjust.sharpnessDetail}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ sharpnessDetail: value })}
              />
              <SliderControl
                label="Sharpen Masking"
                value={wf.visualAdjust.sharpnessMasking}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ sharpnessMasking: value })}
              />
              <SliderControl
                label="Noise Reduction (Luma)"
                value={wf.visualAdjust.noiseReduction}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ noiseReduction: value })}
              />
              <SliderControl
                label="Noise Reduction (Color)"
                value={wf.visualAdjust.noiseReductionColor}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ noiseReductionColor: value })}
              />
              <SliderControl
                label="Noise Detail"
                value={wf.visualAdjust.noiseReductionDetail}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ noiseReductionDetail: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Effects</label>
              <SliderControl
                label="Vignette"
                value={wf.visualAdjust.vignette}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vignette: value })}
              />
              <SliderControl
                label="Vignette Midpoint"
                value={wf.visualAdjust.vignetteMidpoint}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vignetteMidpoint: value })}
              />
              <SliderControl
                label="Vignette Roundness"
                value={wf.visualAdjust.vignetteRoundness}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vignetteRoundness: value })}
              />
              <SliderControl
                label="Vignette Feather"
                value={wf.visualAdjust.vignetteFeather}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ vignetteFeather: value })}
              />
              <SliderControl
                label="Grain Amount"
                value={wf.visualAdjust.grain}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ grain: value })}
              />
              <SliderControl
                label="Grain Size"
                value={wf.visualAdjust.grainSize}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ grainSize: value })}
              />
              <SliderControl
                label="Grain Roughness"
                value={wf.visualAdjust.grainRoughness}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ grainRoughness: value })}
              />
              <SliderControl
                label="Bloom"
                value={wf.visualAdjust.bloom}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ bloom: value })}
              />
              <SliderControl
                label="Chromatic Aberration"
                value={wf.visualAdjust.chromaticAberration}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ chromaticAberration: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Transform</label>
              <SliderControl
                label="Rotate"
                value={wf.visualAdjust.transformRotate}
                min={-45}
                max={45}
                step={0.5}
                unit="deg"
                onChange={(value) => updateAdjust({ transformRotate: value })}
              />
              <SliderControl
                label="Horizontal"
                value={wf.visualAdjust.transformHorizontal}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ transformHorizontal: value })}
              />
              <SliderControl
                label="Vertical"
                value={wf.visualAdjust.transformVertical}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ transformVertical: value })}
              />
              <SliderControl
                label="Distortion"
                value={wf.visualAdjust.transformDistortion}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ transformDistortion: value })}
              />
              <SliderControl
                label="Perspective"
                value={wf.visualAdjust.transformPerspective}
                min={-100}
                max={100}
                step={1}
                onChange={(value) => updateAdjust({ transformPerspective: value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground">Global</label>
              <SliderControl
                label="Style Strength"
                value={wf.visualAdjust.styleStrength}
                min={-100}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateAdjust({ styleStrength: value })}
              />
            </div>

            <div className="pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-foreground mb-2 block">Presets</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('reset')}
                >
                  Reset All
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('auto')}
                >
                  Auto-Enhance
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('vivid')}
                >
                  Vivid
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('soft')}
                >
                  Soft
                </button>
                <button
                  type="button"
                  className="text-[10px] py-2 border border-border rounded hover:border-foreground-muted hover:text-foreground transition-colors"
                  onClick={() => handleAdjustPreset('dramatic')}
                >
                  Dramatic
                </button>
              </div>
            </div>
          </div>
        );
      case 'extend':
        {
          const ratioMap: Record<string, number> = {
            '16:9': 16 / 9,
            '21:9': 21 / 9,
            '4:3': 4 / 3,
            '1:1': 1,
            '9:16': 9 / 16,
          };
          const baseSize = extendBaseSize;
          const baseWidth = baseSize?.width ?? 1920;
          const baseHeight = baseSize?.height ?? 1080;
          const baseRatio = baseWidth / baseHeight;
          const customRatioValue =
            wf.visualExtend.customRatio.width > 0 && wf.visualExtend.customRatio.height > 0
              ? wf.visualExtend.customRatio.width / wf.visualExtend.customRatio.height
              : baseRatio;
          const resolveRatioValue = (ratioKey: string) =>
            ratioKey === 'custom' ? customRatioValue : ratioMap[ratioKey] ?? baseRatio;

          const computeTargetSize = (ratioKey: string, amount: number) => {
            const ratioValue = resolveRatioValue(ratioKey);
            let width = baseWidth;
            let height = baseHeight;

            if (ratioKey === 'custom') {
              const scale = 1 + amount / 100;
              width = Math.round(baseWidth * scale);
              height = Math.round(baseHeight * scale);
              if (ratioValue) {
                if (ratioValue > baseRatio) {
                  width = Math.round(height * ratioValue);
                } else {
                  height = Math.round(width / ratioValue);
                }
              }
            } else if (ratioValue) {
              if (ratioValue > baseRatio) {
                width = Math.round(baseHeight * ratioValue);
              } else if (ratioValue < baseRatio) {
                height = Math.round(baseWidth / ratioValue);
              }
            }

            return { width, height, ratioValue };
          };

          const targetSize = computeTargetSize(
            wf.visualExtend.targetAspectRatio,
            wf.visualExtend.amount
          );
          const extensionPx = Math.max(targetSize.width - baseWidth, targetSize.height - baseHeight, 0);
          const extensionDenom =
            targetSize.ratioValue && targetSize.ratioValue > baseRatio ? baseWidth : baseHeight;
          const extensionPct = extensionDenom ? Math.round((extensionPx / extensionDenom) * 100) : 0;

          const handleRatioChange = (value: string) => {
            if (value === 'custom') {
              updateExtend({ targetAspectRatio: value });
              return;
            }
            const nextTarget = computeTargetSize(value, wf.visualExtend.amount);
            const nextExtensionPx = Math.max(nextTarget.width - baseWidth, nextTarget.height - baseHeight, 0);
            const denom = nextTarget.ratioValue && nextTarget.ratioValue > baseRatio ? baseWidth : baseHeight;
            const derivedAmount = denom ? Math.max(10, Math.round((nextExtensionPx / denom) * 100)) : wf.visualExtend.amount;
            updateExtend({ targetAspectRatio: value as any, amount: derivedAmount });
          };

          return (
            <div className="space-y-4 animate-fade-in">
              <SectionDesc>Extend your image. AI automatically continues the scene.</SectionDesc>

              <div>
                <label className="text-xs font-medium text-foreground mb-2 block">Direction</label>
                <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
                  {[
                    { key: 'top-left', icon: ArrowUpLeft },
                    { key: 'top', icon: ArrowUp },
                    { key: 'top-right', icon: ArrowUpRight },
                    { key: 'left', icon: ArrowLeft },
                    { key: 'none', label: '○' },
                    { key: 'right', icon: ArrowRight },
                    { key: 'bottom-left', icon: ArrowDownLeft },
                    { key: 'bottom', icon: ArrowDown },
                    { key: 'bottom-right', icon: ArrowDownRight },
                  ].map((item) => {
                    const active = wf.visualExtend.direction === item.key;
                    if ('label' in item) {
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={cn(
                            'aspect-square border rounded flex items-center justify-center text-xs font-bold transition-colors',
                            active
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-surface-sunken border-border hover:border-foreground-muted hover:text-foreground'
                          )}
                          onClick={() => updateExtend({ direction: item.key as any })}
                        >
                          {item.label}
                        </button>
                      );
                    }

                    const DirectionIcon = item.icon;

                    return (
                      <button
                        key={item.key}
                        className={cn(
                          'aspect-square border rounded flex items-center justify-center transition-colors',
                          active ? 'bg-foreground text-background border-foreground' : 'border-border hover:border-foreground-muted'
                        )}
                        onClick={() => updateExtend({ direction: item.key as any })}
                      >
                        <DirectionIcon size={14} strokeWidth={2.3} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface-sunken p-3 text-[10px] text-foreground-muted space-y-1">
                <div className="flex justify-between">
                  <span>Current</span>
                  <span className="font-mono">
                    {baseSize ? `${baseWidth} × ${baseHeight}` : '--'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Result</span>
                  <span className="font-mono">
                    {baseSize ? `${targetSize.width} × ${targetSize.height}` : '--'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Extension</span>
                  <span className="font-mono">
                    {baseSize ? `+${extensionPx}px (${extensionPct}%)` : '--'}
                  </span>
                </div>
              </div>

              <SliderControl
                label="Extension Amount"
                value={wf.visualExtend.amount}
                min={10}
                max={200}
                step={1}
                unit="%"
                onChange={(value) => updateExtend({ amount: value })}
              />
            </div>
          );
        }
      case 'background':
        return (
          <div className="space-y-4 animate-fade-in">
            <SectionDesc>
              Choose how to define the background around your selected area. Use a freeform prompt or a reference image.
            </SectionDesc>

            <SegmentedControl
              value={wf.visualBackground.mode}
              options={[
                { label: 'Prompt', value: 'prompt' },
                { label: 'Reference Image', value: 'image' },
              ]}
              onChange={(value) => updateBackground({ mode: value })}
            />

            {wf.visualBackground.mode === 'prompt' ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground mb-2 block">Background Prompt</label>
                <textarea
                  value={wf.visualBackground.prompt}
                  onChange={(event) => updateBackground({ prompt: event.target.value })}
                  placeholder="Describe the background you want (e.g., misty forest, urban skyline at dusk)..."
                  className="w-full min-h-[96px] resize-none bg-surface-elevated border border-border rounded text-xs p-2 leading-relaxed focus:outline-none focus:border-accent"
                />
                <div className="text-[10px] text-foreground-muted">
                  This prompt controls only the background. The selected area stays untouched.
                </div>
              </div>
            ) : (
              <>
                {/* Hidden file input */}
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />

                {/* Image Upload/Preview */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">Reference Image</label>
                  {wf.visualBackground.referenceImage ? (
                    <div className="relative group aspect-video rounded-lg border border-border overflow-hidden bg-surface-sunken">
                      <img
                        src={wf.visualBackground.referenceImage}
                        alt="Background reference"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => backgroundInputRef.current?.click()}
                          className="p-2 bg-surface-elevated hover:bg-surface-sunken rounded-lg text-foreground-secondary hover:text-foreground transition-colors"
                          title="Replace image"
                        >
                          <Upload size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveBackground}
                          className="p-2 bg-surface-elevated hover:bg-surface-sunken rounded-lg text-foreground-secondary hover:text-foreground transition-colors"
                          title="Remove image"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => backgroundInputRef.current?.click()}
                      className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-surface-sunken transition-all flex flex-col items-center justify-center gap-2 text-foreground-muted hover:text-foreground group"
                    >
                      <div className="w-10 h-10 rounded-full bg-surface-sunken group-hover:bg-surface-elevated flex items-center justify-center transition-colors">
                        <ImageIcon size={20} />
                      </div>
                      <div className="text-xs font-medium">Click to upload</div>
                      <div className="text-[10px] text-foreground-muted">JPEG, PNG, WebP</div>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground mb-2 block">Reference Behavior</label>
                  <SegmentedControl
                    value={wf.visualBackground.referenceMode}
                    options={[
                      { label: 'Exact Match', value: 'absolute' },
                      { label: 'Creative Reference', value: 'reference' },
                    ]}
                    onChange={(value) => updateBackground({ referenceMode: value })}
                  />
                  <div className="p-3 bg-surface-sunken rounded-lg border border-border-subtle">
                    <p className="text-[10px] text-foreground-secondary leading-relaxed">
                      {wf.visualBackground.referenceMode === 'absolute'
                        ? 'Use the reference image as the exact background composition. Integrate the preserved area into that scene.'
                        : 'Use the reference image as inspiration. Match its mood and environment, but allow creative variation.'}
                    </p>
                  </div>
                </div>

                {/* Settings */}
                {wf.visualBackground.referenceImage && (
                  <>
                    <div className="pt-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">Match Perspective</label>
                        <Toggle
                          enabled={wf.visualBackground.matchPerspective}
                          onChange={(enabled) => updateBackground({ matchPerspective: enabled })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">Match Lighting</label>
                        <Toggle
                          enabled={wf.visualBackground.matchLighting}
                          onChange={(enabled) => updateBackground({ matchLighting: enabled })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">Seamless Blend</label>
                        <Toggle
                          enabled={wf.visualBackground.seamlessBlend}
                          onChange={(enabled) => updateBackground({ seamlessBlend: enabled })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">Preserve Depth</label>
                        <Toggle
                          enabled={wf.visualBackground.preserveDepth}
                          onChange={(enabled) => updateBackground({ preserveDepth: enabled })}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-foreground mb-2 block">Quality</label>
                        <select
                          className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
                          value={wf.visualBackground.quality}
                          onChange={(e) => updateBackground({ quality: e.target.value as any })}
                        >
                          <option value="draft">Draft (fast)</option>
                          <option value="standard">Standard</option>
                          <option value="high">High (slower)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      default:
        return (
          <div className="p-8 flex flex-col items-center justify-center text-center h-full">
            <div className="w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center mb-3 text-foreground-muted">
              <Wrench size={24} />
            </div>
            <p className="text-xs text-foreground-muted">Select a tool from the left toolbar to configure its settings.</p>
          </div>
        );
    }
  };

  const toolLabel = useMemo(() => {
    switch (activeTool) {
      case 'select':
        return 'Select';
      case 'material':
        return 'Material';
      case 'lighting':
        return 'Lighting';
      case 'object':
        return 'Object';
      case 'people':
        return 'People';
      case 'sky':
        return 'Sky';
      case 'remove':
        return 'Remove';
      case 'replace':
        return 'Replace';
      case 'adjust':
        return 'Adjust';
      case 'extend':
        return 'Extend';
      case 'background':
        return 'Background';
      default:
        return 'Tool';
    }
  }, [activeTool]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
          <Wrench size={16} className="text-accent" />
          <h3 className="text-sm font-bold text-foreground">{toolLabel} Settings</h3>
        </div>
        {renderToolOptions()}
      </div>

      {isMaterialBrowserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setIsMaterialBrowserOpen(false)}
        >
          <div
            className="w-[760px] max-w-[94vw] h-[560px] max-h-[86vh] bg-background flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-border animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-9 border-b border-border flex items-center justify-between px-4 bg-surface-elevated shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-surface-sunken flex items-center justify-center text-foreground-secondary">
                  <ImageIcon size={14} />
                </div>
                <div className="text-xs font-bold tracking-tight">Material Browser</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground-muted" size={12} />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="h-7 pl-7 pr-2 text-[10px] bg-surface-sunken border-transparent rounded-md focus:bg-surface-elevated focus:border-accent focus:outline-none transition-all w-36"
                    value={materialQuery}
                    onChange={(event) => setMaterialQuery(event.target.value)}
                  />
                </div>
                <button
                  onClick={() => setIsMaterialBrowserOpen(false)}
                  className="p-1.5 hover:bg-surface-sunken rounded-md text-foreground-muted hover:text-foreground transition-colors border border-transparent hover:border-border"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="p-2 flex flex-col gap-2 bg-surface-elevated flex-1 overflow-hidden">
              <div className="flex gap-1.5 overflow-x-auto custom-scrollbar py-0.5 pr-1 flex-nowrap">
                {materialCategories.map((category) => {
                  const active = materialFilterCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setMaterialFilterCategory(category)}
                      className={cn(
                        'px-2 py-1 rounded-full text-[10px] border transition-colors',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                      )}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto custom-scrollbar p-1 flex-1 auto-rows-max"
                onScroll={handleMaterialGridScroll}
              >
                {visibleMaterials.map((material) => {
                  const active = wf.visualMaterial.materialId === material.id;
                  return (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => {
                        updateMaterial({ materialId: material.id, category: material.category, referenceEnabled: false });
                        setIsMaterialBrowserOpen(false);
                      }}
                      className={cn(
                        'aspect-[4/3] min-h-[112px] rounded-md border overflow-hidden relative text-[9px] font-semibold transition-all bg-surface-sunken group text-left',
                        active
                          ? 'border-foreground ring-1 ring-foreground shadow-sm'
                          : 'border-border hover:border-foreground-muted hover:shadow-sm'
                      )}
                    >
                      <img
                        src={material.previewUrl}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onError={(event) => {
                          event.currentTarget.src = material.fallbackPreviewUrl || fallbackMaterialPreview;
                        }}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        alt={material.label}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/12 to-transparent" />
                      {active && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center shadow-md">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 text-white min-w-0">
                        <div className="text-[10px] font-semibold leading-tight truncate">{material.label}</div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[8px] text-white/75">
                          <span className="truncate">{material.category}</span>
                          <span className="shrink-0">{material.sourceLabel}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredMaterials.length === 0 && (
                  <div className="col-span-full h-28 rounded-md border border-dashed border-border flex items-center justify-center text-[10px] text-foreground-muted">
                    No materials found
                  </div>
                )}
                {hasMoreMaterials && (
                  <button
                    type="button"
                    onClick={showMoreMaterials}
                    className="col-span-full h-9 rounded-md border border-border bg-surface-sunken text-[10px] font-medium text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors"
                  >
                    Load more materials
                  </button>
                )}
              </div>
            </div>

            <div className="h-7 bg-surface-sunken border-t border-border flex items-center justify-between px-3 text-[9px] text-foreground-muted shrink-0">
              <span>{Math.min(visibleMaterials.length, filteredMaterials.length)} of {filteredMaterials.length} materials</span>
              <span>photo texture references</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
