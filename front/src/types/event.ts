export interface Event {
  id: number;
  sourceId: string;
  sourceEventId: string | null;
  eventUrl: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string;
  imageUrl: string | null;
  locationName: string | null;
  locationAddress: string | null;
  ticketUrl: string | null;
  status: string;
  fetchedAt: string;
  lastSeenAt: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}
