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
        ephemeris: "SwissEphemeris-WASM-2.10.03",
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
