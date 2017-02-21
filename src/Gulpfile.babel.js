import { src, dest, series } from 'gulp';
import conventionalChangelog from 'gulp-conventional-changelog';
import conventionalGithubReleaser from 'conventional-github-releaser';
import bump from 'gulp-bump';
import git from 'gulp-git';
import { log } from 'gulp-util';
import debug from 'gulp-debug';

export function bumpVersion() {
  return src('./*(bower|package).json')
    .pipe(debug())
    .pipe(bump({ type: 'patch' }).on('error', log))
    .pipe(dest('./'));
}

export function changelog() {
  return src('./CHANGELOG.md', {
    buffer: false
  })
    .pipe(conventionalChangelog({
      preset: 'angular' // Or to any other commit message convention you use.
    }))
    .pipe(debug())
    // .pipe(dest('./'));
}

export function commitChanges() {
  return src('.')
    .pipe(git.add())
    .pipe(git.commit('[Prerelease] Bumped version number'))
}

export function pushChanges(cb) {
  console.log("git.push('origin', 'master', cb);");
  cb();
}

export function getPackageJsonVersion () {
  return new Promise((resolve, reject) => {
    fs.readFile('./package.json', 'utf8', (err, results) => {
      if (err) {
        reject(err);
      } else {
        try {
          resolve(JSON.parse(results).version);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

export function createNewTag(version) {
  return new Promise((resolve, reject) => {
    const tag = `v${version}`;

    git.tag(version, `Created Tag for version: ${version}`, err => {
      if (err) {
        reject(err);
      } else {
        resolve(tag);
      }
    });
  });
}

export function gitPush(tags) {
  return new Promise((resolve, reject) => {
    console.log('Run git push origin master', (tags ? '--tags' : ''));
    resolve();
  });
}

export function createReleaseTag() {
  return getPackageJsonVersion()
    .then(createNewTag)
    .then(() => gitPush(true))
}

export const release = series(
  bumpVersion,
  changelog,
  commitChanges,
  pushChanges,
  createNewTag,
  cb => cb(console.log('Now, create new github release'))
);

export function checkStatus(cb) {
  git.status({ quiet: true }, (err, out) => {
    if (err) {
      cb(err);
    } else if (out.match(/working tree clean/)) {
      cb();
    } else {
      cb(new Error('There are uncommitted changes'));
    }
  });
}
