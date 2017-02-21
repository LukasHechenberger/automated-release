import { execFile } from 'child_process';
import { src, dest } from 'gulp';
import conventionalChangelog from 'gulp-conventional-changelog';
import conventionalGithubReleaser from 'conventional-github-releaser';
import streamToPromise from 'stream-to-promise';
import git from 'gulp-git';
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

function changelog() {
  log('Creating changelog');

  return streamToPromise(
    src('./CHANGELOG.md', { buffer: false })
      .pipe(conventionalChangelog({
        preset: 'angular', // Or to any other commit message convention you use.
      }))
      .pipe(dest('./'))
  )
    .then(() => commitFiles('./CHANGELOG.md', 'Update changelog [ci skip]'))
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
    git.checkout(branch, { args: '-b', quiet: true }, err => {
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
    .then(() => runNpm(['run', 'prepublish']))
    .then(() => add(options.addFiles, true))
    .then(() => checkout('release'))
    .then(() => commitFiles('.', `Version ${options.package.version} for distribution`))
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
      // TODO: Make optional
      let args = ['publish', '--access', 'public'];

      if (branch !== 'master') {
        log(colors.grey('Publishing with tag', branch));
        args = args.concat(['--tag', branch]);
      }

      return runNpm(args);
    });
}
