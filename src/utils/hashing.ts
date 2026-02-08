import { createHash } from 'node:crypto';

/**
 * Generate SHA-256 hash of event content for change detection
 */
export function generateContentHash(content: Record<string, unknown>): string {
  // Stringify with sorted keys for consistent hashing
  const normalized = JSON.stringify(content, Object.keys(content).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate a unique event ID from source and event URL
 */
export function generateEventId(sourceId: string, eventUrl: string): string {
  const combined = `${sourceId}:${eventUrl}`;
  return createHash('sha256').update(combined).digest('hex').slice(0, 16);
}
