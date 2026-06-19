import { describe, expect, it } from "vitest";
import { normalizeKp, normalizeMag, normalizePlasma } from "./normalizeSwpc";

describe("normalize SWPC products", () => {
  it("normalizes plasma header-row arrays", () => {
    const points = normalizePlasma([
      ["time_tag", "density", "speed", "temperature"],
      ["2026-06-15 00:00:00.000", "6.4", "386.2", "75200"]
    ]);

    expect(points).toEqual([
      {
        timeTag: "2026-06-15 00:00:00.000",
        density: 6.4,
        speed: 386.2,
        temperature: 75200,
        source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
      }
    ]);
  });

  it("normalizes magnetometer objects", () => {
    const points = normalizeMag([
      {
        time_tag: "2026-06-15T00:00:00Z",
        bx_gsm: "1.3",
        by_gsm: "-2.1",
        bz_gsm: "-4.7",
        bt: "5.6",
        lat_gsm: "-22",
        lon_gsm: "302"
      }
    ]);

    expect(points[0]).toMatchObject({
      bxGsm: 1.3,
      byGsm: -2.1,
      bzGsm: -4.7,
      bt: 5.6,
      latGsm: -22,
      lonGsm: 302
    });
  });

  it("normalizes Kp rows", () => {
    const points = normalizeKp([
      ["time_tag", "kp"],
      ["2026-06-15 00:00:00.000", "2.33"]
    ]);

    expect(points[0]).toEqual({
      timeTag: "2026-06-15 00:00:00.000",
      kp: 2.33,
      source: "NOAA_SWPC_KP"
    });
  });
});
