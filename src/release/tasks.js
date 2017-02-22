import { execFile } from 'child_process';
import { src, dest } from 'gulp';
import conventionalChangelog from 'gulp-conventional-changelog';
import conventionalGithubReleaser from 'conventional-github-releaser';
import streamToPromise from 'stream-to-promise';
import { head as get } from 'axios';
import { log, colors } from 'gulp-util';

export function runNpm(args) {
  return new Promise((resolve, reject) => {
    log(colors.grey('> npm', args.join(' ')));

    execFile('npm', args, (error, stdout) => {
      if (error) {
        log(colors.yellow(stdout));
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

export function runGit(args) {
  return new Promise((resolve, reject) => {
    log(colors.grey('> git', args.join(' ')));

    execFile('git', args, (error, stdout) => {
      if (error) {
        log(colors.yellow(stdout));
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
  log('Creating changelog');

  return streamToPromise(
    src('./CHANGELOG.md', { buffer: false })
      .pipe(conventionalChangelog({
        preset: 'angular', // Or to any other commit message convention you use.
      }))
      .pipe(dest('./'))
  )
    .then(() => add(['CHANGELOG.md']))
    .then(() => commit('Update changelog [ci skip]')
    .then(() => push()));
}

function checkStatus() {
  log('Checking status');

  return runGit(['status'])
    .then(out => {
      if (!(out.match(/working tree clean/))) {
        throw new Error('There are uncommitted changes');
      }
    });
}

function getBranch() {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD'])
    .then(out => out.trim());
}

function githubRelease(token) {
  log('Creating GitHub release');

  return new Promise((resolve, reject) => {
    conventionalGithubReleaser({
      type: 'oauth',
      token,
    }, {
      preset: 'angular',
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
  log('Running npm publish');
  // TODO: Make optional
  let args = ['publish', '--access', 'public'];

  if (branch !== 'master') {
    log(colors.grey('Publishing with tag', branch));
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

  return get(`${repoUrl}/releases/tag/${options.package.version}`)
    .then(() => {
      throw new Error('Tag already exists');
    }, err => {
      if (err.response.status === 404) {
        return true;
      }

      throw err;
    });
}

export function release(options) {
  let branch;

  return checkStatus()
    .then(() => checkIfTagExists(options))
    .then(() => getBranch())
    .then(b => log('On', (branch = b), 'branch'))
    .then(() => changelog())
    .then(() => runNpm(['run', 'prepublish']))
    .then(() => add(options.addFiles, true)
    .then(() => checkout('HEAD'))
    .then(() => commit(`Version ${options.package.version} for release [ci skip]`)))
    .then(() => runGit(['tag', '-a', options.package.version,
      '-m', `Add tag ${options.package.version} [ci skip]`]))
    .then(() => checkout(branch))
    .then(() => push(true))
    .then(() => {
      if (branch === 'master') {
        return githubRelease(options.githubToken);
      }

      log(colors.grey(`On ${branch} branch: Skipping GitHub release`));
      return false;
    })
    .then(() => npmPublish(branch));
}
