'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Command = undefined;

var _path = require('path');

var _fs = require('fs');

var _yargs = require('yargs');

var _yargs2 = _interopRequireDefault(_yargs);

var _gulpUtil = require('gulp-util');

var _tasks = require('./release/tasks');

var tasks = _interopRequireWildcard(_tasks);

var _options = require('./cli/options');

var _options2 = _interopRequireDefault(_options);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Command = exports.Command = {
  Release: 'Release',
  Autorelease: 'Autorelease'
};

class AutomatedRelease {

  static get defaultOptions() {
    return {
      addFiles: ['out', 'docs/api']
    };
  }

  constructor(args) {
    this.command = Command.Autorelease;
    const cliOptions = (0, _yargs2.default)(args).env('RELEASE').command('release', 'Release a new version', {}, () => this.command = Command.Release).command('autorelease', '(default) Release a new version if package version changed', {}, () => this.command = Command.Autorelease).options(_options2.default).global(Object.keys(_options2.default)).help('help').argv;

    this.options = Object.assign({}, AutomatedRelease.defaultOptions, cliOptions);
  }

  getPackageJson() {
    const path = (0, _path.join)(process.cwd(), 'package.json');

    return new Promise((resolve, reject) => {
      (0, _fs.readFile)(path, 'utf8', (err, results) => {
        if (err) {
          reject(`Unable to read ${path}: ${err.message}`);
        } else {
          try {
            resolve(this.package = JSON.parse(results));
          } catch (e) {
            reject(`Unable to parse package.json ${e.message}`);
          }
        }
      });
    });
  }

  release() {
    return tasks.release(Object.assign(this.options, {
      package: this.package
    }));
  }

  autorelease() {
    return this.release().catch(err => {
      if (err.message.match(/tag already exists/i)) {
        (0, _gulpUtil.log)('Tag already exits: Skipping release');
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
    return this.getPackageJson().then(() => this.runCommand());
  }

}
exports.default = AutomatedRelease;