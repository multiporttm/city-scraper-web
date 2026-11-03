// The parts of Apple's MapKit JS (loaded from cdn.apple-mapkit.com) that the app uses.
// Full reference: https://developer.apple.com/documentation/mapkitjs
declare namespace mapkit {
  function init(options: { authorizationCallback: (done: (token: string) => void) => void; language?: string }): void;
  function addEventListener(type: 'configuration-change', listener: (event: { status: string }) => void): void;
  function addEventListener(type: 'error', listener: (event: { status: string }) => void): void;

  const FeatureVisibility: { Adaptive: string; Hidden: string; Visible: string };

  class Coordinate {
    constructor(latitude: number, longitude: number);
    latitude: number;
    longitude: number;
  }

  class CoordinateSpan {
    constructor(latitudeDelta: number, longitudeDelta: number);
    latitudeDelta: number;
    longitudeDelta: number;
  }

  class CoordinateRegion {
    constructor(center: Coordinate, span: CoordinateSpan);
    center: Coordinate;
    span: CoordinateSpan;
  }

  class Padding {
    constructor(top: number, right: number, bottom: number, left: number);
  }

  type AnnotationOptions = {
    title?: string;
    calloutEnabled?: boolean;
    animates?: boolean;
    anchorOffset?: DOMPoint;
    size?: { width: number; height: number };
  };

  class Annotation {
    constructor(coordinate: Coordinate, factory: (coordinate: Coordinate, options: AnnotationOptions) => Element, options?: AnnotationOptions);
    selected: boolean;
  }

  type MapOptions = {
    colorScheme?: string;
    showsPointsOfInterest?: boolean;
    showsCompass?: string;
    showsZoomControl?: boolean;
    showsMapTypeControl?: boolean;
    showsUserLocationControl?: boolean;
    showsScale?: string;
    isRotationEnabled?: boolean;
    region?: CoordinateRegion;
    padding?: Padding;
  };

  class Map {
    static ColorSchemes: { Dark: string; Light: string };
    constructor(parent: HTMLElement, options?: MapOptions);
    region: CoordinateRegion;
    padding: Padding;
    setRegionAnimated(region: CoordinateRegion, animate?: boolean): this;
    addAnnotation(annotation: Annotation): Annotation;
    removeAnnotation(annotation: Annotation): Annotation;
    convertPointOnPageToCoordinate(point: DOMPoint): Coordinate;
    addEventListener(type: 'select', listener: (event: { annotation?: Annotation }) => void): void;
    addEventListener(type: 'scroll-start' | 'zoom-start' | 'single-tap' | 'region-change-end', listener: () => void): void;
    destroy(): void;
  }
}

interface Window {
  mapkit?: typeof mapkit;
}
