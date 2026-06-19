import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SourceDiagnostics } from "./PacketStatusPanel";
import { PacketStatusPanel } from "./PacketStatusPanel";
import type { TctPacketStatus } from "../tct/packetTypes";
import type { EventCarrierAlignment } from "../tct/alignment";

const diagnostics: SourceDiagnostics = {
  helioviewerMetadataStatus: "live",
  helioviewerImageFetchStatus: "live",
  helioviewerRenderStatus: "rendered",
  helioviewerEvidenceStatus: "live_rendered",
  imageUrl: "/api/helioviewer/v2/takeScreenshot/?display=true",
  proxiedImageUrl: "/api/helioviewer/v2/takeScreenshot/?display=true",
  selectedUrl: "/api/helioviewer/v2/takeScreenshot/?display=true",
  attemptedUrlCount: 1,
  fallbackReason: null,
  isLiveImage: true,
  isFallbackImage: false,
  remoteHelioviewerEndpointPath: "/v2/takeScreenshot/?display=true",
  imageUrlBeginsWithApiHelioviewer: true,
  displayTruePresent: true,
  layersContainSdoAia171: true,
  naturalWidth: 1024,
  naturalHeight: 1024,
  clientWidth: 384,
  clientHeight: 384,
  renderObservedAt: "2026-06-19T16:00:00Z",
  renderError: null,
  donkiStatus: "live",
  plasmaStatus: "live",
  magStatus: "live",
  kpStatus: "live",
  selectedEventId: "X-001",
  alignmentStatus: "source_resolved_only",
  alignmentScore: 6,
  alignmentPassed: false,
  carrierWindowStart: "2026-06-19T16:00:00Z",
  carrierWindowEnd: "2026-06-23T16:00:00Z"
};

const alignment: EventCarrierAlignment = {
  status: "source_resolved_only",
  selectedEventId: "X-001",
  eventType: "CME",
  carrierWindow: {
    start: "2026-06-19T16:00:00Z",
    end: "2026-06-23T16:00:00Z",
    reason:
      "CME carrier effects are evaluated in a broad post-event transit window."
  },
  features: [],
  blockingReasons: ["No plasma or magnetometer carrier disturbance feature is present."],
  supportingReasons: ["Required source witnesses are live."],
  alignmentScore: 6,
  alignmentPassed: false
};

const packet: TctPacketStatus = {
  C: "test C",
  thetaC: ["solar image witness"],
  selectedEventId: "X-001",
  invariant: ["event timestamp continuity"],
  preservationBoundary: ["do not claim closure from fixture data"],
  measurementClosure: "frontier_preserved",
  representationSurfaceStatus: "resolved",
  alignment,
  statusReasons: [
    "alignment.status: source_resolved_only."
  ],
  witnessRoles: [
    {
      label: "L1 plasma carrier trace",
      source: "NOAA_SWPC_SOLAR_WIND_PLASMA",
      sourceFetch: "live",
      evidence: "live_parsed",
      role: "target_forced_carrier",
      closure: "frontier_preserved",
      status: "frontier_preserved"
    }
  ]
};

describe("PacketStatusPanel", () => {
  it("renders source fetch, evidence, role, and closure as separate columns", () => {
    render(<PacketStatusPanel packet={packet} diagnostics={diagnostics} />);

    expect(screen.getByRole("columnheader", { name: "Source fetch" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TCT role" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TCT closure" })).toBeInTheDocument();
    expect(screen.getAllByText("live_parsed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("frontier_preserved").length).toBeGreaterThan(0);
  });

  it("explains why frontier_preserved is not a failure", () => {
    render(<PacketStatusPanel packet={packet} diagnostics={diagnostics} />);

    expect(
      screen.getByText("Why do witnesses say frontier_preserved?")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Resolved requires live witnesses plus carrier-signature/i)
    ).toBeInTheDocument();
  });
});
