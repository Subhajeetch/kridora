import { httpStatusFor } from "../lib/errors";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { auth, type AuthSession } from "../lib/auth";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `app.requireAuth`. Null on routes that do not use it. */
    session: AuthSession | null;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Use inside a handler guarded by `preHandler: app.requireAuth`. */
export function requireSession(request: FastifyRequest): AuthSession {
  if (!request.session) throw new Error("requireSession called on a route without requireAuth");
  return request.session;
}

export default fp(async (app) => {
  app.decorateRequest("session", null);

  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) {
      return reply
        .code(httpStatusFor("UNAUTHENTICATED"))
        .send({ error: { code: "UNAUTHENTICATED", message: "Please sign in first" } });
    }
    request.session = session;
  });
});
