import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./data/clients/donkiClient", () => ({
  fetchDonkiEvents: vi.fn(async () => ({
    status: "live",
    data: [
      {
        id: "X-render",
        eventType: "CME",
        startTime: "2026-06-15T02:00:00Z",
        endTime: null,
        linkedEvents: [],
        instruments: ["SOHO/LASCO"],
        sourceLocation: "N14E32",
        activeRegionNum: null,
        catalog: "DONKI",
        raw: {},
        source: "NASA_DONKI"
      }
    ]
  }))
}));

vi.mock("./data/clients/swpcClient", () => ({
  fetchPlasma: vi.fn(async () => ({
    status: "live",
    data: [
      {
        timeTag: "2026-06-15T06:00:00Z",
        density: 6,
        speed: 420,
        temperature: 90000,
        source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
      }
    ]
  })),
  fetchMag: vi.fn(async () => ({
    status: "live",
    data: [
      {
        timeTag: "2026-06-15T06:00:00Z",
        bxGsm: 1,
        byGsm: 0,
        bzGsm: -3,
        bt: 4,
        latGsm: 2,
        lonGsm: 300,
        source: "NOAA_SWPC_SOLAR_WIND_MAG"
      }
    ]
  })),
  fetchKp: vi.fn(async () => ({
    status: "live",
    data: [
      {
        timeTag: "2026-06-15T09:00:00Z",
        kp: 3.33,
        source: "NOAA_SWPC_KP"
      }
    ]
  }))
}));

vi.mock("./data/clients/helioviewerClient", () => ({
  fetchSolarImage: vi.fn(async () => ({
    status: "live",
    data: {
      imageUrl: "https://example.invalid/sun.png",
      timestamp: "2026-06-15T02:00:00Z",
      sourceId: 10,
      observatory: "SDO",
      instrument: "AIA",
      measurement: "171",
      source: "HELIOVIEWER"
    }
  }))
}));

describe("App", () => {
  it("renders the dashboard shell without crashing", async () => {
    render(<App />);

    expect(await screen.findByText("Solar Earth Watch")).toBeInTheDocument();
    expect(
      screen.getByText("Live solar-event witnesses from Sun to Earth")
    ).toBeInTheDocument();
    expect(await screen.findByText("TCT Packet Status")).toBeInTheDocument();
  });
});
