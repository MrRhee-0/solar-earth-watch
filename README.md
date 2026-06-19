# Solar Earth Watch

Solar Earth Watch is a TypeScript/Vite/React dashboard that aligns recent solar image witnesses, NASA/CCMC DONKI event records, NOAA SWPC L1 solar-wind plasma, NOAA SWPC L1 magnetometer data, and the NOAA planetary K-index into one downstream space-weather representation surface.

## TCT-Native Structural Framing

This app does not modify or claim authority over the canonical field. It is a downstream representation surface of a declared target packet. The data sources are witness surfaces used to expose a preserved relation packet, not classical labels that decide structure by themselves. Packet closure is not claimed unless the required witnesses are present and the local measurement closure rules pass.

Declared target relation `C`:

> Expose one solar-to-Earth event as preserved distinguishability across solar image, event record, L1 carrier trace, magnetometer trace, and Earth-response marker.

`Θ_C` for v0.1 contains:

- solar image witness
- DONKI event record
- L1 plasma carrier trace
- L1 magnetometer carrier trace
- planetary K-index Earth-response marker

Missing or failed surfaces are classified as `unavailable_witness`, `underdeclared`, `unresolved_carrier_alignment`, `preservation_boundary_failure`, `source_fetch_failure`, `fixture_fallback_active`, or `frontier_preserved`. Fixture-backed data is always visible in the UI and never closes the packet.

## Live Data Sources

- NOAA SWPC solar wind plasma JSON: https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json
- NOAA SWPC solar wind magnetometer JSON: https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json
- NOAA SWPC planetary K-index JSON: https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
- NASA/CCMC DONKI event web services: https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/
- Helioviewer solar imagery API: https://api.helioviewer.org/

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run test
```

## Repository Structure

```text
src/
  App.tsx
  main.tsx
  styles/
  data/
    clients/
    fixtures/
    normalize/
    types.ts
  tct/
    alignment.ts
    classifyPacketStatus.ts
    classifyWitness.ts
    packetTypes.ts
  components/
  pages/
  utils/
```

## Data Disclaimer

Solar Earth Watch is not an operational forecasting product. Do not use it for safety-critical decisions. Official NOAA and NASA products remain the operational sources.

## Development Roadmap

- v0.1 live witness dashboard
- v0.2 event-carrier alignment improvements
- v0.3 solar image source selection
- v0.4 deployment
- v0.5 stronger preservation-boundary classifier

## License

MIT. See [LICENSE](LICENSE).
