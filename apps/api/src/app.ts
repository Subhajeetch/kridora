import Fastify from "fastify";
import autoload from "@fastify/autoload";
import path from "node:path";

//building the app
export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(autoload, {
    dir: path.join(import.meta.dirname, "routes"),
  });

  return app;
}
