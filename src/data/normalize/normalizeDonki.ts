import type { EventType, EventWitness } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function asStringOrNumber(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return null;
}

function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (isRecord(item)) {
        return (
          asString(item.activityID) ??
          asString(item.id) ??
          asString(item.displayName) ??
          asString(item.name)
        );
      }

      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function normalizeType(eventType: string): EventType {
  if (["FLR", "CME", "GST", "HSS", "IPS", "SEP"].includes(eventType)) {
    return eventType as EventType;
  }

  return "UNKNOWN";
}

export function normalizeDonkiEvents(
  eventType: EventType,
  data: unknown
): EventWitness[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item, index): EventWitness | null => {
      if (!isRecord(item)) {
        return null;
      }

      const type = normalizeType(eventType);
      const startTime =
        firstString(item, [
          "beginTime",
          "startTime",
          "eventTime",
          "peakTime",
          "time21_5",
          "messageIssueTime"
        ]) ?? "";

      const id =
        firstString(item, [
          "flrID",
          "cmeID",
          "gstID",
          "hssID",
          "ipsID",
          "sepID",
          "activityID",
          "id"
        ]) ?? `${type}-${startTime || "unresolved-start"}-${index}`;

      return {
        id,
        eventType: type,
        startTime,
        endTime: firstString(item, ["endTime", "eventEndTime"]),
        linkedEvents: listStrings(item.linkedEvents),
        instruments: listStrings(item.instruments),
        sourceLocation: firstString(item, ["sourceLocation", "location"]),
        activeRegionNum: asStringOrNumber(item.activeRegionNum),
        catalog: firstString(item, ["catalog", "catalogName"]),
        raw: item,
        source: "NASA_DONKI"
      };
    })
    .filter((event): event is EventWitness => Boolean(event?.startTime));
}
