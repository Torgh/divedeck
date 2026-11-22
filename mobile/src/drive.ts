import { CapacitorHttp } from "@capacitor/core";

/**
 * The diver's own build ("for me", bun run android:me) carries the Google Drive sign-in of DiveDeck
 * on the PC: its OAuth client and refresh token. With them the phone fetches the file the PC keeps up
 * to date (My Drive › DiveDeck › phone › DiveDeck.divedeck.json) by itself. Other builds carry
 * nothing: `__DIVEDECK_PERSONAL__` is then an empty string and these functions are never offered.
 * CapacitorHttp goes through Android's own HTTP stack, so Google's endpoints need no CORS.
 */
interface Personal {
  google?: { clientId: string; clientSecret: string; refreshToken: string; email?: string };
}

declare const __DIVEDECK_PERSONAL__: string;

const personal: Personal | null = (() => {
  try {
    return __DIVEDECK_PERSONAL__ ? (JSON.parse(__DIVEDECK_PERSONAL__) as Personal) : null;
  } catch {
    return null;
  }
})();

export const PHONE_FILE_NAME = "DiveDeck.divedeck.json";
export const driveAccount = (): string | null => (personal?.google ? (personal.google.email ?? "Google Drive") : null);

let token: { value: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  const google = personal?.google;
  if (!google) throw new Error("This build has no Google Drive sign-in.");
  if (token && token.until > Date.now()) return token.value;
  const res = await CapacitorHttp.post({
    url: "https://oauth2.googleapis.com/token",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      client_id: google.clientId,
      client_secret: google.clientSecret,
      refresh_token: google.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const body = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  if (res.status !== 200 || !body?.access_token) throw new Error(body?.error_description ?? body?.error ?? `sign-in failed (${res.status})`);
  token = { value: body.access_token, until: Date.now() + (Number(body.expires_in) - 60) * 1000 };
  return token.value;
}

/** The phone's file on Drive: its id and when it was last written, or null when there is none yet. */
export async function findPhoneFile(): Promise<{ id: string; modifiedTime: string } | null> {
  const q = `name = '${PHONE_FILE_NAME}' and trashed = false`;
  const res = await CapacitorHttp.get({
    url: "https://www.googleapis.com/drive/v3/files",
    params: { q, fields: "files(id,modifiedTime)", orderBy: "modifiedTime desc", pageSize: "1" },
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  const body = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  if (res.status !== 200) throw new Error(body?.error?.message ?? `Drive answered ${res.status}`);
  return body.files?.[0] ?? null;
}

/** The file's text. */
export async function downloadPhoneFile(id: string): Promise<string> {
  const res = await CapacitorHttp.get({
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
    params: { alt: "media" },
    headers: { Authorization: `Bearer ${await accessToken()}` },
    responseType: "text",
  });
  if (res.status !== 200) throw new Error(`Drive answered ${res.status}`);
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
}
