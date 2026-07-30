import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const deploymentInfoProxyPlugin = () => ({
  name: "deployment-info-proxy",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/deployment-info")) {
        return next();
      }

      try {
        const requestUrl = new URL(req.url, "http://localhost");
        const target = requestUrl.searchParams.get("target");

        if (!target) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing target query param." }));
          return;
        }

        const parsedTarget = new URL(target);
        if (!["http:", "https:"].includes(parsedTarget.protocol)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid target protocol." }));
          return;
        }

        const upstreamResponse = await fetch(parsedTarget.toString(), {
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        });

        const bodyText = await upstreamResponse.text();
        res.statusCode = upstreamResponse.status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(bodyText);
      } catch (error) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "Proxy fetch failed.",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
        );
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), deploymentInfoProxyPlugin()],
});
