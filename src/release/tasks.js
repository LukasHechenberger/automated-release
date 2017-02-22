import { execFile } from 'child_process';
import { src, dest } from 'gulp';
import conventionalChangelog from 'gulp-conventional-changelog';
import conventionalGithubReleaser from 'conventional-github-releaser';
import streamToPromise from 'stream-to-promise';
import git from 'gulp-git';
import { head as get } from 'axios';
import { log, colors } from 'gulp-util';

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

function changelog(branch) {
  log('Creating changelog');

  return streamToPromise(
    src('./CHANGELOG.md', { buffer: false })
      .pipe(conventionalChangelog({
        preset: 'angular', // Or to any other commit message convention you use.
      }))
      .pipe(dest('./'))
  )
    .then(() => commitFiles('./CHANGELOG.md', 'Update changelog [ci skip]'))
    .then(() => push(branch));
}

export function createNewTag(version) {
  return new Promise((resolve, reject) => {
    const tag = version;

    log(`Creating tag ${tag}`);

    git.tag(tag, `Add tag ${tag} [ci skip]`, { quiet: true }, err => {
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

function runNpm(args) {
  return new Promise((resolve, reject) => {
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
    .then(() => changelog(branch))
    .then(() => add(options.addFiles, true))
    .then(() => checkout('HEAD'))
    .then(() => commitFiles('.', `Version ${options.package.version} for distribution [ci skip]`))
    .then(() => createNewTag(options.package.version))
    .then(() => checkout(branch))
    .then(() => push(branch, true))
    .then(() => {
      if (branch === 'master') {
        return githubRelease(options.githubToken);
      }

      log(colors.grey(`Branch is ${branch}: Skipping GitHub release`));
      return false;
    })
    .then(() => {
      log('Running npm publish');
      // TODO: Make optional
      let args = ['publish', '--access', 'public'];

      if (branch !== 'master') {
        log(colors.grey('Publishing with tag', branch));
        args = args.concat(['--tag', branch]);
      }

      return runNpm(args);
    })
    .then(() => log('Done'));
}
