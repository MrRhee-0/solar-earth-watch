export class FetchJsonError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "FetchJsonError";
  }
}

export interface FetchJsonOptions {
  timeoutMs?: number;
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new FetchJsonError(
        `source fetch failure: HTTP ${response.status}`,
        url,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof FetchJsonError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? `source fetch failure: ${error.message}`
        : "source fetch failure: unknown fetch error";
    throw new FetchJsonError(message, url);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
