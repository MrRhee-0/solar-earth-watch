import type { EventWitness, MagPoint, PlasmaPoint } from "../data/types";
import { addHours, parseUtcTime } from "../utils/dateRange";

export interface CarrierWindow {
  start: Date;
  end: Date;
}

export function carrierWindowForEvent(
  selectedEvent: EventWitness | null
): CarrierWindow | null {
  if (!selectedEvent) {
    return null;
  }

  const startMs = parseUtcTime(selectedEvent.startTime);
  const end = addHours(selectedEvent.startTime, 96);

  if (Number.isNaN(startMs) || !end) {
    return null;
  }

  return {
    start: new Date(startMs),
    end
  };
}

export function pointInsideWindow(
  timeTag: string,
  window: CarrierWindow
): boolean {
  const pointMs = parseUtcTime(timeTag);
  return (
    Number.isFinite(pointMs) &&
    pointMs >= window.start.getTime() &&
    pointMs <= window.end.getTime()
  );
}

export function hasCarrierAlignment(
  selectedEvent: EventWitness | null,
  plasma: PlasmaPoint[],
  mag: MagPoint[]
): boolean {
  const window = carrierWindowForEvent(selectedEvent);

  if (!window) {
    return false;
  }

  return (
    plasma.some((point) => pointInsideWindow(point.timeTag, window)) &&
    mag.some((point) => pointInsideWindow(point.timeTag, window))
  );
}

export function overlappingEventCandidates(
  selectedEvent: EventWitness | null,
  eventCandidates: EventWitness[]
): EventWitness[] {
  const window = carrierWindowForEvent(selectedEvent);

  if (!selectedEvent || !window) {
    return [];
  }

  return eventCandidates.filter(
    (event) =>
      event.id !== selectedEvent.id && pointInsideWindow(event.startTime, window)
  );
}
