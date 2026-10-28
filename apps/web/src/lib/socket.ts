import type {
  Ack,
  ClientToServerEvents,
  ErrorCode,
  ServerToClientEvents,
} from "@kridora/shared";
import { API_URL } from "./api-url";

export type SocketConnectionStatus =
  "idle" | "connecting" | "connected" | "disconnected";

export type RequestErrorCode = ErrorCode | "TIMEOUT" | "OFFLINE";

export class RequestError extends Error {
  code: RequestErrorCode;
  details: Record<string, unknown> | undefined;

  constructor(
    code: RequestErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RequestError";
    this.code = code;
    this.details = details;
  }
}

type AckData<E extends keyof ClientToServerEvents> = Parameters<
  ClientToServerEvents[E]
>[1] extends (response: Ack<infer T>) => void
  ? T
  : never;

type InternalLifecycleEvents = {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (err: Error) => void;
};

type AllEvents = ServerToClientEvents & InternalLifecycleEvents;
type EventKey = keyof AllEvents & string;
type AnyFn = (...args: never[]) => void;

interface PendingAck {
  resolve: (ack: Ack<unknown>) => void;
  timer: ReturnType<typeof setTimeout>;
}

function buildWsBaseUrl(): string {
  if (API_URL) {
    const url = new URL(API_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    return url.toString();
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

async function fetchWsTicket(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/ws-ticket`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ticket?: string };
    return typeof data?.ticket === "string" ? data.ticket : null;
  } catch {
    return null;
  }
}

export class NativeRealtimeSocket {
  private ws: WebSocket | null = null;
  private status: SocketConnectionStatus = "idle";
  private statusListeners = new Set<() => void>();
  private listeners = new Map<string, Set<AnyFn>>();
  private pendingAcks = new Map<number, PendingAck>();
  private nextRequestId = 1;
  private shouldReconnect = false;
  private connecting = false;
  private connectionGen = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        if (this.shouldReconnect && !this.connected && !this.connecting) {
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.reconnectAttempts = 0;
          void this.openConnection();
        }
      });
    }
  }

  get connected(): boolean {
    return (
      this.status === "connected" &&
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN
    );
  }

  getStatus = (): SocketConnectionStatus => {
    return this.status;
  };

  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  private setStatus(next: SocketConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const fn of this.statusListeners) {
      fn();
    }
  }

  on<K extends EventKey>(event: K, listener: AllEvents[K]): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as unknown as AnyFn);
    return this;
  }

  off<K extends EventKey>(event: K, listener: AllEvents[K]): this {
    this.listeners.get(event)?.delete(listener as unknown as AnyFn);
    return this;
  }

  once<K extends EventKey>(event: K, listener: AllEvents[K]): this {
    const wrapper = ((...args: Parameters<AllEvents[K]>) => {
      this.off(event, wrapper as unknown as AllEvents[K]);
      (listener as (...a: Parameters<AllEvents[K]>) => void)(...args);
    }) as unknown as AllEvents[K];
    return this.on(event, wrapper);
  }

  private emitLocal(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try {
        (fn as (...a: unknown[]) => void)(...args);
      } catch (err) {
        console.error(`[ws] Error in "${event}" listener:`, err);
      }
    }
  }

  connect(): this {
    this.shouldReconnect = true;
    if (this.connected || this.connecting) return this;
    if (this.status === "idle") {
      this.setStatus("connecting");
    }
    void this.openConnection();
    return this;
  }

  disconnect(): this {
    this.shouldReconnect = false;
    this.connecting = false;
    this.connectionGen += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearTimers();
    this.flushPendingAcks("Disconnected");
    if (this.ws) {
      const current = this.ws;
      this.ws = null;
      try {
        current.close(1000, "Client disconnect");
      } catch {
        // Ignore close errors
      }
    }
    this.setStatus("idle");
    this.emitLocal("disconnect", "client disconnect");
    return this;
  }

  private markReady(): void {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    if (this.status !== "connected") {
      this.setStatus("connected");
      this.emitLocal("connect");
    }
  }

  private async openConnection(): Promise<void> {
    if (!this.shouldReconnect || this.connected || this.connecting) return;
    this.connecting = true;
    const gen = ++this.connectionGen;

    try {
      const ticket = await fetchWsTicket();
      if (gen !== this.connectionGen || !this.shouldReconnect) {
        this.connecting = false;
        return;
      }

      const baseUrl = buildWsBaseUrl();
      const wsUrl = ticket
        ? `${baseUrl}?ticket=${encodeURIComponent(ticket)}`
        : baseUrl;

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws || gen !== this.connectionGen) return;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Wait briefly for server's initial room:state + ready frame before marking connected
        this.readyFallbackTimer = setTimeout(() => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
            this.markReady();
          }
        }, 1500);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string" || event.data === "pong") return;
        try {
          const msg = JSON.parse(event.data) as
            | { type: "ready" }
            | { type: "event"; event: string; data: unknown }
            | { type: "ack"; id: number; response: Ack<unknown> };

          if (msg.type === "ready") {
            this.markReady();
          } else if (msg.type === "ack" && typeof msg.id === "number") {
            const pending = this.pendingAcks.get(msg.id);
            if (pending) {
              clearTimeout(pending.timer);
              this.pendingAcks.delete(msg.id);
              pending.resolve(msg.response);
            }
          } else if (msg.type === "event" && typeof msg.event === "string") {
            this.emitLocal(msg.event, msg.data);
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onerror = () => {
        if (this.ws !== ws || gen !== this.connectionGen) return;
        this.emitLocal(
          "connect_error",
          new Error("Could not connect to the game server."),
        );
      };

      ws.onclose = (ev) => {
        if (gen !== this.connectionGen) return;
        if (this.ws === ws) {
          this.ws = null;
        }
        this.connecting = false;
        this.clearTimers();
        this.flushPendingAcks("Connection closed");

        if (this.shouldReconnect) {
          this.setStatus("disconnected");
          this.emitLocal("disconnect", ev.reason || "transport close");
          this.scheduleReconnect();
        } else {
          this.setStatus("idle");
        }
      };
    } catch (err) {
      if (gen !== this.connectionGen) return;
      this.connecting = false;
      this.emitLocal(
        "connect_error",
        err instanceof Error ? err : new Error("Connection failed"),
      );
      if (this.shouldReconnect) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.shouldReconnect) return;
    const expDelay = Math.min(10_000, 600 * 1.8 ** this.reconnectAttempts);
    const jitter = Math.floor(Math.random() * 350);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openConnection();
    }, expDelay + jitter);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send("ping");
        } catch {
          // Close handler will clean up
        }
      }
    }, 25_000);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
  }

  private flushPendingAcks(reason: string): void {
    for (const [id, pending] of this.pendingAcks.entries()) {
      clearTimeout(pending.timer);
      pending.resolve({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: reason },
      });
      this.pendingAcks.delete(id);
    }
  }

  sendWithAck(
    event: string,
    payload: unknown,
    timeoutMs = 10_000,
  ): Promise<Ack<unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new RequestError("OFFLINE", "You are offline. Reconnecting..."));
        return;
      }

      const id = this.nextRequestId++;
      const timer = setTimeout(() => {
        this.pendingAcks.delete(id);
        reject(
          new RequestError(
            "TIMEOUT",
            "The server took too long to respond. Try again.",
          ),
        );
      }, timeoutMs);

      this.pendingAcks.set(id, { resolve, timer });

      try {
        this.ws.send(JSON.stringify({ id, event, payload }));
      } catch {
        clearTimeout(timer);
        this.pendingAcks.delete(id);
        reject(new RequestError("OFFLINE", "Failed to send request."));
      }
    });
  }
}

export type AppSocket = NativeRealtimeSocket;

export const socket: AppSocket = new NativeRealtimeSocket();
export const subscribeSocketStatus = socket.subscribeStatus;
export const getSocketStatus = socket.getStatus;

/** Waits for the WebSocket to establish a connection. */
export async function waitForSocketConnected(
  timeoutMs = 10_000,
): Promise<void> {
  if (socket.connected) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new RequestError(
          "TIMEOUT",
          "Connecting to the server timed out. Please try again.",
        ),
      );
    }, timeoutMs);

    function onConnect() {
      cleanup();
      resolve();
    }

    function onError(err: Error) {
      cleanup();
      reject(
        new RequestError(
          "OFFLINE",
          err.message || "Could not connect to the game server.",
        ),
      );
    }

    function cleanup() {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
}

/** Sends an event over the WebSocket and resolves with the server's data, or throws a RequestError. */
export async function request<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckData<E>> {
  if (!socket.connected) {
    await waitForSocketConnected(5_000);
  }
  const response = await socket.sendWithAck(event, payload, 10_000);
  if (!response.ok) {
    throw new RequestError(
      response.error.code,
      response.error.message,
      response.error.details,
    );
  }
  return response.data as AckData<E>;
}

export function describeError(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Please try again.";
}
