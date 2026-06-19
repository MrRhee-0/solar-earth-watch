import type { KpPoint, MagPoint, PlasmaPoint } from "../types";
import { toNullableNumber } from "../../utils/number";

type HeaderMap = Map<string, number>;

function normalizeKey(key: unknown): string {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function hasHeaderRow(rows: unknown[]): boolean {
  return (
    Array.isArray(rows[0]) &&
    (rows[0] as unknown[]).some((cell) => normalizeKey(cell).includes("time"))
  );
}

function headerMap(headerRow: unknown[]): HeaderMap {
  return new Map(headerRow.map((cell, index) => [normalizeKey(cell), index]));
}

function readArray(
  row: unknown[],
  header: HeaderMap | null,
  keys: string[],
  fallbackIndex: number
): unknown {
  if (header) {
    for (const key of keys) {
      const index = header.get(normalizeKey(key));
      if (index !== undefined) {
        return row[index];
      }
    }
  }

  return row[fallbackIndex];
}

function rows(data: unknown): { items: unknown[]; header: HeaderMap | null } {
  if (!Array.isArray(data)) {
    return { items: [], header: null };
  }

  if (hasHeaderRow(data)) {
    return {
      items: data.slice(1),
      header: headerMap(data[0] as unknown[])
    };
  }

  return { items: data, header: null };
}

export function normalizePlasma(
  data: unknown,
  source: PlasmaPoint["source"] = "NOAA_SWPC_SOLAR_WIND_PLASMA"
): PlasmaPoint[] {
  const parsed = rows(data);

  return parsed.items
    .map((row) => {
      if (Array.isArray(row)) {
        return {
          timeTag: String(
            readArray(row, parsed.header, ["time_tag", "timeTag", "time"], 0) ??
              ""
          ),
          density: toNullableNumber(
            readArray(row, parsed.header, ["density", "proton_density"], 1)
          ),
          speed: toNullableNumber(
            readArray(row, parsed.header, ["speed", "bulk_speed"], 2)
          ),
          temperature: toNullableNumber(
            readArray(row, parsed.header, ["temperature", "temp"], 3)
          ),
          source
        };
      }

      if (isRecord(row)) {
        return {
          timeTag: String(firstValue(row, ["time_tag", "timeTag", "time"]) ?? ""),
          density: toNullableNumber(
            firstValue(row, ["density", "proton_density"])
          ),
          speed: toNullableNumber(firstValue(row, ["speed", "bulk_speed"])),
          temperature: toNullableNumber(
            firstValue(row, ["temperature", "temp"])
          ),
          source
        };
      }

      return null;
    })
    .filter((point): point is PlasmaPoint => Boolean(point?.timeTag));
}

export function normalizeMag(
  data: unknown,
  source: MagPoint["source"] = "NOAA_SWPC_SOLAR_WIND_MAG"
): MagPoint[] {
  const parsed = rows(data);

  return parsed.items
    .map((row) => {
      if (Array.isArray(row)) {
        return {
          timeTag: String(
            readArray(row, parsed.header, ["time_tag", "timeTag", "time"], 0) ??
              ""
          ),
          bxGsm: toNullableNumber(
            readArray(row, parsed.header, ["bx_gsm", "bxGsm", "bx"], 1)
          ),
          byGsm: toNullableNumber(
            readArray(row, parsed.header, ["by_gsm", "byGsm", "by"], 2)
          ),
          bzGsm: toNullableNumber(
            readArray(row, parsed.header, ["bz_gsm", "bzGsm", "bz"], 3)
          ),
          lonGsm: toNullableNumber(
            readArray(row, parsed.header, ["lon_gsm", "lonGsm", "longitude"], 4)
          ),
          latGsm: toNullableNumber(
            readArray(row, parsed.header, ["lat_gsm", "latGsm", "latitude"], 5)
          ),
          bt: toNullableNumber(readArray(row, parsed.header, ["bt"], 6)),
          source
        };
      }

      if (isRecord(row)) {
        return {
          timeTag: String(firstValue(row, ["time_tag", "timeTag", "time"]) ?? ""),
          bxGsm: toNullableNumber(firstValue(row, ["bx_gsm", "bxGsm", "bx"])),
          byGsm: toNullableNumber(firstValue(row, ["by_gsm", "byGsm", "by"])),
          bzGsm: toNullableNumber(firstValue(row, ["bz_gsm", "bzGsm", "bz"])),
          bt: toNullableNumber(firstValue(row, ["bt"])),
          latGsm: toNullableNumber(
            firstValue(row, ["lat_gsm", "latGsm", "latitude"])
          ),
          lonGsm: toNullableNumber(
            firstValue(row, ["lon_gsm", "lonGsm", "longitude"])
          ),
          source
        };
      }

      return null;
    })
    .filter((point): point is MagPoint => Boolean(point?.timeTag));
}

export function normalizeKp(
  data: unknown,
  source: KpPoint["source"] = "NOAA_SWPC_KP"
): KpPoint[] {
  const parsed = rows(data);

  return parsed.items
    .map((row) => {
      if (Array.isArray(row)) {
        return {
          timeTag: String(
            readArray(row, parsed.header, ["time_tag", "timeTag", "time"], 0) ??
              ""
          ),
          kp: toNullableNumber(readArray(row, parsed.header, ["kp", "k_index"], 1)),
          source
        };
      }

      if (isRecord(row)) {
        return {
          timeTag: String(firstValue(row, ["time_tag", "timeTag", "time"]) ?? ""),
          kp: toNullableNumber(firstValue(row, ["kp", "k_index"])),
          source
        };
      }

      return null;
    })
    .filter((point): point is KpPoint => Boolean(point?.timeTag));
}
