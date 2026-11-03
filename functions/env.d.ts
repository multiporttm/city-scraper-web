// Variables and secrets available to the Pages Functions.
// Set them in the Cloudflare dashboard (your Pages project → Settings → Variables and Secrets),
// or in .dev.vars for local development. All are optional; see .dev.vars.example.
interface Env {
  TICKETMASTER_API_KEY?: string;
  SEATGEEK_CLIENT_ID?: string;
  PREDICTHQ_TOKEN?: string;
  EVENTBRITE_TOKEN?: string;
  APPLE_MAPKIT_TEAM_ID?: string;
  APPLE_MAPKIT_KEY_ID?: string;
  APPLE_MAPKIT_PRIVATE_KEY?: string;
}
