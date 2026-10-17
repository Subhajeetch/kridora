import type { FastifyPluginAsync } from "fastify";
import { env } from "../../env";

/** Public, non-secret settings the web app needs before anyone is signed in. */
const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async () => ({
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  }));
};

export default configRoutes;
