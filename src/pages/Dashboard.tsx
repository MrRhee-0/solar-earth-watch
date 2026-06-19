import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDonkiEvents } from "../data/clients/donkiClient";
import { fetchSolarImage } from "../data/clients/helioviewerClient";
import { fetchKp, fetchMag, fetchPlasma } from "../data/clients/swpcClient";
import type {
  EvidenceStatus,
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  RenderStatus,
  SolarImageRenderWitness,
  SolarImageWitness,
  SourceStatus,
  WitnessEvidence,
  WitnessSource
} from "../data/types";
import { EventTimeline } from "../components/EventTimeline";
import { Header } from "../components/Header";
import { KpPanel } from "../components/KpPanel";
import { Layout } from "../components/Layout";
import { LoadingState } from "../components/LoadingState";
import { MagnetometerChart } from "../components/MagnetometerChart";
import { PacketStatusPanel } from "../components/PacketStatusPanel";
import { SolarImagePanel } from "../components/SolarImagePanel";
import { SolarWindChart } from "../components/SolarWindChart";
import { AlignmentPanel } from "../components/AlignmentPanel";
import { classifyPacketStatus } from "../tct/classifyPacketStatus";
import { evaluateEventCarrierAlignment } from "../tct/alignment";
import { parseUtcTime } from "../utils/dateRange";

type StatusMap = Partial<Record<WitnessSource, SourceStatus>>;
type ErrorMap = Partial<Record<WitnessSource, string | undefined>>;

interface DashboardData {
  events: EventWitness[];
  plasma: PlasmaPoint[];
  mag: MagPoint[];
  kp: KpPoint[];
  solarImage: SolarImageWitness | null;
  status: StatusMap;
  errors: ErrorMap;
  refreshedAt: string | null;
}

const EMPTY_DATA: DashboardData = {
  events: [],
  plasma: [],
  mag: [],
  kp: [],
  solarImage: null,
  status: {
    NASA_DONKI: "unavailable",
    NOAA_SWPC_SOLAR_WIND_PLASMA: "unavailable",
    NOAA_SWPC_SOLAR_WIND_MAG: "unavailable",
    NOAA_SWPC_KP: "unavailable",
    HELIOVIEWER: "unavailable"
  },
  errors: {},
  refreshedAt: null
};

const EMPTY_RENDER_WITNESS: SolarImageRenderWitness = {
  status: "not_attempted",
  naturalWidth: null,
  naturalHeight: null,
  clientWidth: null,
  clientHeight: null,
  observedAt: null,
  error: null
};

function renderWitnessFromStatus(
  status: RenderStatus,
  error: string | null = null
): SolarImageRenderWitness {
  return {
    ...EMPTY_RENDER_WITNESS,
    status,
    error
  };
}

function deriveImageUrlDiagnostics(imageUrl: string | null) {
  if (!imageUrl) {
    return {
      remoteHelioviewerEndpointPath: null,
      imageUrlBeginsWithApiHelioviewer: false,
      displayTruePresent: false,
      layersContainSdoAia171: false
    };
  }

  const parsedUrl = new URL(imageUrl, "https://solar-earth-watch.local");
  const endpointPath = `${parsedUrl.pathname}${parsedUrl.search}`;
  const beginsWithApiHelioviewer = parsedUrl.pathname.startsWith(
    "/api/helioviewer"
  );
  const remoteHelioviewerEndpointPath = beginsWithApiHelioviewer
    ? endpointPath.replace(/^\/api\/helioviewer/, "")
    : null;
  const layers = parsedUrl.searchParams.get("layers") ?? "";

  return {
    remoteHelioviewerEndpointPath,
    imageUrlBeginsWithApiHelioviewer: beginsWithApiHelioviewer,
    displayTruePresent: parsedUrl.searchParams.get("display") === "true",
    layersContainSdoAia171: layers.includes("SDO,AIA,AIA,171")
  };
}

function solarEvidenceFromState(
  solarImage: SolarImageWitness | null,
  renderWitness: SolarImageRenderWitness
): WitnessEvidence {
  if (!solarImage) {
    return {
      sourceKey: "HELIOVIEWER",
      evidenceStatus: "unavailable",
      isLive: false,
      isFallback: false,
      isRenderable: false,
      recordCount: 0,
      latestTimestamp: null,
      reason: "Solar image witness is unavailable."
    };
  }

  const rendered =
    renderWitness.status === "rendered" &&
    (renderWitness.naturalWidth ?? 0) > 0 &&
    (renderWitness.naturalHeight ?? 0) > 0;
  const evidenceStatus: EvidenceStatus =
    rendered && solarImage.isLiveImage
      ? "live_rendered"
      : renderWitness.status === "render_error"
        ? "error"
        : solarImage.evidenceStatus;

  return {
    sourceKey: "HELIOVIEWER",
    evidenceStatus,
    isLive: evidenceStatus === "live_rendered" || evidenceStatus === "live_parsed",
    isFallback: solarImage.isFallbackImage,
    isRenderable: rendered,
    recordCount: solarImage.imageUrl ? 1 : 0,
    latestTimestamp: solarImage.timestamp,
    observedAt: renderWitness.observedAt,
    reason:
      renderWitness.error ??
      solarImage.fallbackReason ??
      solarImage.error ??
      null
  };
}

function evidenceFromRecords(
  sourceKey: WitnessSource,
  status: SourceStatus | undefined,
  recordCount: number,
  latestTimestamp: string | null,
  hasFixtureRecords: boolean,
  error?: string
): WitnessEvidence {
  const evidenceStatus: EvidenceStatus =
    hasFixtureRecords || status === "fixture"
      ? "fixture_fallback"
      : status === "error"
        ? "error"
        : status === "live" && recordCount > 0
          ? "live_parsed"
          : status === "live"
            ? "empty_live"
            : "unavailable";

  return {
    sourceKey,
    evidenceStatus,
    isLive: evidenceStatus === "live_parsed" || evidenceStatus === "empty_live",
    isFallback: evidenceStatus === "fixture_fallback",
    isRenderable: false,
    recordCount,
    latestTimestamp,
    reason: error ?? null
  };
}

function sortEvents(events: EventWitness[]): EventWitness[] {
  return events
    .slice()
    .sort((a, b) => {
      const bTime = parseUtcTime(b.startTime);
      const aTime = parseUtcTime(a.startTime);
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventIsExplicit, setSelectedEventIsExplicit] = useState(false);
  const [solarImageRenderWitness, setSolarImageRenderWitness] =
    useState<SolarImageRenderWitness>(EMPTY_RENDER_WITNESS);
  const [loading, setLoading] = useState(false);

  const loadWitnesses = useCallback(async () => {
    setLoading(true);

    try {
      const [donki, plasma, mag, kp, solarImage] = await Promise.all([
        fetchDonkiEvents(),
        fetchPlasma(),
        fetchMag(),
        fetchKp(),
        fetchSolarImage()
      ]);

      setData({
        events: sortEvents(donki.data),
        plasma: plasma.data,
        mag: mag.data,
        kp: kp.data,
        solarImage: solarImage.data,
        status: {
          NASA_DONKI: donki.status,
          NOAA_SWPC_SOLAR_WIND_PLASMA: plasma.status,
          NOAA_SWPC_SOLAR_WIND_MAG: mag.status,
          NOAA_SWPC_KP: kp.status,
          HELIOVIEWER: solarImage.status
        },
        errors: {
          NASA_DONKI: donki.error,
          NOAA_SWPC_SOLAR_WIND_PLASMA: plasma.error,
          NOAA_SWPC_SOLAR_WIND_MAG: mag.error,
          NOAA_SWPC_KP: kp.error,
          HELIOVIEWER: solarImage.error
        },
        refreshedAt: new Date().toISOString()
      });
      setSolarImageRenderWitness(
        solarImage.data?.imageUrl
          ? renderWitnessFromStatus(
              solarImage.data.renderStatus ?? "not_attempted",
              solarImage.data.error ?? null
            )
          : renderWitnessFromStatus(
              "missing_url",
              "Solar image witness has no renderable image URL."
            )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWitnesses();
  }, [loadWitnesses]);

  useEffect(() => {
    if (data.events.length === 0) {
      setSelectedEventId(null);
      setSelectedEventIsExplicit(false);
      return;
    }

    if (!selectedEventId || !data.events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(data.events[0].id);
      setSelectedEventIsExplicit(false);
    }
  }, [data.events, selectedEventId]);

  const selectedEvent = useMemo(
    () => data.events.find((event) => event.id === selectedEventId) ?? null,
    [data.events, selectedEventId]
  );

  const witnessEvidence = useMemo(
    () => [
      solarEvidenceFromState(data.solarImage, solarImageRenderWitness),
      evidenceFromRecords(
        "NASA_DONKI",
        data.status.NASA_DONKI,
        data.events.length,
        data.events[0]?.startTime ?? null,
        data.status.NASA_DONKI === "fixture",
        data.errors.NASA_DONKI
      ),
      evidenceFromRecords(
        "NOAA_SWPC_SOLAR_WIND_PLASMA",
        data.status.NOAA_SWPC_SOLAR_WIND_PLASMA,
        data.plasma.length,
        data.plasma[data.plasma.length - 1]?.timeTag ?? null,
        data.plasma.some((point) => point.source === "FIXTURE"),
        data.errors.NOAA_SWPC_SOLAR_WIND_PLASMA
      ),
      evidenceFromRecords(
        "NOAA_SWPC_SOLAR_WIND_MAG",
        data.status.NOAA_SWPC_SOLAR_WIND_MAG,
        data.mag.length,
        data.mag[data.mag.length - 1]?.timeTag ?? null,
        data.mag.some((point) => point.source === "FIXTURE"),
        data.errors.NOAA_SWPC_SOLAR_WIND_MAG
      ),
      evidenceFromRecords(
        "NOAA_SWPC_KP",
        data.status.NOAA_SWPC_KP,
        data.kp.length,
        data.kp[data.kp.length - 1]?.timeTag ?? null,
        data.kp.some((point) => point.source === "FIXTURE"),
        data.errors.NOAA_SWPC_KP
      )
    ],
    [data, solarImageRenderWitness]
  );

  const alignment = useMemo(
    () =>
      evaluateEventCarrierAlignment({
        selectedEvent,
        plasma: data.plasma,
        mag: data.mag,
        kp: data.kp,
        solarImageEvidence: witnessEvidence.find(
          (entry) => entry.sourceKey === "HELIOVIEWER"
        ),
        donkiEvidence: witnessEvidence.find(
          (entry) => entry.sourceKey === "NASA_DONKI"
        ),
        plasmaEvidence: witnessEvidence.find(
          (entry) => entry.sourceKey === "NOAA_SWPC_SOLAR_WIND_PLASMA"
        ),
        magEvidence: witnessEvidence.find(
          (entry) => entry.sourceKey === "NOAA_SWPC_SOLAR_WIND_MAG"
        ),
        kpEvidence: witnessEvidence.find(
          (entry) => entry.sourceKey === "NOAA_SWPC_KP"
        ),
        eventCandidates: data.events,
        selectedEventIsExplicit
      }),
    [
      data.events,
      data.kp,
      data.mag,
      data.plasma,
      selectedEvent,
      selectedEventIsExplicit,
      witnessEvidence
    ]
  );

  const carrierWindow = alignment.carrierWindow;

  const packet = useMemo(
    () =>
      classifyPacketStatus({
        selectedEvent,
        solarImage: data.solarImage,
        plasma: data.plasma,
        mag: data.mag,
        kp: data.kp,
        sourceStatus: data.status,
        sourceErrors: data.errors,
        eventCandidates: data.events,
        selectedEventIsExplicit,
        solarImageRenderWitness,
        witnessEvidence,
        alignment,
        representationSurfaceResolved: true
      }),
    [
      alignment,
      data,
      selectedEvent,
      selectedEventIsExplicit,
      solarImageRenderWitness,
      witnessEvidence
    ]
  );

  const diagnostics = useMemo(
    () => {
      const imageUrl = data.solarImage?.imageUrl ?? null;
      const imageUrlDiagnostics = deriveImageUrlDiagnostics(imageUrl);

      return {
        helioviewerMetadataStatus:
          data.solarImage?.metadataStatus ??
          data.status.HELIOVIEWER ??
          "unavailable",
        helioviewerImageFetchStatus:
          data.solarImage?.imageFetchStatus ??
          data.status.HELIOVIEWER ??
          "unavailable",
        helioviewerRenderStatus: solarImageRenderWitness.status,
        helioviewerEvidenceStatus:
          witnessEvidence.find((entry) => entry.sourceKey === "HELIOVIEWER")
            ?.evidenceStatus ?? "unavailable",
        imageUrl,
        proxiedImageUrl: imageUrl,
        selectedUrl: data.solarImage?.selectedUrl ?? null,
        attemptedUrlCount: data.solarImage?.attemptedUrls?.length ?? 0,
        fallbackReason: data.solarImage?.fallbackReason ?? null,
        isLiveImage: Boolean(data.solarImage?.isLiveImage),
        isFallbackImage: Boolean(data.solarImage?.isFallbackImage),
        naturalWidth: solarImageRenderWitness.naturalWidth,
        naturalHeight: solarImageRenderWitness.naturalHeight,
        clientWidth: solarImageRenderWitness.clientWidth,
        clientHeight: solarImageRenderWitness.clientHeight,
        renderObservedAt: solarImageRenderWitness.observedAt,
        renderError: solarImageRenderWitness.error ?? null,
        ...imageUrlDiagnostics,
        donkiStatus: data.status.NASA_DONKI ?? "unavailable",
        plasmaStatus: data.status.NOAA_SWPC_SOLAR_WIND_PLASMA ?? "unavailable",
        magStatus: data.status.NOAA_SWPC_SOLAR_WIND_MAG ?? "unavailable",
        kpStatus: data.status.NOAA_SWPC_KP ?? "unavailable",
        selectedEventId,
        alignmentStatus: alignment.status,
        alignmentScore: alignment.alignmentScore,
        alignmentPassed: alignment.alignmentPassed,
        carrierWindowStart: carrierWindow?.start ?? null,
        carrierWindowEnd: carrierWindow?.end ?? null
      };
    },
    [
      alignment,
      carrierWindow,
      data.solarImage,
      data.status,
      selectedEventId,
      solarImageRenderWitness,
      witnessEvidence
    ]
  );

  const selectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedEventIsExplicit(true);
  };

  return (
    <Layout>
      <Header
        lastRefresh={data.refreshedAt}
        loading={loading}
        onRefresh={loadWitnesses}
      />

      {loading && data.refreshedAt === null ? (
        <LoadingState />
      ) : (
        <>
          <div className="dashboard-grid dashboard-grid--top">
            <SolarImagePanel
              witness={data.solarImage}
              onRenderStatusChange={setSolarImageRenderWitness}
            />
            <EventTimeline
              events={data.events}
              selectedEventId={selectedEventId}
              status={data.status.NASA_DONKI ?? "unavailable"}
              onSelect={selectEvent}
            />
            <PacketStatusPanel packet={packet} diagnostics={diagnostics} />
          </div>

          <div className="dashboard-grid dashboard-grid--alignment">
            <AlignmentPanel alignment={alignment} />
          </div>

          <div className="dashboard-grid dashboard-grid--bottom">
            <SolarWindChart
              points={data.plasma}
              status={data.status.NOAA_SWPC_SOLAR_WIND_PLASMA ?? "unavailable"}
              carrierWindow={carrierWindow}
            />
            <MagnetometerChart
              points={data.mag}
              status={data.status.NOAA_SWPC_SOLAR_WIND_MAG ?? "unavailable"}
              carrierWindow={carrierWindow}
            />
            <KpPanel
              points={data.kp}
              status={data.status.NOAA_SWPC_KP ?? "unavailable"}
              carrierWindow={carrierWindow}
            />
          </div>
        </>
      )}
    </Layout>
  );
}
