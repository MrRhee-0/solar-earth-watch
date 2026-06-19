import plasmaFixture from "../fixtures/plasma.fixture.json";
import magFixture from "../fixtures/mag.fixture.json";
import kpFixture from "../fixtures/kp.fixture.json";
import { normalizeKp, normalizeMag, normalizePlasma } from "../normalize/normalizeSwpc";
import type { KpPoint, MagPoint, PlasmaPoint, SourceResult } from "../types";
import { fetchJson } from "../../utils/fetchJson";

const PLASMA_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json";
const MAG_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json";
const KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "source fetch failure: unknown SWPC fetch error";
}

export async function fetchPlasma(): Promise<SourceResult<PlasmaPoint[]>> {
  try {
    const data = await fetchJson<unknown>(PLASMA_URL);
    return {
      status: "live",
      data: normalizePlasma(data)
    };
  } catch (error) {
    return {
      status: "fixture",
      data: normalizePlasma(plasmaFixture, "FIXTURE"),
      error: errorMessage(error)
    };
  }
}

export async function fetchMag(): Promise<SourceResult<MagPoint[]>> {
  try {
    const data = await fetchJson<unknown>(MAG_URL);
    return {
      status: "live",
      data: normalizeMag(data)
    };
  } catch (error) {
    return {
      status: "fixture",
      data: normalizeMag(magFixture, "FIXTURE"),
      error: errorMessage(error)
    };
  }
}

export async function fetchKp(): Promise<SourceResult<KpPoint[]>> {
  try {
    const data = await fetchJson<unknown>(KP_URL);
    return {
      status: "live",
      data: normalizeKp(data)
    };
  } catch (error) {
    return {
      status: "fixture",
      data: normalizeKp(kpFixture, "FIXTURE"),
      error: errorMessage(error)
    };
  }
}
