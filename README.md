# gulp-pre-proc

[![npm](https://img.shields.io/npm/v/gulp-pre-proc.svg)](https://www.npmjs.com/package/gulp-pre-proc) [![GitHub issues](https://img.shields.io/github/issues/anseki/gulp-pre-proc.svg)](https://github.com/anseki/gulp-pre-proc/issues) [![David](https://img.shields.io/david/anseki/gulp-pre-proc.svg)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

This [gulp](http://gulpjs.com/) plugin is wrapper of [preProc](https://github.com/anseki/pre-proc).

* [Grunt](http://gruntjs.com/) plugin: [grunt-pre-proc](https://github.com/anseki/grunt-pre-proc)
* [webpack](https://webpack.js.org/) loader: [pre-proc-loader](https://github.com/anseki/pre-proc-loader)

The super simple preprocessor for front-end development.  
See [preProc](https://github.com/anseki/pre-proc) for options and more information about preProc.

## Getting Started

```shell
npm install gulp-pre-proc --save-dev
```

## Usage

`gulpfile.js`

```js
var gulp = require('gulp'),
  preProc = require('gulp-pre-proc');

gulp.task('default', function() {
  return gulp.src('./develop/**/*')
    .pipe(preProc({
        // Remove `DEBUG` contents from all files in `dir1` directory and all JS files.
        removeTag: {tag: 'DEBUG', pathTest: ['/path/to/dir1', /\.js$/]}
      }))
    .pipe(gulp.dest('./public_html/'));
});
```

## Options

### `removeTag`

If `removeTag` option is specified, call [`removeTag`](https://github.com/anseki/pre-proc#removetag) method with current content.

You can specify an object that has properties as arguments of the method.  
Following properties are accepted:

- `tag`
- `pathTest`

Also, you can specify common values for the arguments into upper layer. That is, the `options.pathTest` is used when `options.removeTag.pathTest` is not specified.

If the `pathTest` is specified, current source file path is tested with the `pathTest`.

For example:

```js
gulp.task('default', function() {
  return gulp.src('./develop/**/*')
    .pipe(preProc({
        tag: 'DEBUG',           // common
        pathTest: '/path/to',   // common

        removeTag: {},                            // tag: 'DEBUG', pathTest: '/path/to'
        replaceTag: {tag: ['SPEC1', 'SPEC2']},    // tag: ['SPEC1', 'SPEC2'], pathTest: '/path/to'
        pickTag: {}                               // tag: 'DEBUG', pathTest: '/path/to'
      }))
    .pipe(gulp.dest('./public_html/'));
});
```

### `replaceTag`

If `replaceTag` option is specified, call [`replaceTag`](https://github.com/anseki/pre-proc#replacetag) method with current content.

You can specify arguments by the same way as the [`removeTag`](#removetag).  
Following arguments are accepted:

- `tag`
- `pathTest`
- `replacement` (As `options.replaceTag.replacement`, not `options.replacement`)

### `pickTag`

If `pickTag` option is specified, call [`pickTag`](https://github.com/anseki/pre-proc#picktag) method with current content.

You can specify arguments by the same way as the [`removeTag`](#removetag).  
Following arguments are accepted:

- `tag`
- `allowErrors` (As `options.pickTag.allowErrors`, not `options.allowErrors`)

When the tag was not found, this method throws an error by default. If `true` is specified for `allowErrors`, it returns `null` (not a string) without error. It is useful for handling unknown source code. (You should check that by `file.isNull()`.)  
Also, you can specify options to call multiple methods, and other methods are not called when the tag was not found.
