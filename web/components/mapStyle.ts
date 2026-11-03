import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

// A dark palette in the spirit of Apple Maps' dark mode, sampled from the iOS app's screenshots:
// slate-blue land, deep blue water, teal parks, and soft blue-grey roads with light labels.
const COLORS = {
  land: '#33465a',
  landLight: '#3a4d61',
  building: '#3d5064',
  park: '#1d5552',
  water: '#1a3478',
  waterLabel: '#8fa9e0',
  path: '#45576b',
  street: '#4f6177',
  majorCasing: '#2b3a4c',
  major: '#66788d',
  motorway: '#7d8da1',
  rail: '#4a5b6f',
  boundary: '#7a8aa0',
  label: '#d9e0e8',
  labelMuted: '#aab6c4',
  labelHalo: '#26354a',
};

// Layer ids in OpenFreeMap's styles, matched by prefix, to the color each one gets
const LAYER_COLORS: [prefix: string, color: string][] = [
  ['background', COLORS.land],
  ['water_name', COLORS.waterLabel],
  ['waterway', COLORS.water],
  ['water', COLORS.water],
  ['landcover', COLORS.landLight],
  ['landuse_residential', COLORS.land],
  ['landuse_park', COLORS.park],
  ['park', COLORS.park],
  ['building', COLORS.building],
  ['road_area_pier', COLORS.land],
  ['road_pier', COLORS.land],
  ['highway_path', COLORS.path],
  ['highway_minor', COLORS.street],
  ['highway_major_casing', COLORS.majorCasing],
  ['highway_major', COLORS.major],
  ['highway_motorway_casing', COLORS.majorCasing],
  ['highway_motorway', COLORS.motorway],
  ['railway', COLORS.rail],
  ['boundary', COLORS.boundary],
  ['highway_name', COLORS.labelMuted],
  ['place_suburb', COLORS.labelMuted],
  ['place_other', COLORS.labelMuted],
  ['place', COLORS.label],
];

// Layers that only add clutter at city scale (and landcover_wood needs a texture the style doesn't ship)
const HIDDEN_LAYERS = ['landcover_wood', 'road_oneway', 'road_oneway_opposite', 'aeroway-taxiway', 'aeroway-runway-casing', 'aeroway-area', 'aeroway-runway'];

function recolor(layer: LayerSpecification): LayerSpecification {
  const color = LAYER_COLORS.find(([prefix]) => layer.id.startsWith(prefix))?.[1];
  if (!color) return layer;
  switch (layer.type) {
    case 'background':
      return { ...layer, paint: { ...layer.paint, 'background-color': color } };
    case 'fill': {
      // Drop outlines and textures so areas read as flat, soft shapes
      const { 'fill-pattern': _pattern, ...paint } = layer.paint ?? {};
      return { ...layer, paint: { ...paint, 'fill-color': color, 'fill-outline-color': color } };
    }
    case 'line':
      return { ...layer, paint: { ...layer.paint, 'line-color': color } };
    case 'symbol': {
      const halo = layer.id.startsWith('water') ? COLORS.water : COLORS.labelHalo;
      return { ...layer, paint: { ...layer.paint, 'text-color': color, 'text-halo-color': halo, 'text-halo-width': 1.2 } };
    }
    default:
      return layer;
  }
}

// Applied to OpenFreeMap's dark style as it loads: hides the busy layers and repaints the rest
export const appleLikeStyle = (style: StyleSpecification): StyleSpecification => ({
  ...style,
  layers: style.layers.filter((layer) => !HIDDEN_LAYERS.includes(layer.id)).map(recolor),
});
