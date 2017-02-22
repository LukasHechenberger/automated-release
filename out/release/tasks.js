'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.runNpm = runNpm;
exports.runGit = runGit;
exports.release = release;

var _child_process = require('child_process');

var _gulp = require('gulp');

var _gulpConventionalChangelog = require('gulp-conventional-changelog');

var _gulpConventionalChangelog2 = _interopRequireDefault(_gulpConventionalChangelog);

var _conventionalGithubReleaser = require('conventional-github-releaser');

var _conventionalGithubReleaser2 = _interopRequireDefault(_conventionalGithubReleaser);

var _streamToPromise = require('stream-to-promise');

var _streamToPromise2 = _interopRequireDefault(_streamToPromise);

var _axios = require('axios');

var _gulpUtil = require('gulp-util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function runNpm(args) {
  return new Promise((resolve, reject) => {
    (0, _gulpUtil.log)(_gulpUtil.colors.grey('> npm', args.join(' ')));

    (0, _child_process.execFile)('npm', args, (error, stdout) => {
      if (error) {
        (0, _gulpUtil.log)(_gulpUtil.colors.yellow(stdout));
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    (0, _gulpUtil.log)(_gulpUtil.colors.grey('> git', args.join(' ')));

    (0, _child_process.execFile)('git', args, (error, stdout) => {
      if (error) {
        (0, _gulpUtil.log)(_gulpUtil.colors.yellow(stdout));
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function add(files, force) {
  const args = ['add'].concat(files);

  return runGit(force ? args.concat('-f') : args);
}

function commit(message) {
  return runGit(['commit', '-m', message]);
}

function push(tags) {
  const args = ['push'];

  return runGit(tags ? args.concat(['--tags']) : args);
}

function checkout(branch) {
  return runGit(['checkout', branch]);
}

function changelog() {
  (0, _gulpUtil.log)('Creating changelog');

  return (0, _streamToPromise2.default)((0, _gulp.src)('./CHANGELOG.md', { buffer: false }).pipe((0, _gulpConventionalChangelog2.default)({
    preset: 'angular' })).pipe((0, _gulp.dest)('./'))).then(() => add(['CHANGELOG.md'])).then(() => commit('Update changelog [ci skip]').then(() => push()));
}

function checkStatus() {
  (0, _gulpUtil.log)('Checking status');

  return runGit(['status']).then(out => {
    if (!out.match(/working tree clean/)) {
      throw new Error('There are uncommitted changes');
    }
  });
}

function getBranch() {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD']).then(out => out.trim());
}

function githubRelease(token) {
  (0, _gulpUtil.log)('Creating GitHub release');

  return new Promise((resolve, reject) => {
    (0, _conventionalGithubReleaser2.default)({
      type: 'oauth',
      token
    }, {
      preset: 'angular'
    }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function npmPublish(branch) {
  (0, _gulpUtil.log)('Running npm publish');
  // TODO: Make optional
  let args = ['publish', '--access', 'public'];

  if (branch !== 'master') {
    (0, _gulpUtil.log)(_gulpUtil.colors.grey('Publishing with tag', branch));
    args = args.concat(['--tag', branch]);
  }

  return runNpm(args);
}

function checkIfTagExists(options) {
  let repoUrl;

  try {
    repoUrl = options.package.repository.url.match(/(https:.*)\.git/)[1];
  } catch (e) {
    return Promise.reject(new Error(`Unable to get repository URL: ${e.message}`));
  }

  return (0, _axios.head)(`${repoUrl}/releases/tag/${options.package.version}`).then(() => {
    throw new Error('Tag already exists');
  }, err => {
    if (err.response.status === 404) {
      return true;
    }

    throw err;
  });
}

function release(options) {
  let branch;

  return checkStatus().then(() => checkIfTagExists(options)).then(() => getBranch()).then(b => (0, _gulpUtil.log)('On', branch = b, 'branch')).then(() => changelog()).then(() => add(options.addFiles, true).then(() => checkout('HEAD')).then(() => commit(`"Version ${options.package.version} for release [ci skip]"`))).then(() => runGit(['tag', '-a', options.package.version, '-m', `"Add tag ${options.package.version} [ci skip]"`])).then(() => checkout(branch)).then(() => push(true)).then(() => {
    if (branch === 'master') {
      return githubRelease(options.githubToken);
    }

    (0, _gulpUtil.log)(_gulpUtil.colors.grey(`On ${branch} branch: Skipping GitHub release`));
    return false;
  }).then(() => npmPublish(branch));
}