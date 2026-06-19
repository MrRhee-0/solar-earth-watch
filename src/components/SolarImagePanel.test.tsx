import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SolarImageWitness } from "../data/types";
import { SolarImagePanel } from "./SolarImagePanel";

const imageWitness: SolarImageWitness = {
  imageUrl: "/api/helioviewer/v2/takeScreenshot/?display=true",
  timestamp: "2026-06-15T01:39:00Z",
  sourceId: 10,
  observatory: "SDO",
  instrument: "AIA",
  measurement: "171",
  metadataStatus: "live",
  imageFetchStatus: "live",
  renderStatus: "not_attempted",
  error: null,
  source: "HELIOVIEWER"
};

describe("SolarImagePanel", () => {
  it("shows unavailable witness when imageUrl is null", () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={{ ...imageWitness, imageUrl: null, renderStatus: "missing_url" }}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    expect(screen.getByText("unavailable witness")).toBeInTheDocument();
    expect(
      screen.getByText("Solar image witness has no renderable image URL.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/failure classification: unavailable_witness/i)
    ).toBeInTheDocument();
  });

  it("updates render status to render_error when the browser image fails", () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={imageWitness}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    fireEvent.error(screen.getByAltText("Recent Sun image witness"));

    expect(onRenderStatusChange).toHaveBeenLastCalledWith("render_error");
    expect(
      screen.getByText("Solar image URL failed browser render.")
    ).toBeInTheDocument();
    expect(screen.getByText(imageWitness.imageUrl ?? "")).toBeInTheDocument();
  });

  it("updates render status to rendered when the browser image loads", () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={imageWitness}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    fireEvent.load(screen.getByAltText("Recent Sun image witness"));

    expect(onRenderStatusChange).toHaveBeenLastCalledWith("rendered");
    expect(screen.getByText("IMAGE RENDER: rendered")).toBeInTheDocument();
  });
});
