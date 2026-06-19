import type { EventWitness, SourceStatus } from "../data/types";
import { formatUtcTimestamp, shortUtc } from "../utils/dateRange";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface EventTimelineProps {
  events: EventWitness[];
  selectedEventId: string | null;
  status: SourceStatus;
  onSelect: (eventId: string) => void;
}

function joinOrFallback(items: string[], fallback = "unavailable witness") {
  return items.length > 0 ? items.join(", ") : fallback;
}

export function EventTimeline({
  events,
  selectedEventId,
  status,
  onSelect
}: EventTimelineProps) {
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  return (
    <section className="panel event-panel">
      <div className="panel-heading">
        <div>
          <h2>DONKI Event Timeline</h2>
          <p>Last 14 days, UTC</p>
        </div>
        <WitnessSourceBadge status={status} label="NASA_DONKI" />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="unavailable witness"
          detail="DONKI event record returned no event witnesses."
        />
      ) : (
        <div className="event-grid">
          <div className="event-list" aria-label="DONKI event witnesses">
            {events.map((event) => (
              <button
                key={event.id}
                className={`event-item event-item--${event.eventType.toLowerCase()} ${
                  event.id === selectedEventId ? "event-item--selected" : ""
                }`}
                onClick={() => onSelect(event.id)}
              >
                <span className="event-type">{event.eventType}</span>
                <span>{shortUtc(event.startTime)}</span>
                <small>{event.sourceLocation ?? event.activeRegionNum ?? event.id}</small>
              </button>
            ))}
          </div>

          <div className="event-details">
            {selectedEvent ? (
              <>
                <div className="detail-row">
                  <span>X</span>
                  <strong>{selectedEvent.id}</strong>
                </div>
                <div className="detail-row">
                  <span>event type</span>
                  <strong>{selectedEvent.eventType}</strong>
                </div>
                <div className="detail-row">
                  <span>start</span>
                  <strong>{formatUtcTimestamp(selectedEvent.startTime)}</strong>
                </div>
                <div className="detail-row">
                  <span>end</span>
                  <strong>{formatUtcTimestamp(selectedEvent.endTime)}</strong>
                </div>
                <div className="detail-row">
                  <span>linked events</span>
                  <strong>{joinOrFallback(selectedEvent.linkedEvents)}</strong>
                </div>
                <div className="detail-row">
                  <span>instruments</span>
                  <strong>{joinOrFallback(selectedEvent.instruments)}</strong>
                </div>
                <div className="detail-row">
                  <span>source location</span>
                  <strong>{selectedEvent.sourceLocation ?? "unavailable witness"}</strong>
                </div>
                <div className="detail-row">
                  <span>active region</span>
                  <strong>{selectedEvent.activeRegionNum ?? "unavailable witness"}</strong>
                </div>
              </>
            ) : (
              <EmptyState
                title="underdeclared target relation"
                detail="No selected solar event packet X."
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
