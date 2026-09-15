import http from "node:http";
import { request as requestHttp } from "node:http";

const GATEWAY_PORT = Number(process.env.SUPABASE_GATEWAY_PORT || 54321);
const POSTGREST_PORT = Number(process.env.POSTGREST_PORT || 54331);

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "*";
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      req.headers["access-control-request-headers"] ||
      "authorization,apikey,content-type,prefer,accept,x-client-info,accept-profile,content-profile,range",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD",
    "access-control-expose-headers":
      "content-range,content-location,content-profile,preference-applied,location",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  let path = req.url || "/";
  if (path.startsWith("/rest/v1")) {
    path = path.slice("/rest/v1".length) || "/";
  } else if (path.startsWith("/auth/v1")) {
    res.writeHead(200, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ name: "local-gateway", status: "ok" }));
    return;
  }

  const headers = { ...req.headers, host: `127.0.0.1:${POSTGREST_PORT}` };
  delete headers.connection;

  const proxy = requestHttp(
    {
      host: "127.0.0.1",
      port: POSTGREST_PORT,
      path,
      method: req.method,
      headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, { ...upstream.headers, ...cors });
      upstream.pipe(res);
    }
  );

  proxy.on("error", (error) => {
    res.writeHead(502, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ message: error.message }));
  });

  req.pipe(proxy);
});

server.listen(GATEWAY_PORT, "127.0.0.1", () => {
  console.log(
    `Supabase REST gateway http://127.0.0.1:${GATEWAY_PORT} -> PostgREST :${POSTGREST_PORT}`
  );
});
