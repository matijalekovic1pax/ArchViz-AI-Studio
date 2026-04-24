export const SCENE_COMPOSE_MARKER_COLORS = [
  '#0EA5E9',
  '#F97316',
  '#10B981',
  '#A855F7',
  '#F43F5E',
  '#14B8A6',
  '#EAB308',
  '#6366F1',
];

export const getSceneComposeMarkerColor = (index: number) =>
  SCENE_COMPOSE_MARKER_COLORS[index % SCENE_COMPOSE_MARKER_COLORS.length];
