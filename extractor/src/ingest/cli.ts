#!/usr/bin/env node

import { Command } from 'commander';
import { runSource, runGroup } from './runner.js';

const program = new Command();

program
  .name('events-aggregator')
  .description('Events aggregator ingestion CLI')
  .version('0.1.0');

program
  .command('run-source <adapterName>')
  .description('Run ingestion for a specific adapter')
  .action(async (adapterName: string) => {
    try {
      await runSource(adapterName);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('run-group <group>')
  .description('Run ingestion for all adapters in a refresh group (0-3)')
  .action(async (groupStr: string) => {
    const group = parseInt(groupStr, 10);

    if (![0, 1, 2, 3].includes(group)) {
      console.error('Error: Group must be 0, 1, 2, or 3');
      process.exit(1);
    }

    try {
      await runGroup(group as 0 | 1 | 2 | 3);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
