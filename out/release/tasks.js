'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createNewTag = createNewTag;
exports.release = release;

var _child_process = require('child_process');

var _gulp = require('gulp');

var _gulpConventionalChangelog = require('gulp-conventional-changelog');

var _gulpConventionalChangelog2 = _interopRequireDefault(_gulpConventionalChangelog);

var _conventionalGithubReleaser = require('conventional-github-releaser');

var _conventionalGithubReleaser2 = _interopRequireDefault(_conventionalGithubReleaser);

var _streamToPromise = require('stream-to-promise');

var _streamToPromise2 = _interopRequireDefault(_streamToPromise);

var _gulpGit = require('gulp-git');

var _gulpGit2 = _interopRequireDefault(_gulpGit);

var _gulpUtil = require('gulp-util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function push(branch, tags) {
  (0, _gulpUtil.log)('Running git push');
  const args = tags ? '--tags' : '';

  return new Promise((resolve, reject) => {
    _gulpGit2.default.push('origin', branch, { args, quiet: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function commitFiles(files, message) {
  (0, _gulpUtil.log)(`Committing ${files}: ${message}`);

  return (0, _streamToPromise2.default)((0, _gulp.src)(files).pipe(_gulpGit2.default.add({ quiet: true })).pipe(_gulpGit2.default.commit(message, { quiet: true })));
}

function changelog() {
  (0, _gulpUtil.log)('Creating changelog');

  return (0, _streamToPromise2.default)((0, _gulp.src)('./CHANGELOG.md', { buffer: false }).pipe((0, _gulpConventionalChangelog2.default)({
    preset: 'angular' })).pipe((0, _gulp.dest)('./'))).then(() => commitFiles('./CHANGELOG.md', 'Update changelog [ci skip]')).then(() => push());
}

function createNewTag(version) {
  return new Promise((resolve, reject) => {
    const tag = version;

    (0, _gulpUtil.log)(`Creating tag ${tag}`);

    _gulpGit2.default.tag(tag, `[Prerelease] Add tag ${tag}`, { quiet: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve(tag);
      }
    });
  });
}

function checkStatus() {
  (0, _gulpUtil.log)('Checking status');

  return new Promise((resolve, reject) => {
    _gulpGit2.default.status({ quiet: true }, (err, out) => {
      if (err) {
        reject(err);
      } else if (out.match(/working tree clean/)) {
        resolve();
      } else {
        reject(new Error('There are uncommitted changes'));
      }
    });
  });
}

function add(files, force) {
  (0, _gulpUtil.log)('Adding', files);

  const args = force ? '-f' : '';

  return (0, _streamToPromise2.default)((0, _gulp.src)(files).pipe(_gulpGit2.default.add({ args, quiet: true })));
}

function getBranch() {
  return new Promise((resolve, reject) => {
    _gulpGit2.default.revParse({ args: '--abbrev-ref HEAD', quiet: true }, (err, out) => {
      if (err) {
        reject(err);
      } else {
        resolve(out);
      }
    });
  });
}

function checkout(branch) {
  (0, _gulpUtil.log)(`Checkout to ${branch} branch`);

  return new Promise((resolve, reject) => {
    _gulpGit2.default.checkout(branch, { quiet: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
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

function runNpm(args) {
  return new Promise((resolve, reject) => {
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

function release(options) {
  let branch;

  return checkStatus().then(() => new Promise((resolve, reject) => {
    (0, _gulpUtil.log)('check tag');

    _gulpGit2.default.revParse({ args: `v${options.package.version}`, quiet: true }, err => {
      if (err) {
        resolve();
      } else {
        reject(new Error('Tag already exists'));
      }
    });
  })).then(() => getBranch()).then(b => branch = b).then(() => changelog()).then(() => runNpm(['run', 'prepublish'])).then(() => add(options.addFiles, true)).then(() => checkout('HEAD')).then(() => commitFiles('.', `Version ${options.package.version} for distribution`)).then(() => createNewTag(options.package.version)).then(() => checkout(branch)).then(() => push(branch, true)).then(() => {
    if (branch === 'master') {
      return githubRelease(options.githubToken);
    }

    (0, _gulpUtil.log)(_gulpUtil.colors.grey(`Branch is ${branch}: Skipping GitHub release`));
    return false;
  }).then(() => {
    let args = ['publish'];

    if (branch !== 'master') {
      (0, _gulpUtil.log)(_gulpUtil.colors.grey('Publishing with tag', branch));
      args = args.concat(['--tag', branch]);
    }

    return runNpm(args);
  });
}