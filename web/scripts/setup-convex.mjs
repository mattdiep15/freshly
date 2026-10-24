// Sets a Convex deployment's env vars and loads its first data, with prompts: npm run setup:convex (from web/)
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import webpush from "web-push";

const CLI = join("node_modules", "convex", "bin", "main.js");
const tty = Boolean(process.stdin.isTTY);

// Readline echoes through this stream, so muting it hides key input.
let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: tty });
// Queue lines so piped answers that arrive at once are not dropped.
const lines = [];
const waiting = [];
let closed = false;
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on("close", () => {
  closed = true;
  while (waiting.length) waiting.shift()(null);
});
rl.on("SIGINT", () => {
  process.stdout.write("\nCancelled.\n");
  process.exit(130);
});

function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden;
  return new Promise((resolve) => {
    const done = (line) => {
      muted = false;
      if (hidden || !tty) process.stdout.write("\n");
      resolve((line ?? "").trim());
    };
    if (lines.length) done(lines.shift());
    else if (closed) done(null);
    else waiting.push(done);
  });
}

async function confirm(question, fallback) {
  const answer = (await ask(`${question} ${fallback ? "[Y/n]" : "[y/N]"} `)).toLowerCase();
  return answer === "" ? fallback : answer === "y" || answer === "yes";
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

let targetFlags = [];

// Runs the Convex CLI with node directly, so no shell parses the arguments.
function convex(args, { input, capture = false } = {}) {
  const piped = input !== undefined || capture;
  if (tty) process.stdin.setRawMode(false);
  const result = spawnSync(process.execPath, [CLI, ...args], {
    input,
    encoding: "utf8",
    stdio: piped ? ["pipe", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (tty) process.stdin.setRawMode(true);
  return result;
}

// Values go in on stdin so they never show up in argv or the terminal.
function setVar(name, value) {
  const result = convex(["env", "set", name, ...targetFlags], { input: value });
  if (result.status !== 0) fail(`Setting ${name} failed:\n${result.stderr}`);
  console.log(`  set ${name}`);
}

function getVar(name) {
  const result = convex(["env", "get", name, ...targetFlags], { capture: true });
  return result.status === 0 ? result.stdout.trim() : "";
}

function runStep(args) {
  console.log(`\n> npx convex ${args.join(" ")}`);
  if (convex(args).status !== 0) fail(`npx convex ${args.join(" ")} failed.`);
}

function readEnvLocal() {
  if (!existsSync(".env.local")) return {};
  const pairs = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]);
  return Object.fromEntries(pairs);
}

async function main() {
  if (!existsSync("package.json") || !existsSync("convex")) fail("Run this from web/: npm run setup:convex");
  if (!existsSync(CLI)) fail("Convex CLI not found. Run npm install in web/ first.");
  const devDeployment = readEnvLocal().CONVEX_DEPLOYMENT;
  if (!devDeployment) {
    fail("No CONVEX_DEPLOYMENT in web/.env.local. Run `npx convex dev --once` from web/ to log in and pick a dev deployment, then run this again.");
  }

  console.log("Which Convex deployment should this set up?");
  console.log(`  1) dev: ${devDeployment} (from .env.local)`);
  console.log("  2) prod: this project's production deployment");
  const prod = (await ask("Choose 1 or 2 [1]: ")) === "2";
  if (prod) {
    // Anonymous and local deployments answer --prod with themselves, so there is no real prod to target.
    if (/^(anonymous|local):/.test(devDeployment)) fail(`${devDeployment} is a local deployment and has no prod deployment.`);
    targetFlags = ["--prod"];
    const dash = convex(["dashboard", "--no-open", "--prod"], { capture: true });
    if (dash.status !== 0) fail(`Could not find the prod deployment:\n${dash.stderr}`);
    const name = dash.stdout.match(/\/d\/([\w-]+)/)?.[1] ?? dash.stdout.trim();
    console.log(`\nTarget: PRODUCTION deployment ${name}`);
    if ((await ask('Type "yes" to change env vars on production: ')) !== "yes") fail("Nothing changed.");
  } else {
    console.log(`\nTarget: dev deployment ${devDeployment}`);
    if (!(await confirm("Continue?", true))) fail("Nothing changed.");
  }

  const list = convex(["env", "list", "--names-only", ...targetFlags], { capture: true });
  if (list.status !== 0) fail(`Could not read env var names:\n${list.stderr}`);
  const existing = new Set(list.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line)));

  console.log("\nConvex Auth");
  const hasAuth = existing.has("JWT_PRIVATE_KEY") && existing.has("JWKS");
  if (!hasAuth || (await confirm("Auth keys are already set. Replace them? Every user gets signed out.", false))) {
    // Same RS256 key pair and JWKS format that `npx @convex-dev/auth` generates.
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trimEnd().replace(/\n/g, " ");
    setVar("JWT_PRIVATE_KEY", pem);
    setVar("JWKS", JSON.stringify({ keys: [{ use: "sig", ...publicKey.export({ format: "jwk" }) }] }));
  }
  const currentSiteUrl = existing.has("SITE_URL") ? getVar("SITE_URL") : "";
  const siteDefault = currentSiteUrl || (prod ? "" : "http://localhost:3000");
  let siteUrl = "";
  while (!siteUrl) {
    siteUrl = (await ask(`SITE_URL, the app's public URL${siteDefault ? ` [${siteDefault}]` : ""}: `)) || siteDefault;
    if (closed && !siteUrl) fail("SITE_URL is required.");
  }
  if (siteUrl !== currentSiteUrl) setVar("SITE_URL", siteUrl);

  console.log("\nAPI keys (input is hidden; Enter skips)");
  const keys = [
    ["ANTHROPIC_API_KEY", "Claude: receipt parsing and storage tips; receipts fail without it"],
    ["GEMINI_API_KEY", "Gemini: receipt date check and web shelf life; optional"],
    ["APIFY_TOKEN", "Apify: web shelf-life search; optional"],
  ];
  for (const [name, use] of keys) {
    const state = existing.has(name) ? "already set, Enter keeps it" : "not set";
    const value = await ask(`${name} (${use}) [${state}]: `, { hidden: true });
    if (value) setVar(name, value);
  }

  console.log("\nPush notifications");
  if (existing.has("VAPID_PRIVATE_KEY")) {
    console.log("  VAPID keys already set.");
  } else if (await confirm("Generate VAPID keys for push notifications?", !prod)) {
    let subject = "";
    while (!/^(mailto:|https:)/.test(subject)) {
      subject = await ask("VAPID_SUBJECT, a mailto: address for push services to contact: ");
      if (closed && !subject) fail("VAPID_SUBJECT is required.");
    }
    const vapid = webpush.generateVAPIDKeys();
    setVar("VAPID_PUBLIC_KEY", vapid.publicKey);
    setVar("VAPID_PRIVATE_KEY", vapid.privateKey);
    setVar("VAPID_SUBJECT", subject);
    console.log(`  Add to ${prod ? "Vercel's env vars" : "web/.env.local"}: NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid.publicKey}`);
  }

  if (await confirm("\nSet model overrides (RECEIPT_MODEL, GEMINI_MODEL, LLM_PROVIDER)?", false)) {
    for (const name of ["RECEIPT_MODEL", "GEMINI_MODEL"]) {
      const value = await ask(`${name} [Enter keeps the code default]: `);
      if (value) setVar(name, value);
    }
    let provider = "x";
    while (!["", "anthropic", "gemini"].includes(provider)) {
      provider = await ask("LLM_PROVIDER, anthropic or gemini [Enter keeps anthropic]: ");
    }
    if (provider) setVar("LLM_PROVIDER", provider);
  }

  console.log("\nDemo user");
  if (!prod) {
    setVar("ALLOW_DEMO_USER", "true");
  } else if (existing.has("ALLOW_DEMO_USER")) {
    if (await confirm("ALLOW_DEMO_USER is set on prod, so anyone can act as the demo user. Remove it?", true)) {
      if (convex(["env", "remove", "ALLOW_DEMO_USER", ...targetFlags], { capture: true }).status !== 0) {
        fail("Removing ALLOW_DEMO_USER failed.");
      }
      console.log("  removed ALLOW_DEMO_USER");
    }
  } else {
    console.log("  ALLOW_DEMO_USER stays unset on prod.");
  }

  if (await confirm(`\nPush functions now (${prod ? "npx convex deploy" : "npx convex dev --once"})?`, true)) {
    runStep(prod ? ["deploy", "--yes"] : ["dev", "--once"]);
  }
  if (!prod && (await confirm("Reset demo data (dev:reseed)? Imports reference foods on an empty deployment.", true))) {
    runStep(["run", "dev:reseed"]);
  }
  if (prod && (await confirm("Load reference foods (foods:importReference)?", true))) {
    runStep(["run", "foods:importReference", ...targetFlags]);
  }
  if (await confirm("Fill missing storage tips (foods:backfillTips)? It makes paid model calls.", false)) {
    runStep(["run", "foods:backfillTips", ...targetFlags]);
  }

  console.log(prod ? "\nDone. Vercel needs NEXT_PUBLIC_CONVEX_URL for this deployment." : "\nDone. Start the app with npm run dev.");
  rl.close();
}

main();
