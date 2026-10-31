#!/usr/bin/env node
/**
 * The Mac's half of the routine sync (docs/ROUTINE.md, DECISIONS #238). Closes the
 * Reminders ticked on the page, then sends every timed event and open Reminder.
 * It reads titles, times and rooms from Calendar and Reminders, plus the vault's
 * list of cancelled classes, and nothing else: no note, grade or email can leave
 * because nothing here opens one. Logs print counts, never titles.
 *
 *   node scripts/routine-sync.mjs            Sync once.
 *   node scripts/routine-sync.mjs --dry-run  Read and report, sending nothing.
 *   node scripts/routine-sync.mjs --install  Copy to Application Support and run every 30 minutes.
 *   node scripts/routine-sync.mjs --new-token  Make a token and print the hash the database needs.
 */

import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blocksFrom, isoDate, parseOverrides, staleBackups, tasksFrom } from "./routine-sync-lib.mjs";

const CALENDARS = ["TMUCalendar", "Work", "School"];
const REMINDER_LISTS = ["School", "Study"];
const DAYS_AHEAD = 21;
const OVERRIDES = join(homedir(), "Documents/Uni/.claude/data/overrides.tsv");
const KEYCHAIN_SERVICE = "kryloss-routine-sync";
const LABEL = "com.kryloss.routine-sync";
const BACKUPS = join(homedir(), "Library/Application Support/routine-sync/backups");
const BACKUPS_KEPT = 30;
const FIELD = "\u001f";
const RECORD = "\u001e";

function appleScript(source, ...args) {
  return execFileSync("osascript", ["-", ...args], {
    input: source,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 300_000,
  });
}

function records(output) {
  return output
    .split(RECORD)
    .map((record) => record.trim().split(FIELD))
    .filter((fields) => fields.length > 1);
}

const COMMON = `
property fieldMark : character id 31
property recordMark : character id 30

on stamp(d)
  if d is missing value then return ""
  return d as «class isot» as string
end stamp
`;

function readReminders() {
  // Bulk reads, one Apple Event each: per-item access takes minutes. iCloud can
  // sync between them, so a mismatch fails the run and the next one tries again.
  const output = appleScript(
    `${COMMON}
on run argv
  set out to ""
  tell application "Reminders"
    repeat with listName in argv
      if not (exists list listName) then error "missing list"
      set ids to id of (reminders of list listName whose completed is false)
      set nms to name of (reminders of list listName whose completed is false)
      set dds to due date of (reminders of list listName whose completed is false)
      if (count of ids) is not (count of nms) or (count of ids) is not (count of dds) then error "list changed mid-read"
      repeat with i from 1 to count of ids
        set out to out & (item i of ids) & fieldMark & (item i of nms) & fieldMark & my stamp(item i of dds) & recordMark
      end repeat
    end repeat
  end tell
  return out
end run`,
    ...REMINDER_LISTS
  );
  return records(output).map(([id, title, due]) => ({ id, title, due: due || null }));
}

function readEvents() {
  const output = appleScript(
    `${COMMON}
on run argv
  set out to ""
  tell application "Calendar"
    repeat with c in calendars
      set calendarName to name of c
      if calendarName is in argv then
        repeat with e in events of c
          set rule to recurrence of e
          if rule is missing value then set rule to ""
          set room to location of e
          if room is missing value then set room to ""
          set skipped to ""
          set excludedList to (get excluded dates of e)
          repeat with i from 1 to count of excludedList
            set skipped to skipped & my stamp(item i of excludedList) & ","
          end repeat
          set out to out & calendarName & fieldMark & (summary of e) & fieldMark & my stamp(start date of e) & fieldMark & my stamp(end date of e) & fieldMark & (allday event of e) & fieldMark & rule & fieldMark & room & fieldMark & skipped & recordMark
        end repeat
      end if
    end repeat
  end tell
  return out
end run`,
    ...CALENDARS
  );

  return records(output).map(([calendar, title, start, end, allDay, rule, location, skipped]) => ({
    title,
    start,
    end,
    allDay: allDay === "true",
    rule: rule || null,
    location,
    tmu: calendar === "TMUCalendar",
    excluded: (skipped ?? "").split(",").filter(Boolean).map((stamp) => stamp.slice(0, 10)),
  }));
}

function closeReminders(ids) {
  const closed = [];
  for (const id of ids) {
    try {
      appleScript(
        `on run argv
  tell application "Reminders" to set completed of reminder id (item 1 of argv) to true
end run`,
        id
      );
      closed.push(id);
    } catch {
      // Deleted on the Mac, most likely. It stays owed and shows in the log's count.
    }
  }
  return closed;
}

function keychainToken() {
  return execFileSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
    encoding: "utf8",
  }).trim();
}

/** A new token goes in the Keychain. Only its hash is printed, for the database. */
function newToken() {
  const token = randomBytes(32).toString("hex");
  execFileSync("security", ["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", "routine", "-w", token]);
  console.log(createHash("sha256").update(token).digest("hex"));
}

function settings() {
  const url = process.env.ROUTINE_SUPABASE_URL;
  const key = process.env.ROUTINE_SUPABASE_KEY;
  if (!url || !key) throw new Error("ROUTINE_SUPABASE_URL and ROUTINE_SUPABASE_KEY are not set");
  return { url, key };
}

async function rpc({ url, key }, name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name}: ${response.status} ${JSON.parse(text || "{}").message ?? ""}`);
  return text ? JSON.parse(text) : null;
}

function read() {
  const today = new Date();
  const from = isoDate(today);
  const to = isoDate(new Date(today.getTime() + DAYS_AHEAD * 86_400_000));
  const overrides = existsSync(OVERRIDES) ? parseOverrides(readFileSync(OVERRIDES, "utf8")) : [];
  return {
    from,
    to,
    blocks: blocksFrom(readEvents(), overrides, from, to),
    tasks: tasksFrom(readReminders()),
  };
}

/** The Free plan keeps no backups, so the Mac takes one a day. Readable only by this account. */
async function backup(config, p_token) {
  const file = join(BACKUPS, `routine-${isoDate(new Date())}.json`);
  if (existsSync(file)) return;

  mkdirSync(BACKUPS, { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(await rpc(config, "routine_sync_backup", { p_token })), { mode: 0o600 });
  for (const name of staleBackups(readdirSync(BACKUPS), BACKUPS_KEPT)) {
    rmSync(join(BACKUPS, name));
  }
}

async function sync() {
  const config = settings();
  const p_token = keychainToken();

  // Ticks first: a Reminder closed now won't be sent as open a moment later.
  const ticks = await rpc(config, "routine_sync_ticks", { p_token });
  const closed = closeReminders(ticks);
  if (closed.length) await rpc(config, "routine_sync_closed", { p_token, p_keys: closed });

  const { from, to, blocks, tasks } = read();
  const result = await rpc(config, "routine_sync_push", {
    p_token,
    p_from: from,
    p_to: to,
    p_blocks: blocks,
    p_tasks: tasks,
  });
  await backup(config, p_token);
  console.log(
    `${new Date().toISOString()} ok: ${blocks.length} events, ${tasks.length} reminders, ` +
      `${closed.length}/${ticks.length} closed, ${result.added} added, ${result.changed} changed, ${result.gone} gone`
  );
}

function install() {
  const { url, key } = settings();
  const here = dirname(fileURLToPath(import.meta.url));
  const home = join(homedir(), "Library/Application Support/routine-sync");
  mkdirSync(home, { recursive: true });
  for (const name of ["routine-sync.mjs", "routine-sync-lib.mjs"]) {
    copyFileSync(join(here, name), join(home, name));
  }

  const plist = join(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);
  const log = join(homedir(), "Library/Logs/routine-sync.log");
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${process.execPath}</string><string>${join(home, "routine-sync.mjs")}</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ROUTINE_SUPABASE_URL</key><string>${url}</string>
    <key>ROUTINE_SUPABASE_KEY</key><string>${key}</string>
  </dict>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict>
</plist>
`
  );

  const domain = `gui/${process.getuid()}`;
  try {
    execFileSync("launchctl", ["bootout", `${domain}/${LABEL}`], { stdio: "ignore" });
  } catch {
    // Not loaded yet.
  }
  execFileSync("launchctl", ["bootstrap", domain, plist]);
  console.log(`Installed. Log: ${log}`);
}

if (process.argv.includes("--install")) {
  install();
} else if (process.argv.includes("--new-token")) {
  newToken();
} else if (process.argv.includes("--dry-run")) {
  const { from, to, blocks, tasks } = read();
  console.log(`${from} to ${to}: ${blocks.length} events, ${tasks.length} reminders. Nothing sent.`);
} else {
  sync().catch((error) => {
    console.error(`${new Date().toISOString()} failed: ${error.message}`);
    process.exit(1);
  });
}
