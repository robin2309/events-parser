import type { BaseAdapter } from './base.js';
import { ExampleVenueAdapter } from './exampleVenue.adapter.js';

/**
 * Adapter registry mapping adapter names to instances
 */
export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Register default adapters
   */
  private registerDefaults(): void {
    this.register(new ExampleVenueAdapter());
  }

  /**
   * Register an adapter instance
   */
  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.meta.adapterName, adapter);
  }

  /**
   * Get adapter by name
   */
  get(adapterName: string): BaseAdapter | undefined {
    return this.adapters.get(adapterName);
  }

  /**
   * Get all registered adapters
   */
  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get adapters by refresh group
   */
  getByGroup(group: 0 | 1 | 2 | 3): BaseAdapter[] {
    return this.getAll().filter((adapter) => adapter.meta.refreshGroup === group);
  }

  /**
   * Check if adapter exists
   */
  has(adapterName: string): boolean {
    return this.adapters.has(adapterName);
  }

  /**
   * List all adapter names
   */
  listNames(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Singleton instance
export const adapterRegistry = new AdapterRegistry();
