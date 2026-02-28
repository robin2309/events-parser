'use client';

import { useEvents } from '@/context/EventsContext';
import { DaySection } from './DaySection';
import { Event } from '@/types/event';

function groupEventsByDay(events: Event[]): Map<string, Event[]> {
  const groups = new Map<string, Event[]>();

  for (const event of events) {
    const dayKey = new Date(event.startAt).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: event.timezone,
    });

    const existing = groups.get(dayKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dayKey, [event]);
    }
  }

  return groups;
}

export function EventList() {
  const { events } = useEvents();

  if (events.length === 0) {
    return (
      <p className="text-center text-gray-500 py-12">
        Aucun evenement a venir.
      </p>
    );
  }

  const grouped = groupEventsByDay(events);

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([day, dayEvents]) => (
        <DaySection key={day} day={day} events={dayEvents} />
      ))}
    </div>
  );
}
