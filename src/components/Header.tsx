import { RefreshCw } from "lucide-react";
import { formatUtcTimestamp } from "../utils/dateRange";

interface HeaderProps {
  lastRefresh: string | null;
  loading: boolean;
  onRefresh: () => void;
}

export function Header({ lastRefresh, loading, onRefresh }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <h1>Solar Earth Watch</h1>
        <p>Live solar-event witnesses from Sun to Earth</p>
      </div>
      <div className="header-actions">
        <span>Last refresh: {formatUtcTimestamp(lastRefresh)}</span>
        <button className="icon-button" onClick={onRefresh} disabled={loading} title="Refresh live witnesses">
          <RefreshCw size={18} aria-hidden="true" />
          <span>{loading ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>
    </header>
  );
}
