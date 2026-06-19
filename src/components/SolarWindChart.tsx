import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { PlasmaPoint, SourceStatus } from "../data/types";
import type { CarrierWindow } from "../tct/alignment";
import { parseUtcTime, shortUtc } from "../utils/dateRange";
import { compactNumber, decimateForDisplay } from "../utils/number";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface SolarWindChartProps {
  points: PlasmaPoint[];
  status: SourceStatus;
  carrierWindow?: CarrierWindow | null;
}

function windowBounds(carrierWindow?: CarrierWindow | null) {
  if (!carrierWindow) {
    return null;
  }

  const startMs = parseUtcTime(carrierWindow.start);
  const endMs = parseUtcTime(carrierWindow.end);

  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? { startMs, endMs }
    : null;
}

export function SolarWindChart({ points, status, carrierWindow }: SolarWindChartProps) {
  const displayPoints = decimateForDisplay(points).map((point) => ({
    ...point,
    timeMs: parseUtcTime(point.timeTag)
  }));
  const bounds = windowBounds(carrierWindow);

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>L1 Plasma Carrier</h2>
          <p>Speed km/s, density p/cm3, temperature K</p>
        </div>
        <WitnessSourceBadge status={status} label="NOAA_SWPC_SOLAR_WIND_PLASMA" />
      </div>

      {displayPoints.length === 0 ? (
        <EmptyState
          title="unavailable witness"
          detail="L1 plasma carrier has no live or fixture points."
        />
      ) : (
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayPoints} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#273449" strokeDasharray="3 3" />
              <XAxis
                dataKey="timeMs"
                domain={["dataMin", "dataMax"]}
                minTickGap={34}
                scale="time"
                stroke="#9fb3c8"
                tickFormatter={(value) => shortUtc(new Date(Number(value)).toISOString())}
                type="number"
              />
              <YAxis stroke="#9fb3c8" tickFormatter={(value) => compactNumber(Number(value), 0)} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #31445f" }}
                labelStyle={{ color: "#d7e3f3" }}
                labelFormatter={(value) => shortUtc(new Date(Number(value)).toISOString())}
                formatter={(value, name) => {
                  const unit =
                    name === "speed"
                      ? " km/s"
                      : name === "density"
                        ? " p/cm3"
                        : " K";
                  return [`${compactNumber(Number(value), 1)}${unit}`, name];
                }}
              />
              <Legend />
              {bounds ? (
                <ReferenceArea
                  x1={bounds.startMs}
                  x2={bounds.endMs}
                  fill="#60a5fa"
                  fillOpacity={0.12}
                  label={{
                    value: "selected carrier window",
                    position: "insideTop"
                  }}
                />
              ) : null}
              <Line type="monotone" dataKey="speed" stroke="#6ee7f9" dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="density" stroke="#facc15" dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="temperature" stroke="#f472b6" dot={false} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {bounds ? <p className="chart-window-note">selected carrier window marked</p> : null}
    </section>
  );
}
