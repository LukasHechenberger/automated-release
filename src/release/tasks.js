import { src, dest, series } from 'gulp';
import conventionalChangelog from 'gulp-conventional-changelog';
import conventionalGithubReleaser from 'conventional-github-releaser';
import streamToPromise from 'stream-to-promise';
import git from 'gulp-git';
import { log } from 'gulp-util';

function push(branch, tags) {
  log('Running git push');
  const args = tags ? '--tags' : '';

  return new Promise((resolve, reject) => {
    git.push('origin', branch, { args, quiet: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function commitFiles(files, message) {
  log(`Committing ${files}: ${message}`);

  return streamToPromise(
    src(files)
      .pipe(git.add({ quiet: true }))
      .pipe(git.commit(message, { quiet: true }))
  );
}

function changelog() {
  log('Creating changelog');

  return streamToPromise(
    src('./CHANGELOG.md', { buffer: false })
      .pipe(conventionalChangelog({
        preset: 'angular', // Or to any other commit message convention you use.
      }))
      .pipe(dest('./'))
  )
    .then(() => commitFiles('./CHANGELOG.md', 'Update changelog'))
    .then(() => push());
}

export function createNewTag(version) {
  return new Promise((resolve, reject) => {
    const tag = version;

    log(`Creating tag ${tag}`);

    git.tag(tag, `[Prerelease] Add tag ${tag}`, { quiet: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve(tag);
      }
    });
  });
}

function checkStatus() {
  log('Checking status');

  return new Promise((resolve, reject) => {
    git.status({ quiet: true }, (err, out) => {
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
  log('Adding', files);

  const args = force ? '-f' : '';

  return streamToPromise(
    src(files)
      .pipe(git.add({ args, quiet: true }))
  );
}

function getBranch() {
  return new Promise((resolve, reject) => {
    git.revParse({ args: '--abbrev-ref HEAD', quiet: true }, (err, out) => {
      if (err) {
        reject(err);
      } else {
        resolve(out);
      }
    });
  });
}

function checkout(branch) {
  log(`Checkout to ${branch} branch`);

  return new Promise((resolve, reject) => {
    git.checkout(branch, { quiet: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function githubRelease(branch, token) {
  log('Creating GitHub release');

  return new Promise((resolve, reject) => {
    conventionalGithubReleaser({
      type: 'oauth',
      token,
    }, {
      preset: 'angular',
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        console.log(data);
        resolve();
      }
    });
  });
}

export function release(options) {
  let branch;

  return checkStatus()
    .then(() => new Promise((resolve, reject) => {
      log('check tag');

      git.revParse({ args: `v${options.package.version}`, quiet: true }, err => {
        if (err) {
          resolve();
        } else {
          reject(new Error('Tag already exists'));
        }
      });
    }))
    .then(() => getBranch())
    .then(b => (branch = b))
    .then(() => changelog())
    .then(() => add(options.addFiles, true))
    .then(() => checkout('head'))
    .then(() => commitFiles('.', `Version ${options.package.version} for distribution`))
    .then(() => createNewTag(options.package.version))
    .then(() => checkout(branch))
    .then(() => push(branch, true))
    .then(() => githubRelease(branch, options.githubToken))
    .then(() => console.log('Publish for branch', branch));
}
