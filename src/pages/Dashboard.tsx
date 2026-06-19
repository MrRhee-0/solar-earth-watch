import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDonkiEvents } from "../data/clients/donkiClient";
import { fetchSolarImage } from "../data/clients/helioviewerClient";
import { fetchKp, fetchMag, fetchPlasma } from "../data/clients/swpcClient";
import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  RenderStatus,
  SolarImageRenderWitness,
  SolarImageWitness,
  SourceStatus,
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
import { classifyPacketStatus } from "../tct/classifyPacketStatus";
import { carrierWindowForEvent, hasCarrierAlignment } from "../tct/alignment";
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

  const carrierWindow = useMemo(
    () => carrierWindowForEvent(selectedEvent),
    [selectedEvent]
  );

  const alignmentPassed = useMemo(
    () => hasCarrierAlignment(selectedEvent, data.plasma, data.mag),
    [data.mag, data.plasma, selectedEvent]
  );

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
        representationSurfaceResolved: true
      }),
    [data, selectedEvent, selectedEventIsExplicit, solarImageRenderWitness]
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
        imageUrl,
        proxiedImageUrl: imageUrl,
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
        alignmentPassed,
        carrierWindowStart: carrierWindow?.start.toISOString() ?? null,
        carrierWindowEnd: carrierWindow?.end.toISOString() ?? null
      };
    },
    [
      alignmentPassed,
      carrierWindow,
      data.solarImage,
      data.status,
      selectedEventId,
      solarImageRenderWitness
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

          <div className="dashboard-grid dashboard-grid--bottom">
            <SolarWindChart
              points={data.plasma}
              status={data.status.NOAA_SWPC_SOLAR_WIND_PLASMA ?? "unavailable"}
            />
            <MagnetometerChart
              points={data.mag}
              status={data.status.NOAA_SWPC_SOLAR_WIND_MAG ?? "unavailable"}
            />
            <KpPanel points={data.kp} status={data.status.NOAA_SWPC_KP ?? "unavailable"} />
          </div>
        </>
      )}
    </Layout>
  );
}
