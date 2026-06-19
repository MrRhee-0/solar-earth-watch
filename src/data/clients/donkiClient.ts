import fixture from "../fixtures/donkiEvents.fixture.json";
import { normalizeDonkiEvents } from "../normalize/normalizeDonki";
import type { EventType, EventWitness, SourceResult } from "../types";
import { fetchJson } from "../../utils/fetchJson";
import { lastUtcDays } from "../../utils/dateRange";

const DONKI_BASE_URL = "/proxy/donki";
const REQUIRED_EVENT_TYPES: EventType[] = ["FLR", "CME", "GST", "HSS", "IPS"];
const OPTIONAL_EVENT_TYPES: EventType[] = ["SEP"];

type FixtureMap = Partial<Record<EventType, unknown[]>>;

function endpoint(eventType: EventType, startDate: string, endDate: string): string {
  const params = new URLSearchParams({ startDate, endDate });
  return `${DONKI_BASE_URL}/${eventType}?${params.toString()}`;
}

function normalizeFixture(): EventWitness[] {
  const fixtureMap = fixture as unknown as FixtureMap;
  return [...REQUIRED_EVENT_TYPES, ...OPTIONAL_EVENT_TYPES].flatMap((eventType) =>
    normalizeDonkiEvents(eventType, fixtureMap[eventType] ?? [])
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "source fetch failure: unknown DONKI fetch error";
}

export async function fetchDonkiEvents(
  days = 14
): Promise<SourceResult<EventWitness[]>> {
  const { startDate, endDate } = lastUtcDays(days);
  const requiredResponses = await Promise.allSettled(
    REQUIRED_EVENT_TYPES.map(async (eventType) => ({
      eventType,
      data: await fetchJson<unknown[]>(endpoint(eventType, startDate, endDate), {
        timeoutMs: 12000
      })
    }))
  );

  const failedRequired = requiredResponses.filter(
    (response) => response.status === "rejected"
  );

  if (failedRequired.length > 0) {
    const firstFailure = failedRequired[0];
    const reason =
      firstFailure.status === "rejected"
        ? errorMessage(firstFailure.reason)
        : "source fetch failure: unresolved DONKI endpoint failure";

    return {
      status: "fixture",
      data: normalizeFixture(),
      error: reason
    };
  }

  const requiredEvents = requiredResponses.flatMap((response) => {
    if (response.status !== "fulfilled") {
      return [];
    }

    return normalizeDonkiEvents(response.value.eventType, response.value.data);
  });

  const optionalResponses = await Promise.allSettled(
    OPTIONAL_EVENT_TYPES.map(async (eventType) => ({
      eventType,
      data: await fetchJson<unknown[]>(endpoint(eventType, startDate, endDate), {
        timeoutMs: 12000
      })
    }))
  );

  const optionalEvents = optionalResponses.flatMap((response) => {
    if (response.status !== "fulfilled") {
      return [];
    }

    return normalizeDonkiEvents(response.value.eventType, response.value.data);
  });

  return {
    status: "live",
    data: [...requiredEvents, ...optionalEvents].sort(
      (a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)
    )
  };
}
