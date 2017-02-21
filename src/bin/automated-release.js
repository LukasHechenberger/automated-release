#!/usr/bin/env node
import AutomatedRelease from '../index';

(new AutomatedRelease(process.argv.slice(2)))
  .launch()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
