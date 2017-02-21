import { join } from 'path';
import { readFile } from 'fs';
import yargs from 'yargs';
import axios from 'axios';
import * as tasks from './tasks';

export default class AutomatedRelease {

  constructor(args) {
    const options = yargs(args);


  }

  getPackageJson() {
    const path = join(process.cwd(), 'package.json');

    return new Promise((resolve, reject) => {
      readFile(path, 'utf8', (err, results) => {
        if (err) {
          reject(`Unable to read ${path}: ${err.message}`);
        } else {
          try {
            resolve(JSON.parse(results));
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
      })
  }

  isPublished(packageName) {
    return this.getDistTags(packageName)
      .then(() => true)
      .catch(err => {
        if (err.message.match(/Unable to get package dist tags/)) {
          return false;
        } else {
          throw err;
        }
      })
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
    return tasks.release({
      package: this.package,
    });
  }

  autorelease() {
    return this.shouldRelease()
      .then(shouldRelease => {
        console.log('Should release:', shouldRelease);
        if (true || shouldRelease) {
          return this.release();
        }

        console.log('Not releasing');
      });
  }

  launch() {
    return this.getPackageJson()
      .then(pkg => this.package = pkg)
      .then(() => this.autorelease());
      /* .then(() => this.getDistTags(this.package.name))
      .then(() => console.log(this.package)); */
  }

}
