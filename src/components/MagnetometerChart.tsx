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
import type { MagPoint, SourceStatus } from "../data/types";
import { shortUtc } from "../utils/dateRange";
import { compactNumber, decimateForDisplay } from "../utils/number";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface MagnetometerChartProps {
  points: MagPoint[];
  status: SourceStatus;
}

export function MagnetometerChart({ points, status }: MagnetometerChartProps) {
  const displayPoints = decimateForDisplay(points).map((point) => ({
    ...point,
    timeLabel: shortUtc(point.timeTag)
  }));

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>L1 Magnetometer Carrier</h2>
          <p>Bz and Bt in nT</p>
        </div>
        <WitnessSourceBadge status={status} label="NOAA_SWPC_SOLAR_WIND_MAG" />
      </div>

      {displayPoints.length === 0 ? (
        <EmptyState
          title="unavailable witness"
          detail="L1 magnetometer carrier has no live or fixture points."
        />
      ) : (
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayPoints} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#273449" strokeDasharray="3 3" />
              <XAxis dataKey="timeLabel" minTickGap={34} stroke="#9fb3c8" />
              <YAxis stroke="#9fb3c8" tickFormatter={(value) => compactNumber(Number(value), 1)} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #31445f" }}
                labelStyle={{ color: "#d7e3f3" }}
                formatter={(value, name) => [`${compactNumber(Number(value), 2)} nT`, name]}
              />
              <Legend />
              <Line type="monotone" dataKey="bzGsm" name="Bz GSM" stroke="#38bdf8" dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="bt" name="Bt" stroke="#fb7185" dot={false} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
