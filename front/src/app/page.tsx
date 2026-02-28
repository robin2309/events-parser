import { fetchEvents } from '@/lib/api';
import { EventsProvider } from '@/context/EventsContext';
import { EventList } from '@/components/EventList';

export default async function Home() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  const events = await fetchEvents(from, to);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Hapta</h1>
          <p className="mt-1 text-sm text-gray-500">
            Evenements des 7 prochains jours
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EventsProvider events={events}>
          <EventList />
        </EventsProvider>
      </div>
    </main>
  );
}
