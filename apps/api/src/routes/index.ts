import { Hono } from "hono";
import type { AppContext } from "../types";
import { authRoutes } from "./api/auth";
import { healthRoutes } from "./api/health";
import { invitesRoutes } from "./api/invites";
import { meRoutes } from "./api/me";
import { wsRoutes } from "./ws";

export const routes = new Hono<AppContext>();

routes.route("/api", healthRoutes);
routes.route("/api", authRoutes);
routes.route("/api", meRoutes);
routes.route("/api", invitesRoutes);
routes.route("/", wsRoutes);
