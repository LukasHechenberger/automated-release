#!/usr/bin/env node

import { log, colors } from 'gulp-util';
import AutomatedRelease from '../index';

(new AutomatedRelease(process.argv.slice(2)))
  .launch()
  .catch(err => {
    log.warn(colors.red(`${err.constructor.name}: ${err.message}`));
    process.exit(1);
  });
