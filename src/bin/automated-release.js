#!/usr/bin/env node
import colors from 'chalk';
import { log } from 'gulp-util';
import AutomatedRelease from '../index';

(new AutomatedRelease(process.argv.slice(2)))
  .launch()
  .catch(err => {
    log.warn(log.colors.red(`${err.constructor.name}: ${err.message}`));
    process.exit(1);
  });
