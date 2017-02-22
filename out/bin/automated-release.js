#!/usr/bin/env node
'use strict';

var _gulpUtil = require('gulp-util');

var _index = require('../index');

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

new _index2.default(process.argv.slice(2)).launch().catch(err => {
  (0, _gulpUtil.log)(_gulpUtil.colors.red(`${err.constructor.name}: ${err}`));
  (0, _gulpUtil.log)(_gulpUtil.colors.grey(err.stack));

  process.exit(1);
});