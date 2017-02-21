#!/usr/bin/env node
import colors from 'chalk';
import AutomatedRelease from '../index';

(new AutomatedRelease(process.argv.slice(2)))
  .launch()
  .catch(err => {
    console.error(colors.red(`${err.constructor.name}: ${err.message}`));
    process.exit(1);
  });
