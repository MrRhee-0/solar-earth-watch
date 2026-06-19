import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDonkiEvents } from "../data/clients/donkiClient";
import { fetchSolarImage } from "../data/clients/helioviewerClient";
import { fetchKp, fetchMag, fetchPlasma } from "../data/clients/swpcClient";
import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
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
        selectedEventIsExplicit
      }),
    [data, selectedEvent, selectedEventIsExplicit]
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
              image={data.solarImage}
              status={data.status.HELIOVIEWER ?? "unavailable"}
            />
            <EventTimeline
              events={data.events}
              selectedEventId={selectedEventId}
              status={data.status.NASA_DONKI ?? "unavailable"}
              onSelect={selectEvent}
            />
            <PacketStatusPanel packet={packet} />
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
