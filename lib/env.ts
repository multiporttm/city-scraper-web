// Server-only. API keys for the scrapers and Apple Maps, taken from the Pages Functions environment
// (dashboard → Settings → Variables and Secrets, or .dev.vars locally). Each function calls setEnv first.
let env: Record<string, string | undefined> = {};

export function setEnv(values: object) {
  env = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export const getEnv = (name: string) => env[name] || undefined;
