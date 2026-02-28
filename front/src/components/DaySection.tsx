import { Event } from '@/types/event';
import { EventCard } from './EventCard';

export function DaySection({ day, events }: { day: string; events: Event[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 capitalize mb-3 sticky top-0 bg-gray-50 py-2 z-10">
        {day}
      </h2>
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
