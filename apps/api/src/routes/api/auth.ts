import { eq, mergeGuestProfileIntoUser, schema } from "@kridora/db";
import type { FastifyPluginAsync } from "fastify";
import { auth, CLIENT_IP_HEADER } from "../../lib/auth";
import { db } from "../../lib/db";

/**
 * Hands every /api/auth/* request to Better Auth (sign-up, sign-in, Google OAuth, sessions, ...).
 * Fastify's request is converted to a standard Web Request and the Response is streamed back.
 */
const authRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.headers.host ?? "localhost"}`,
      );

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value === undefined) continue;
        if (key.toLowerCase() === CLIENT_IP_HEADER) continue; // never trust a client-supplied copy
        headers.append(key, Array.isArray(value) ? value.join(", ") : value);
      }
      headers.set(CLIENT_IP_HEADER, request.ip);

      // Check if this request is creating an account while having an anonymous guest session
      let guestUserId: string | null = null;
      if (
        url.pathname.endsWith("/sign-up/email") &&
        request.method === "POST"
      ) {
        try {
          const session = await auth.api.getSession({ headers });
          if (session?.user?.isAnonymous) {
            guestUserId = session.user.id;
          }
        } catch {
          // Session lookup failure should not block request
        }
      }

      const hasBody =
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.body !== undefined;
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
        }),
      );

      // If email sign-up succeeded for a guest, merge stats and User ID into the new user
      if (
        guestUserId &&
        response.status === 200 &&
        url.pathname.endsWith("/sign-up/email") &&
        request.body &&
        typeof request.body === "object" &&
        "email" in request.body &&
        typeof request.body.email === "string"
      ) {
        try {
          const targetEmail = request.body.email.toLowerCase();
          const [createdUser] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.email, targetEmail))
            .limit(1);

          if (createdUser) {
            await mergeGuestProfileIntoUser(db, guestUserId, createdUser.id);
          }
        } catch (err) {
          request.log.error(
            { err, guestUserId },
            "Failed to merge guest profile during email sign-up",
          );
        }
      }

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
