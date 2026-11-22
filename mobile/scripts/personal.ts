/**
 * The diver's own phone app, "for me": a signed release that carries the Google Drive sign-in of
 * DiveDeck on this PC (its OAuth client and refresh token), so the phone fetches the log from Drive
 * by itself. Only for the diver's own phone: never share this APK, and never build it in CI.
 * Every other build (bun run android:release) carries no credential at all.
 *
 *   bun run android:me                      # the APK lands in mobile/android/app/build/outputs/apk/release/
 *   bun run android:me -- --out "C:\some\folder"
 *
 * Afterwards the build folders are rebuilt without the credentials, and Gradle's outputs that held
 * them are removed, so nothing with them stays behind but the APK itself.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { oauthClient } from "../../lib/server/cloudAuth";
import { dataDir } from "../../lib/server/paths";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const APP = path.join(ROOT, "mobile", "android", "app");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed.`);
}

const client = oauthClient();
if (!client) fail("No Google OAuth client in DiveDeck's settings on this PC: connect Google Drive in Settings first.");
let token: { refreshToken?: string; email?: string } = {};
try {
  token = JSON.parse(readFileSync(path.join(dataDir(), "google-token.json"), "utf8"));
} catch {
  // checked below
}
if (!token.refreshToken) fail("Google Drive isn't connected on this PC: connect it in DiveDeck's Settings first.");

const outArg = process.argv.indexOf("--out");
const outDir = outArg > 0 ? process.argv[outArg + 1] : path.join(APP, "build", "outputs", "apk", "release");
const version = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version as string;
const target = path.join(outDir, `DiveDeck-${version}-dla-mnie.apk`);

const clean: NodeJS.ProcessEnv = { ...process.env };
delete clean.DIVEDECK_PERSONAL_BUILD;
const personal: NodeJS.ProcessEnv = {
  ...clean,
  DIVEDECK_PERSONAL_BUILD: JSON.stringify({ google: { clientId: client.id, clientSecret: client.secret, refreshToken: token.refreshToken, email: token.email } }),
};

try {
  run("bun", ["run", "build:mobile"], personal);
  run("bunx", ["cap", "sync", "android"], clean);
  run("node", ["mobile/scripts/android.mjs", "release"], clean);
  const built = path.join(APP, "build", "outputs", "apk", "release", "app-release.apk");
  if (!existsSync(built)) fail(`The APK wasn't built: ${built}`);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(built, target);
} finally {
  // Nothing with the credentials stays in the build folders: the web assets are built again without
  // them, and Gradle's outputs (APK, bundle, intermediates) are removed.
  run("bun", ["run", "build:mobile"], clean);
  run("bunx", ["cap", "sync", "android"], clean);
  for (const dir of ["intermediates", path.join("outputs", "bundle"), path.join("outputs", "apk")]) {
    const full = path.join(APP, "build", dir);
    if (!target.startsWith(full)) rmSync(full, { recursive: true, force: true });
  }
  if (target.startsWith(path.join(APP, "build"))) {
    rmSync(path.join(APP, "build", "outputs", "apk", "release", "app-release.apk"), { force: true });
  }
}
console.log(`\nYour own build, with Google Drive sign-in for ${token.email ?? "your account"}:\n  ${target}\nInstall it only on your own phone; don't share it.`);
