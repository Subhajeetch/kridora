import { io, type Socket } from "socket.io-client";

const API = "http://localhost:2020";
const ORIGIN = "http://localhost:5173";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + JSON.stringify(extra)}`);
  if (!cond) failures++;
};

async function guest(name: string) {
  const res = await fetch(`${API}/api/auth/sign-in/anonymous`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" });
  let cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const up = await fetch(`${API}/api/auth/update-user`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", cookie }, body: JSON.stringify({ name }) });
  const extra = up.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (extra.length) cookie = extra.join("; ");
  const me = await (await fetch(`${API}/api/me`, { headers: { cookie } })).json();
  return { cookie, id: me.user.id as string, name: me.user.name as string };
}

function connect(cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(API, { extraHeaders: { cookie, origin: ORIGIN }, transports: ["websocket"], forceNew: true });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });
}
const call = (s: Socket, ev: string, payload: unknown = {}): Promise<any> => s.timeout(8000).emitWithAck(ev, payload);

const A = await guest("Alice");
const B = await guest("Bobby");
const C = await guest("Carol");
const sa = await connect(A.cookie), sb = await connect(B.cookie), sc = await connect(C.cookie);

// unauthenticated socket is rejected
const bad = await new Promise<string>((res) => { const s = io(API, { extraHeaders: { origin: ORIGIN }, transports: ["websocket"], forceNew: true }); s.on("connect_error", (e) => { res(e.message); s.close(); }); s.on("connect", () => res("connected")); });
check("unauthenticated socket rejected", bad === "UNAUTHENTICATED", bad);
// foreign origin rejected
const foreign = await new Promise<string>((res) => { const s = io(API, { extraHeaders: { cookie: A.cookie, origin: "http://evil.example" }, transports: ["websocket"], forceNew: true }); s.on("connect_error", (e) => { res("rejected"); s.close(); }); s.on("connect", () => { res("connected"); s.close(); }); });
check("foreign origin rejected", foreign === "rejected", foreign);

let lastB: any = null;
sb.on("room:state", (r) => (lastB = r));

let r = await call(sa, "room:create", { gameSlug: "monopoly" });
check("create room", r.ok && r.data.visibility === "private" && r.data.players.length === 1, r);
const code = r.data.code as string;
check("code is 6 chars", /^[A-HJ-NP-Z2-9]{6}$/.test(code), code);

r = await call(sa, "room:create", { gameSlug: "monopoly" });
check("cannot create second room", !r.ok && r.error.code === "ALREADY_IN_ROOM", r);
r = await call(sb, "room:create", { gameSlug: "nope" });
check("unknown game rejected", !r.ok && r.error.code === "GAME_NOT_FOUND", r);
r = await call(sb, "room:join", { code: "ZZZZZZ" });
check("join unknown code", !r.ok && r.error.code === "ROOM_NOT_FOUND", r);
r = await call(sb, "room:join", { code: "bad" });
check("join malformed code", !r.ok && r.error.code === "VALIDATION_ERROR", r);

r = await call(sb, "room:join", { code: code.toLowerCase() });
check("join by code (case-insensitive)", r.ok && r.data.players.length === 2, r);
r = await call(sc, "room:join-public", { gameSlug: "monopoly" });
check("private room not joinable publicly", !r.ok && r.error.code === "NO_PUBLIC_ROOM", r);
r = await call(sb, "room:set-visibility", { visibility: "public" });
check("non-owner cannot change visibility", !r.ok && r.error.code === "NOT_ROOM_OWNER", r);
r = await call(sa, "room:set-visibility", { visibility: "public" });
check("owner makes room public", r.ok && r.data.visibility === "public", r);
r = await call(sc, "room:join-public", { gameSlug: "monopoly" });
check("join public room", r.ok && r.data.code === code && r.data.players.length === 3, r);

r = await call(sa, "room:start");
check("start blocked until ready", !r.ok && r.error.code === "START_REQUIREMENTS_NOT_MET", r);
check("start check lists reasons", r.error?.details?.unmet?.[0]?.code === "NOT_ALL_READY", r.error);
r = await call(sb, "room:start");
check("non-owner cannot start", !r.ok && r.error.code === "NOT_ROOM_OWNER", r);
await call(sb, "room:set-ready", { ready: true });
r = await call(sc, "room:set-ready", { ready: true });
check("all ready => canStart", r.ok && r.data.start.canStart === true, r.data?.start);
await sleep(200);
check("broadcast reached other player", lastB?.players?.find((p: any) => p.userId === C.id)?.isReady === true, lastB);

// kick + ban
r = await call(sa, "room:kick", { userId: C.id });
check("kick player", r.ok && r.data.players.length === 2, r);
r = await call(sc, "room:join", { code });
check("kicked player is banned", !r.ok && r.error.code === "BANNED_FROM_ROOM", r);

// transfer ownership
r = await call(sa, "room:transfer-owner", { userId: B.id });
check("transfer owner", r.ok && r.data.ownerId === B.id, r);
r = await call(sb, "room:transfer-owner", { userId: A.id });
check("transfer back", r.ok && r.data.ownerId === A.id, r);

// refresh: second socket for same user must not mark offline
const sb2 = await connect(B.cookie);
sb.close();
await sleep(1500);
r = await call(sb2, "room:join", { code });
check("rejoin after refresh keeps seat, stays connected", r.ok && r.data.players.find((p: any) => p.userId === B.id)?.connected === true && r.data.players.length === 2, r);

// owner goes offline => transfer after ~40s
const t0 = Date.now();
let stateAfter: any = null;
sb2.on("room:state", (rm) => (stateAfter = rm));
sa.close();
await sleep(22000);
check("owner offline shows countdown", stateAfter?.ownerTransferAt != null && stateAfter.ownerId === A.id, stateAfter);
console.log("waiting for owner transfer deadline...");
while (Date.now() - t0 < 70000 && stateAfter?.ownerId === A.id) await sleep(500);
const took = Math.round((Date.now() - t0) / 1000);
check(`ownership moved to first joined player (~40s after disconnect; took ${took}s)`, stateAfter?.ownerId === B.id && took >= 38 && took <= 50, { owner: stateAfter?.ownerId, took });

// owner returns, is a normal player now
const sa2 = await connect(A.cookie);
await sleep(800);
r = await call(sa2, "room:join", { code });
check("old owner rejoins as player", r.ok && r.data.ownerId === B.id && r.data.players.find((p: any) => p.userId === A.id)?.connected, r);

// start game
await call(sa2, "room:set-ready", { ready: true });
r = await call(sb2, "room:start");
check("start game", r.ok && r.data.status === "in_progress" && !!r.data.matchId, r);
r = await call(sc, "room:join", { code });
check("cannot join started game", !r.ok, r);

// leave
r = await call(sa2, "room:leave");
check("leave room", r.ok, r);
r = await call(sb2, "room:leave");
check("last leave closes room", r.ok, r);
r = await call(sc, "room:join", { code });
check("room gone after everyone left", !r.ok && r.error.code === "ROOM_NOT_FOUND", r);

for (const s of [sb2, sa2, sc]) s.close();
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
