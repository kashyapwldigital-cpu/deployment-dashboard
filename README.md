# Sandbox Deployment Dashboard

## Why CORS errors happen on deployed builds

When this app runs on GitHub Pages, it is a static frontend only.  
Browser requests to remote `deployment-info.json` files are blocked unless each remote domain sends:

`Access-Control-Allow-Origin: https://kashyapwldigital-cpu.github.io`

Local development works because Vite uses a local server proxy, but that proxy does not exist on GitHub Pages.

## Production-safe fix (recommended)

Use a server-side proxy endpoint and configure the app to call that proxy in production.

1. Copy `.env.example` to `.env`.
2. Set:

`VITE_DEPLOYMENT_PROXY_URL=https://your-proxy-domain.example/api/deployment-info?target={target}`

3. Build and deploy.

`{target}` is replaced by each source URL automatically.

## Quick Cloudflare Worker proxy example

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("target");

    if (!target) {
      return new Response(JSON.stringify({ error: "Missing target query param." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const parsedTarget = new URL(target);
    if (!["http:", "https:"].includes(parsedTarget.protocol)) {
      return new Response(JSON.stringify({ error: "Invalid target protocol." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = await fetch(parsedTarget.toString(), {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  },
};
```

Then set `VITE_DEPLOYMENT_PROXY_URL` to that Worker URL, for example:

`https://deployment-proxy.your-subdomain.workers.dev/?target={target}`

## One-call mode (reduce Worker requests)

You can make the dashboard perform a single request per refresh by using a batch endpoint.

Set:

`VITE_DEPLOYMENT_BATCH_PROXY_URL=https://your-proxy-domain.example/api/deployment-info-batch`

Expected request body:

```json
{
  "sources": [
    { "name": "dev.tixstock.com", "deploymentInfoUrl": "https://dev.tixstock.com/deployment-info.json" }
  ]
}
```

Expected response body:

```json
{
  "results": [
    {
      "deploymentInfoUrl": "https://dev.tixstock.com/deployment-info.json",
      "status": "online",
      "payload": {
        "branch": "feature/xyz",
        "buildTime": "2026-07-30T10:00:00.000Z"
      }
    }
  ]
}
```
