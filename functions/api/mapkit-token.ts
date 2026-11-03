// Cloudflare Pages Function: GET /api/mapkit-token
// A signed token for Apple Maps (MapKit JS), or 503 when the Apple keys aren't set (the app then uses the free map).
import { setEnv } from '@/lib/env';
import { mapkitConfigured, mapkitToken } from '@/server/mapkitToken';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  setEnv(env);
  if (!mapkitConfigured()) return new Response('Apple Maps is not configured', { status: 503 });
  const token = await mapkitToken(new URL(request.url).origin);
  return new Response(token, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
};
