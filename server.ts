import { createServer } from "node:http";
import { attachRealtimeServer } from "./app/lib/realtime/ws-server";

const dev = process.argv.includes("--dev");

// Set before Next is loaded, which is why the import below is dynamic. An
// inline `NODE_ENV=... ` prefix in package.json would not work on Windows.
// Next types NODE_ENV as read-only for app code; a custom server is the one
// place that legitimately owns it.
(process.env as Record<string, string>).NODE_ENV = dev
  ? "development"
  : "production";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "localhost";

async function main(): Promise<void> {
  const { default: next } = await import("next");
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      console.error("Request failed:", error);
      response.statusCode = 500;
      response.end("Internal Server Error");
    });
  });

  attachRealtimeServer(server);

  server.listen(port, () => {
    console.log(
      `> Ready on http://${hostname}:${port} (${dev ? "development" : "production"})`,
    );
  });
}

main().catch((error: unknown) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
