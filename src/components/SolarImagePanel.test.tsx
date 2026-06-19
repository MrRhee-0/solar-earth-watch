import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function setImageDimensions(
  image: HTMLElement,
  dimensions: {
    naturalWidth: number;
    naturalHeight: number;
    clientWidth?: number;
    clientHeight?: number;
  }
) {
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: dimensions.naturalWidth
  });
  Object.defineProperty(image, "naturalHeight", {
    configurable: true,
    value: dimensions.naturalHeight
  });
  Object.defineProperty(image, "clientWidth", {
    configurable: true,
    value: dimensions.clientWidth ?? dimensions.naturalWidth
  });
  Object.defineProperty(image, "clientHeight", {
    configurable: true,
    value: dimensions.clientHeight ?? dimensions.naturalHeight
  });
}

describe("SolarImagePanel", () => {
  it("shows missing_url and unavailable witness when imageUrl is null", async () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={{ ...imageWitness, imageUrl: null, renderStatus: "missing_url" }}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    expect(screen.getByText("unavailable witness")).toBeInTheDocument();
    expect(
      screen.getAllByText("Solar image witness has no renderable image URL.")
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/failure classification: unavailable_witness/i)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(onRenderStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "missing_url",
          naturalWidth: null,
          naturalHeight: null
        })
      )
    );
  });

  it("emits rendered witness when onLoad reports nonzero natural dimensions", () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={imageWitness}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    const image = screen.getByAltText("Recent Sun image witness");
    setImageDimensions(image, {
      naturalWidth: 1024,
      naturalHeight: 1024,
      clientWidth: 384,
      clientHeight: 384
    });

    fireEvent.load(image);

    expect(onRenderStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "rendered",
        naturalWidth: 1024,
        naturalHeight: 1024,
        clientWidth: 384,
        clientHeight: 384,
        error: null
      })
    );
    expect(screen.getByText("BROWSER RENDER: rendered")).toBeInTheDocument();
    expect(
      screen.getByText("Solar image render witness preserved.")
    ).toBeInTheDocument();
  });

  it("emits render_error when onLoad reports zero natural dimensions", () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={imageWitness}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    const image = screen.getByAltText("Recent Sun image witness");
    setImageDimensions(image, {
      naturalWidth: 0,
      naturalHeight: 1024,
      clientWidth: 384,
      clientHeight: 384
    });

    fireEvent.load(image);

    expect(onRenderStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "render_error",
        naturalWidth: 0,
        naturalHeight: 1024,
        error: "Solar image loaded with zero natural dimensions."
      })
    );
    expect(
      screen.getAllByText("Solar image URL failed browser render.").length
    ).toBeGreaterThan(0);
  });

  it("emits render_error when the browser image fails", () => {
    const onRenderStatusChange = vi.fn();

    render(
      <SolarImagePanel
        witness={imageWitness}
        onRenderStatusChange={onRenderStatusChange}
      />
    );

    fireEvent.error(screen.getByAltText("Recent Sun image witness"));

    expect(onRenderStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "render_error",
        naturalWidth: null,
        naturalHeight: null,
        error: "Solar image URL failed browser render."
      })
    );
    expect(
      screen.getAllByText("Solar image URL failed browser render.").length
    ).toBeGreaterThan(0);
    expect(screen.getByText(imageWitness.imageUrl ?? "")).toBeInTheDocument();
  });
});
