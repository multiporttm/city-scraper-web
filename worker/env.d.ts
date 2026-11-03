// With the nodejs_compat flag, Workers fill process.env from the vars and secrets in wrangler.jsonc / .dev.vars.
// The scrapers read their API keys from it.
declare const process: { env: Record<string, string | undefined> };

interface Env {
  ASSETS: Fetcher;
}
