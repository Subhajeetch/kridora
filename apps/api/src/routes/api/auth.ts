import type { FastifyPluginAsync } from "fastify";
import { auth, CLIENT_IP_HEADER } from "../../lib/auth";

/**
 * Hands every /api/auth/* request to Better Auth (sign-up, sign-in, Google OAuth, sessions, ...).
 * Fastify's request is converted to a standard Web Request and the Response is streamed back.
 */
const authRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.headers.host ?? "localhost"}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value === undefined) continue;
        if (key.toLowerCase() === CLIENT_IP_HEADER) continue; // never trust a client-supplied copy
        headers.append(key, Array.isArray(value) ? value.join(", ") : value);
      }
      headers.set(CLIENT_IP_HEADER, request.ip);

      const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.body !== undefined;
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
        }),
      );

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);

      return reply.send(response.body ? await response.text() : null);
    },
  });
};

export default authRoutes;
