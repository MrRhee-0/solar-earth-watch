export type WitnessSource =
  | "NASA_DONKI"
  | "NOAA_SWPC_SOLAR_WIND_PLASMA"
  | "NOAA_SWPC_SOLAR_WIND_MAG"
  | "NOAA_SWPC_KP"
  | "HELIOVIEWER"
  | "FIXTURE";

export type SourceStatus =
  | "live"
  | "fixture"
  | "unavailable"
  | "error";

export type RenderStatus =
  | "not_attempted"
  | "loading"
  | "rendered"
  | "render_error"
  | "missing_url";

export interface SolarImageRenderWitness {
  status: RenderStatus;
  naturalWidth: number | null;
  naturalHeight: number | null;
  clientWidth: number | null;
  clientHeight: number | null;
  observedAt: string | null;
  error?: string | null;
}

export type EventType =
  | "FLR"
  | "CME"
  | "GST"
  | "HSS"
  | "IPS"
  | "SEP"
  | "UNKNOWN";

export interface EventWitness {
  id: string;
  eventType: EventType;
  startTime: string;
  endTime?: string | null;
  linkedEvents: string[];
  instruments: string[];
  sourceLocation?: string | null;
  activeRegionNum?: string | number | null;
  catalog?: string | null;
  raw: unknown;
  source: "NASA_DONKI";
}

export interface PlasmaPoint {
  timeTag: string;
  density: number | null;
  speed: number | null;
  temperature: number | null;
  source: "NOAA_SWPC_SOLAR_WIND_PLASMA" | "FIXTURE";
}

export interface MagPoint {
  timeTag: string;
  bxGsm: number | null;
  byGsm: number | null;
  bzGsm: number | null;
  bt: number | null;
  latGsm: number | null;
  lonGsm: number | null;
  source: "NOAA_SWPC_SOLAR_WIND_MAG" | "FIXTURE";
}

export interface KpPoint {
  timeTag: string;
  kp: number | null;
  source: "NOAA_SWPC_KP" | "FIXTURE";
}

export interface SolarImageWitness {
  imageUrl: string | null;
  timestamp: string | null;
  sourceId: number | string | null;
  observatory: string | null;
  instrument: string | null;
  measurement: string | null;
  metadataStatus: SourceStatus;
  imageFetchStatus: SourceStatus;
  renderStatus: RenderStatus;
  error?: string | null;
  source: "HELIOVIEWER" | "FIXTURE";
}

export interface SourceResult<T> {
  status: SourceStatus;
  data: T;
  error?: string;
}
