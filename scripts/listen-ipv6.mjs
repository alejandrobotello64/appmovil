import http from "node:http";

const PORT = Number(process.env.PORT || 43145);
const TARGET = "127.0.0.1";

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `${TARGET}:${PORT}` };
  const proxy = http.request(
    {
      hostname: TARGET,
      port: PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    }
  );
  proxy.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(error.message);
  });
  req.pipe(proxy);
});

server.listen(PORT, "::1", () => {
  console.log(`IPv6 localhost http://[::1]:${PORT} -> ${TARGET}:${PORT}`);
});
