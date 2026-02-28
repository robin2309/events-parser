'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Event } from '@/types/event';

interface EventsContextValue {
  events: Event[];
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({
  events,
  children,
}: {
  events: Event[];
  children: ReactNode;
}) {
  return (
    <EventsContext.Provider value={{ events }}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error('useEvents must be used within EventsProvider');
  }
  return ctx;
}
