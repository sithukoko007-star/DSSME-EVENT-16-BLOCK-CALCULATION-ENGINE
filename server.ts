/**
 * DSSME Full-Stack Express Server
 * Serves API calculation endpoints and mounts Vite in development
 */

import express, { Request, Response } from "express";
import path from "path";
import { generateCanonicalChart } from "./src/engine/canonical/canonicalChart.ts";
import { getSwissEphemeris } from "./src/engine/astronomy/ephemeris.ts";
import { DssmeCalculationInput } from "./src/types/dssme-canonical-types.ts";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// API Endpoint: Authoritative Canonical Chart Calculation
app.post("/api/canonical-chart", async (req: Request, res: Response) => {
  try {
    const input = req.body as DssmeCalculationInput;
    const chart = await generateCanonicalChart(input);

    return res.status(200).json({
      success: true,
      data: chart,
      meta: {
        engine: "DSSME",
        mode: "NATIVE",
        version: "1.0.0-phase1",
        ephemeris: chart.provenance?.ephemeris,
        isDegraded: chart.provenance?.isDegraded ?? false,
        provenance: chart.provenance,
        ayanamsa: "Lahiri",
        generatedAt: new Date().toISOString(),
      },
      errors: [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    let code = "CALCULATION_ERROR";

    if (message.startsWith("INVALID_INPUT")) code = "INVALID_INPUT";
    else if (message.startsWith("TIMEZONE_ERROR")) code = "TIMEZONE_ERROR";
    else if (message.startsWith("EPHEMERIS_ERROR")) code = "EPHEMERIS_ERROR";
    else if (message.startsWith("LAGNA_ERROR")) code = "LAGNA_ERROR";
    else if (message.startsWith("HOUSE_ERROR")) code = "HOUSE_ERROR";
    else if (message.startsWith("VALIDATION_ERROR")) code = "VALIDATION_ERROR";

    return res.status(400).json({
      success: false,
      data: null,
      meta: {},
      errors: [
        {
          code,
          message,
        },
      ],
    });
  }
});

// Phase 2: Native Panchanga Endpoint
app.post("/api/panchanga", async (req: Request, res: Response) => {
  try {
    const { fromCanonicalChart, computePanchanga, validatePanchanga, createSwissLongitudeProvider, createSunriseProvider } = await import("./src/engine/panchanga/index.ts");
    const input = req.body as DssmeCalculationInput;
    const chart = await generateCanonicalChart(input);
    const src = fromCanonicalChart(chart);
    const sunrise = createSunriseProvider();
    const includeBoundaries = req.query.boundaries === "true" || req.body.includeBoundaries === true;
    const varaMode = req.body.varaMode === "civil" ? "civil" : "sunrise";

    // Handle degraded ephemeris gracefully:
    // If boundaries are requested under degraded provenance, fail closed with HTTP 422
    // If boundaries are NOT requested, pure Panchanga algebra succeeds cleanly under degraded mode.
    let provider = undefined;
    if (includeBoundaries) {
      if (chart.provenance.isDegraded) {
        return res.status(422).json({
          success: false,
          data: null,
          meta: {
            engine: "DSSME",
            phase: "PHASE_2_PANCHANGA",
            isDegraded: true,
            provenance: chart.provenance,
          },
          errors: [
            {
              code: "DEGRADED_EPHEMERIS",
              message: `Transition boundary search requires an active Swiss Ephemeris WASM engine. Chart provenance is degraded ("${chart.provenance.ephemeris}"). Pure Panchanga limbs are available without boundary calculation.`,
            },
          ],
        });
      }
      provider = await createSwissLongitudeProvider();
    } else if (!chart.provenance.isDegraded) {
      try {
        provider = await createSwissLongitudeProvider();
      } catch {
        // Optional provider for non-boundary validation
      }
    }

    const panchanga = computePanchanga(src, { provider, sunrise }, { includeBoundaries, varaMode });
    const validationIssues = provider ? validatePanchanga(panchanga, src, provider) : [];
    const hasErrorIssues = validationIssues.some((i: any) => i.severity === "error");

    return res.status(hasErrorIssues ? 422 : 200).json({
      success: !hasErrorIssues,
      data: panchanga,
      meta: {
        engine: "DSSME",
        phase: "PHASE_2_PANCHANGA",
        validationIssues,
        generatedAt: new Date().toISOString(),
      },
      errors: hasErrorIssues ? validationIssues.filter((i: any) => i.severity === "error") : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    let code = "CALCULATION_ERROR";

    if (message.startsWith("INVALID_INPUT")) code = "INVALID_INPUT";
    else if (message.startsWith("TIMEZONE_ERROR")) code = "TIMEZONE_ERROR";
    else if (message.startsWith("EPHEMERIS_ERROR")) code = "EPHEMERIS_ERROR";
    else if (message.startsWith("VALIDATION_ERROR")) code = "VALIDATION_ERROR";

    return res.status(400).json({
      success: false,
      data: null,
      meta: {},
      errors: [
        {
          code,
          message,
        },
      ],
    });
  }
});

// Health check endpoint with live Swiss Ephemeris probe
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await getSwissEphemeris();
    return res.status(200).json({
      status: "ok",
      phase: "PHASE_1_FOUNDATION",
      ephemeris: "swisseph-wasm",
      ayanamsa: "Lahiri",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(200).json({
      status: "degraded",
      phase: "PHASE_1_FOUNDATION",
      ephemeris: "fallback",
      ephemerisError: errorMsg,
      ayanamsa: "Lahiri",
      timestamp: new Date().toISOString(),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In dev: mount Vite dev server middlewares
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production: serve static build
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DSSME Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start DSSME server:", err);
  process.exit(1);
});
