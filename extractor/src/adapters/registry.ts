import type { BaseAdapter } from './base.js';
import { ExampleVenueAdapter } from './exampleVenue.adapter.js';
import { LeSucreAdapter } from './leSucre.adapter.js';
import { LeTransbordeurAdapter } from './leTransbordeur.adapter.js';
import { GrrrndZeroAdapter } from './grrrndZero.adapter.js';
import { AuditoriumLyonAdapter } from './auditoriumLyon.adapter.js';
import { HalleTonyGarnierAdapter } from './halleTonyGarnier.adapter.js';
import { LdlcArenaAdapter } from './ldlcArena.adapter.js';
import { LePetitSalonAdapter } from './lePetitSalon.adapter.js';

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
    this.register(new LeSucreAdapter());
    this.register(new LeTransbordeurAdapter());
    this.register(new GrrrndZeroAdapter());
    this.register(new AuditoriumLyonAdapter());
    this.register(new HalleTonyGarnierAdapter());
    this.register(new LdlcArenaAdapter());
    this.register(new LePetitSalonAdapter());
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
