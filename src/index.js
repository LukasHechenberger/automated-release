import { join } from 'path';
import { readFile } from 'fs';
import yargs from 'yargs';
import axios from 'axios';
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

  getDistTags(packageName) {
    if (!packageName || packageName === '') {
      return Promise.reject('Invalid package name');
    }

    return axios.get(`http://registry.npmjs.org/-/package/${packageName}/dist-tags`)
      .catch(err => {
        throw new Error(`Unable to get package dist tags: ${err.message}`);
      });
  }

  isPublished(packageName) {
    return this.getDistTags(packageName)
      .then(() => true)
      .catch(err => {
        if (err.message.match(/Unable to get package dist tags/)) {
          return false;
        }

        throw err;
      });
  }

  shouldRelease() {
    return Promise.all([
      this.isPublished(this.package.name),
    ])
      .then(results => results.reduce((a, b) => {
        if (!b) {
          return false;
        }

        return a;
      }, true));
  }

  release() {
    return tasks.release(Object.assign(this.options, {
      package: this.package,
    }));
  }

  autorelease() {
    return this.shouldRelease()
      .then(shouldRelease => {
        if (shouldRelease) {
          return this.release();
        }

        return false;
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
