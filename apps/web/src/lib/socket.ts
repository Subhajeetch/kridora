import type { Ack, ClientToServerEvents, ErrorCode, ServerToClientEvents } from "@kridora/shared"
import { io, type Socket } from "socket.io-client"

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** One socket for the whole app. RealtimeProvider connects it when someone is signed in. */
export const socket: AppSocket = io({
  path: "/socket.io",
  withCredentials: true,
  autoConnect: false,
})

export type RequestErrorCode = ErrorCode | "TIMEOUT" | "OFFLINE"

export class RequestError extends Error {
  code: RequestErrorCode
  details: Record<string, unknown> | undefined

  constructor(code: RequestErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "RequestError"
    this.code = code
    this.details = details
  }
}

type AckData<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]>[1] extends (response: Ack<infer T>) => void ? T : never

interface UntypedEmitter {
  timeout(ms: number): { emitWithAck(event: string, payload: unknown): Promise<Ack<unknown>> }
}

/** Waits for the socket to establish a connection. */
export async function waitForSocketConnected(timeoutMs = 10_000): Promise<void> {
  if (socket.connected) return
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new RequestError("TIMEOUT", "Connecting to the server timed out. Please try again."))
    }, timeoutMs)

    function onConnect() {
      cleanup()
      resolve()
    }

    function onError(err: Error) {
      cleanup()
      reject(new RequestError("OFFLINE", err.message || "Could not connect to the game server."))
    }

    function cleanup() {
      clearTimeout(timer)
      socket.off("connect", onConnect)
      socket.off("connect_error", onError)
    }

    socket.once("connect", onConnect)
    socket.once("connect_error", onError)

    if (!socket.connected) {
      socket.connect()
    }
  })
}

/** Sends an event and resolves with the server's data, or throws a RequestError. */
export async function request<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckData<E>> {
  if (!socket.connected) {
    throw new RequestError("OFFLINE", "You are offline. Reconnecting...")
  }
  let response: Ack<unknown>
  try {
    response = await (socket as unknown as UntypedEmitter).timeout(10_000).emitWithAck(event, payload)
  } catch {
    throw new RequestError("TIMEOUT", "The server took too long to respond. Try again.")
  }
  if (!response.ok) {
    throw new RequestError(response.error.code, response.error.message, response.error.details)
  }
  return response.data as AckData<E>
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again."
}
