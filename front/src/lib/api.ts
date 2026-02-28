import { Event } from '@/types/event';

const API_URL = process.env.API_URL || 'http://localhost:3000';

export async function fetchEvents(from: Date, to: Date): Promise<Event[]> {
  const url = new URL('/events', API_URL);
  url.searchParams.set('from', from.toISOString());
  url.searchParams.set('to', to.toISOString());

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
