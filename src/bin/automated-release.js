#!/usr/bin/env node

import { log, colors } from 'gulp-util';
import AutomatedRelease from '../index';

(new AutomatedRelease(process.argv.slice(2)))
  .launch()
  .catch(err => {
    log(colors.red(`${err.constructor.name}: ${err}`));
    log(colors.grey(err.stack));

    process.exit(1);
  });
