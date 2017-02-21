import { join } from 'path';
import { readFile } from 'fs';
import yargs from 'yargs';
import axios from 'axios';
import { log } from 'gulp-util';
import * as tasks from './release/tasks';
import options from './cli/options';

export const Command = {
  Release: 'Release',
  Autorelease: 'Autorelease',
};

export default class AutomatedRelease {

  static get defaultOptions() {
    return {
      addFiles: ['out', 'docs/api'],
    };
  }

  constructor(args) {
    this.command = Command.Autorelease;
    const cliOptions = yargs(args)
      .env('RELEASE')
      .command('release', 'Release a new version', {}, () => (this.command = Command.Release))
      .command('autorelease', '(default) Release a new version if package version changed',
        {}, () => (this.command = Command.Autorelease))
      .options(options)
      .global(Object.keys(options))
      .help('help')
      .argv;

    this.options = Object.assign({}, AutomatedRelease.defaultOptions, cliOptions);
  }

  getPackageJson() {
    const path = join(process.cwd(), 'package.json');

    return new Promise((resolve, reject) => {
      readFile(path, 'utf8', (err, results) => {
        if (err) {
          reject(`Unable to read ${path}: ${err.message}`);
        } else {
          try {
            resolve((this.package = JSON.parse(results)));
          } catch (e) {
            reject(`Unable to parse package.json ${e.message}`);
          }
        }
      });
    });
  }

  release() {
    return tasks.release(Object.assign(this.options, {
      package: this.package,
    }));
  }

  autorelease() {
    return this.release()
      .catch(err => {
        if (err.message.match(/tag exists/i)) {
          log('Tag already exits: Skipping');
        } else {
          throw err;
        }
      });
  }

  runCommand() {
    if (this.command === Command.Release) {
      return this.release();
    }

    return this.autorelease();
  }

  launch() {
    return this.getPackageJson()
      .then(() => this.runCommand());
  }

}
