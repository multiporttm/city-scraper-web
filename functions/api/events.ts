// Cloudflare Pages Function: GET /api/events?location=&distance=&days=&times=&interests=
import { setEnv } from '@/lib/env';
import { getEvents } from '@/server/events';

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  setEnv(env);
  return getEvents(request);
};
