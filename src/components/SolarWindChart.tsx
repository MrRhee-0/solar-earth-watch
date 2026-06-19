import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { PlasmaPoint, SourceStatus } from "../data/types";
import { shortUtc } from "../utils/dateRange";
import { compactNumber, decimateForDisplay } from "../utils/number";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface SolarWindChartProps {
  points: PlasmaPoint[];
  status: SourceStatus;
}

export function SolarWindChart({ points, status }: SolarWindChartProps) {
  const displayPoints = decimateForDisplay(points).map((point) => ({
    ...point,
    timeLabel: shortUtc(point.timeTag)
  }));

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
              <XAxis dataKey="timeLabel" minTickGap={34} stroke="#9fb3c8" />
              <YAxis stroke="#9fb3c8" tickFormatter={(value) => compactNumber(Number(value), 0)} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #31445f" }}
                labelStyle={{ color: "#d7e3f3" }}
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
              <Line type="monotone" dataKey="speed" stroke="#6ee7f9" dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="density" stroke="#facc15" dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="temperature" stroke="#f472b6" dot={false} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
