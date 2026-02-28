import { Event } from '@/types/event';

function formatTime(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export function EventCard({ event }: { event: Event }) {
  const time = formatTime(event.startAt, event.timezone);
  const endTime = event.endAt ? formatTime(event.endAt, event.timezone) : null;

  return (
    <a
      href={event.eventUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {event.title}
          </h3>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {time}
            {endTime && ` - ${endTime}`}
          </span>
        </div>

        {event.locationName && (
          <p className="mt-2 text-sm text-gray-600">{event.locationName}</p>
        )}

        {event.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">
            {event.description}
          </p>
        )}
      </div>
    </a>
  );
}
