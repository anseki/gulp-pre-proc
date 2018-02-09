'use strict';

var PluginError = require('plugin-error'),
  through = require('through2'),
  preProc = require('pre-proc');

module.exports = function(options) {
  return through.obj(function(file, encoding, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }
    if (file.isStream()) {
      return callback(new PluginError('gulp-pre-proc', 'Streaming not supported'));
    }

    var content = file.contents.toString(),
      srcPath = file.path,
      pathTest;

    // pickTag
    if (options.pickTag) {
      content = preProc.pickTag(options.pickTag.tag || options.tag, content);
    }

    // replaceTag
    if (options.replaceTag) {
      pathTest = options.replaceTag.pathTest || options.pathTest;
      content = preProc.replaceTag(options.replaceTag.tag || options.tag,
        options.replaceTag.replacement, content, pathTest ? srcPath : null, pathTest);
    }

    // removeTag
    if (options.removeTag) {
      pathTest = options.removeTag.pathTest || options.pathTest;
      content = preProc.removeTag(options.removeTag.tag || options.tag,
        content, pathTest ? srcPath : null, pathTest);
    }

    // Check `allocUnsafe` to make sure of the new API.
    file.contents = Buffer.allocUnsafe && Buffer.from ? Buffer.from(content) : new Buffer(content);
    callback(null, file);
  });
};
