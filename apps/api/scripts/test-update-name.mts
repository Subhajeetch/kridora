const API = "http://localhost:2020";
const ORIGIN = "http://localhost:5173";

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + JSON.stringify(extra)}`);
  if (!cond) failures++;
};

async function run() {
  console.log("=== Testing Display Name Update API Security & Functionality ===");

  // 1. Unauthenticated request
  const unauthRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ name: "Hacker" }),
  });
  const unauthData = await unauthRes.json();
  check("Unauthenticated request returns 401", unauthRes.status === 401, { status: unauthRes.status, body: unauthData });
  check("Unauthenticated error code is UNAUTHENTICATED", unauthData?.error?.code === "UNAUTHENTICATED", unauthData);

  // 2. Sign in as guest
  const guestRes = await fetch(`${API}/api/auth/sign-in/anonymous`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: "{}",
  });
  let cookie = guestRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const meBefore = await (await fetch(`${API}/api/me`, { headers: { cookie } })).json();
  const userId = meBefore.user.id;
  check("Guest signed in successfully", Boolean(userId), meBefore);

  // 3. User ID spoofing attempt (trying to edit someone else's name)
  const spoofRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify({ userId: "victim-user-id-9999", name: "EvilName" }),
  });
  const spoofData = await spoofRes.json();
  check("Mismatched userId returns 403 Forbidden", spoofRes.status === 403, { status: spoofRes.status, body: spoofData });
  check("Spoof error code is FORBIDDEN", spoofData?.error?.code === "FORBIDDEN", spoofData);

  // 4. Invalid name: too short (1 char)
  const shortRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "A" }),
  });
  const shortData = await shortRes.json();
  check("Too short name returns 400", shortRes.status === 400, { status: shortRes.status, body: shortData });
  check("Short error code is VALIDATION_ERROR", shortData?.error?.code === "VALIDATION_ERROR", shortData);

  // 5. Invalid name: too long (>20 chars)
  const longRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "ThisNameIsFarTooLongForOurSchema" }),
  });
  const longData = await longRes.json();
  check("Too long name returns 400", longRes.status === 400, { status: longRes.status, body: longData });
  check("Long error code is VALIDATION_ERROR", longData?.error?.code === "VALIDATION_ERROR", longData);

  // 6. Invalid name: disallowed characters
  const invalidCharsRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Invalid<script>" }),
  });
  const invalidCharsData = await invalidCharsRes.json();
  check("Invalid characters returns 400", invalidCharsRes.status === 400, { status: invalidCharsRes.status, body: invalidCharsData });

  // 7. Valid name update with userId matching session
  const targetName = "CoolPlayer" + Math.floor(Math.random() * 1000);
  const updateRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify({ userId, name: targetName }),
  });
  const updateData = await updateRes.json();
  check("Valid name update returns 200", updateRes.status === 200, { status: updateRes.status, body: updateData });
  check("Update response returns success and name", updateData?.success === true && updateData?.name === targetName, updateData);

  const extra = updateRes.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (extra.length) cookie = extra.join("; ");

  // 8. Verify /api/me reflects the updated name
  const meAfter = await (await fetch(`${API}/api/me`, { headers: { cookie } })).json();
  check("/api/me reflects updated name", meAfter?.user?.name === targetName, meAfter);

  // 9. Unchanged name request returns 200 with unchanged: true
  const sameRes = await fetch(`${API}/api/me/name`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify({ name: targetName }),
  });
  const sameData = await sameRes.json();
  check("Same name returns unchanged: true", sameRes.status === 200 && sameData?.unchanged === true, sameData);

  if (failures > 0) {
    console.error(`\nCompleted with ${failures} failure(s)`);
    process.exit(1);
  } else {
    console.log(`\nAll tests passed successfully!`);
  }
}

void run();
