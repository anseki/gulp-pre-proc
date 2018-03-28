'use strict';

let pickTagRturnsNull;
const expect = require('chai').expect,
  sinon = require('sinon'),
  File = require('vinyl'),
  proxyquire = require('proxyquire').noPreserveCache(),
  preProc = {
    replaceTag: sinon.spy((tag, replacement, content) => `${content}<replaceTag>`),
    removeTag: sinon.spy((tag, content) => `${content}<removeTag>`),
    pickTag: sinon.spy((tag, content) => (pickTagRturnsNull ? null : `${content}<pickTag>`))
  },
  plugin = proxyquire('../', {
    'pre-proc': preProc,
    'fancy-log': {error: () => {}, warn: () => {}, info: () => {}, dir: () => {}}
  });

function resetAll() {
  preProc.replaceTag.resetHistory();
  preProc.removeTag.resetHistory();
  preProc.pickTag.resetHistory();
}

function newFile(content, path) {
  return new File({
    // Check `allocUnsafe` to make sure of the new API.
    contents: Buffer.allocUnsafe && Buffer.from ? Buffer.from(content) : new Buffer(content),
    path
  });
}

describe('implements a basic flow as buffer based plugin', () => {

  it('should skip process if contents is null', done => {
    resetAll();
    const pluginStream = plugin({replaceTag: {}}), // Dummy option
      passedFile = new File();
    expect(passedFile.isNull()).to.be.true;
    expect(passedFile.isStream()).to.be.false;
    expect(passedFile.isBuffer()).to.be.false;

    pluginStream.write(passedFile);
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.true;
      expect(file.isStream()).to.be.false;
      expect(file.isBuffer()).to.be.false;
      expect(preProc.replaceTag.notCalled).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(preProc.pickTag.notCalled).to.be.true;

      done();
    });
  });

  it('should throw an error if contents is a Stream', () => {
    resetAll();
    const stream = require('stream'),
      es = require('event-stream'),
      pluginStream = plugin({replaceTag: {}}), // Dummy option
      passedFile = new File({
        contents: new stream.Readable({objectMode: true})
          .wrap(es.readArray(['stream', 'with', 'those', 'contents']))
      });
    expect(passedFile.isNull()).to.be.false;
    expect(passedFile.isStream()).to.be.true;
    expect(passedFile.isBuffer()).to.be.false;

    expect(() => { pluginStream.write(passedFile); }).to.throw('Streaming not supported');
    expect(preProc.replaceTag.notCalled).to.be.true;
    expect(preProc.removeTag.notCalled).to.be.true;
    expect(preProc.pickTag.notCalled).to.be.true;
  });

  it('should accept contents if it is a Buffer', done => {
    resetAll();
    const pluginStream = plugin({replaceTag: {}}),
      passedFile = newFile('content');
    expect(passedFile.isNull()).to.be.false;
    expect(passedFile.isStream()).to.be.false;
    expect(passedFile.isBuffer()).to.be.true;

    pluginStream.write(passedFile);
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.false;
      expect(file.isStream()).to.be.false;
      expect(file.isBuffer()).to.be.true;
      expect(preProc.replaceTag.calledOnce).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(preProc.pickTag.notCalled).to.be.true;
      expect(file.contents.toString()).to.equal('content<replaceTag>');

      done();
    });
  });

});

describe('when option for each method is passed', () => {

  it('should call only pickTag', done => {
    resetAll();
    const pluginStream = plugin({pickTag: {}});
    pluginStream.write(newFile('content'));
    pluginStream.once('data', () => {
      expect(preProc.replaceTag.notCalled).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(preProc.pickTag.calledOnce).to.be.true;

      done();
    });
  });

  it('should call replaceTag and pickTag', done => {
    resetAll();
    const pluginStream = plugin({replaceTag: {}, pickTag: {}});
    pluginStream.write(newFile('content'));
    pluginStream.once('data', () => {
      expect(preProc.replaceTag.calledOnce).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(preProc.pickTag.calledOnce).to.be.true;

      done();
    });
  });

});

describe('pickTag()', () => {

  describe('should call the method with preferred tag', () => {
    [
      {
        options: {pickTag: {/* tag: 'SPEC'*/}/* , tag: 'SHARE'*/},
        expectedTag: void 0
      },
      {
        options: {pickTag: {/* tag: 'SPEC'*/}, tag: 'SHARE'},
        expectedTag: 'SHARE'
      },
      {
        options: {pickTag: {tag: 'SPEC'}/* , tag: 'SHARE'*/},
        expectedTag: 'SPEC'
      },
      {
        options: {pickTag: {tag: 'SPEC'}, tag: 'SHARE'},
        expectedTag: 'SPEC'
      }
    ].forEach(test => {
      it(`options.pickTag.tag: ${test.options.pickTag.tag || 'NONE'}` +
          ` / options.tag: ${test.options.tag || 'NONE'}`, done => {
        resetAll();
        const pluginStream = plugin(test.options);
        pluginStream.write(newFile('content'));
        pluginStream.once('data', () => {
          expect(preProc.replaceTag.notCalled).to.be.true;
          expect(preProc.removeTag.notCalled).to.be.true;
          expect(preProc.pickTag.calledOnce).to.be.true;
          expect(preProc.pickTag.calledWithExactly(test.expectedTag, 'content')).to.be.true;

          done();
        });
      });
    });
  });

});

describe('replaceTag()', () => {

  describe('should call the method with preferred tag', () => {
    [
      {
        options: {replaceTag: {/* tag: 'SPEC'*/}/* , tag: 'SHARE'*/},
        expectedTag: void 0
      },
      {
        options: {replaceTag: {/* tag: 'SPEC'*/}, tag: 'SHARE'},
        expectedTag: 'SHARE'
      },
      {
        options: {replaceTag: {tag: 'SPEC'}/* , tag: 'SHARE'*/},
        expectedTag: 'SPEC'
      },
      {
        options: {replaceTag: {tag: 'SPEC'}, tag: 'SHARE'},
        expectedTag: 'SPEC'
      }
    ].forEach(test => {
      it(`options.replaceTag.tag: ${test.options.replaceTag.tag || 'NONE'}` +
          ` / options.tag: ${test.options.tag || 'NONE'}`, done => {
        resetAll();
        test.options.replaceTag.replacement = 'replacement';
        const pluginStream = plugin(test.options);
        pluginStream.write(newFile('content'));
        pluginStream.once('data', () => {
          expect(preProc.replaceTag.calledOnce).to.be.true;
          expect(preProc.removeTag.notCalled).to.be.true;
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.replaceTag.calledWithExactly(test.expectedTag,
            'replacement', 'content', null, void 0)).to.be.true;

          done();
        });
      });
    });
  });

  describe('should call the method with preferred srcPath and pathTest', () => {
    [
      {
        options: {replaceTag: {/* pathTest: 'SPEC'*/}/* , pathTest: 'SHARE'*/},
        expected: {srcPath: null, pathTest: void 0}
      },
      {
        options: {replaceTag: {/* pathTest: 'SPEC'*/}, pathTest: 'SHARE'},
        expected: {srcPath: 'SRCPATH', pathTest: 'SHARE'}
      },
      {
        options: {replaceTag: {pathTest: 'SPEC'}/* , pathTest: 'SHARE'*/},
        expected: {srcPath: 'SRCPATH', pathTest: 'SPEC'}
      },
      {
        options: {replaceTag: {pathTest: 'SPEC'}, pathTest: 'SHARE'},
        expected: {srcPath: 'SRCPATH', pathTest: 'SPEC'}
      }
    ].forEach(test => {
      it(`options.replaceTag.pathTest: ${test.options.replaceTag.pathTest || 'NONE'}` +
          ` / options.pathTest: ${test.options.pathTest || 'NONE'}`, done => {
        resetAll();
        test.options.replaceTag.tag = 'TAG';
        test.options.replaceTag.replacement = 'replacement';
        const pluginStream = plugin(test.options);
        pluginStream.write(newFile('content', 'SRCPATH'));
        pluginStream.once('data', () => {
          expect(preProc.replaceTag.calledOnce).to.be.true;
          expect(preProc.removeTag.notCalled).to.be.true;
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.replaceTag.calledWithExactly('TAG', 'replacement', 'content',
            test.expected.srcPath, test.expected.pathTest)).to.be.true;

          done();
        });
      });
    });
  });

});

describe('removeTag()', () => {

  describe('should call the method with preferred tag', () => {
    [
      {
        options: {removeTag: {/* tag: 'SPEC'*/}/* , tag: 'SHARE'*/},
        expectedTag: void 0
      },
      {
        options: {removeTag: {/* tag: 'SPEC'*/}, tag: 'SHARE'},
        expectedTag: 'SHARE'
      },
      {
        options: {removeTag: {tag: 'SPEC'}/* , tag: 'SHARE'*/},
        expectedTag: 'SPEC'
      },
      {
        options: {removeTag: {tag: 'SPEC'}, tag: 'SHARE'},
        expectedTag: 'SPEC'
      }
    ].forEach(test => {
      it(`options.removeTag.tag: ${test.options.removeTag.tag || 'NONE'}` +
          ` / options.tag: ${test.options.tag || 'NONE'}`, done => {
        resetAll();
        const pluginStream = plugin(test.options);
        pluginStream.write(newFile('content'));
        pluginStream.once('data', () => {
          expect(preProc.replaceTag.notCalled).to.be.true;
          expect(preProc.removeTag.calledOnce).to.be.true;
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.removeTag.calledWithExactly(test.expectedTag,
            'content', null, void 0)).to.be.true;

          done();
        });
      });
    });
  });

  describe('should call the method with preferred srcPath and pathTest', () => {
    [
      {
        options: {removeTag: {/* pathTest: 'SPEC'*/}/* , pathTest: 'SHARE'*/},
        expected: {srcPath: null, pathTest: void 0}
      },
      {
        options: {removeTag: {/* pathTest: 'SPEC'*/}, pathTest: 'SHARE'},
        expected: {srcPath: 'SRCPATH', pathTest: 'SHARE'}
      },
      {
        options: {removeTag: {pathTest: 'SPEC'}/* , pathTest: 'SHARE'*/},
        expected: {srcPath: 'SRCPATH', pathTest: 'SPEC'}
      },
      {
        options: {removeTag: {pathTest: 'SPEC'}, pathTest: 'SHARE'},
        expected: {srcPath: 'SRCPATH', pathTest: 'SPEC'}
      }
    ].forEach(test => {
      it(`options.removeTag.pathTest: ${test.options.removeTag.pathTest || 'NONE'}` +
          ` / options.pathTest: ${test.options.pathTest || 'NONE'}`, done => {
        resetAll();
        test.options.removeTag.tag = 'TAG';
        const pluginStream = plugin(test.options);
        pluginStream.write(newFile('content', 'SRCPATH'));
        pluginStream.once('data', () => {
          expect(preProc.replaceTag.notCalled).to.be.true;
          expect(preProc.removeTag.calledOnce).to.be.true;
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.removeTag.calledWithExactly('TAG', 'content',
            test.expected.srcPath, test.expected.pathTest)).to.be.true;

          done();
        });
      });
    });
  });

});

describe('passed/returned value', () => {
  const OPTS_METHODS = {pickTag: {}, replaceTag: {}, removeTag: {}, tag: 'TAG1'},
    R_METHODS = 'content<pickTag><replaceTag><removeTag>';

  it('should return processed value by all required methods', done => {
    pickTagRturnsNull = false;

    resetAll();
    const pluginStream = plugin(OPTS_METHODS);
    pluginStream.write(newFile('content'));
    pluginStream.once('data', file => {
      expect(file.contents.toString()).to.equal(R_METHODS);
      expect(preProc.replaceTag.calledOnce).to.be.true;
      expect(preProc.removeTag.calledOnce).to.be.true;
      expect(preProc.pickTag.calledOnce).to.be.true;

      done();
    });
  });

  it('should return null when passed value is null', done => {
    pickTagRturnsNull = false;

    resetAll();
    const pluginStream = plugin(OPTS_METHODS),
      passedFile = new File();
    expect(passedFile.isNull()).to.be.true;
    pluginStream.write(passedFile);
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.true;
      expect(preProc.replaceTag.notCalled).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(preProc.pickTag.notCalled).to.be.true;

      done();
    });
  });

  it('should throw an error if pickTag returned null', done => {
    const OPTS_PICKTAG = {pickTag: {}, tag: 'TAG1'},
      R_PICKTAG = 'content<pickTag>',
      ERR_MSG = `Not found tag: ${OPTS_PICKTAG.tag}`;
    pickTagRturnsNull = false;

    resetAll();
    let pluginStream = plugin(OPTS_PICKTAG);
    pluginStream.write(newFile('content'));
    pluginStream.once('data', file => {
      expect(file.contents.toString()).to.equal(R_PICKTAG);
      expect(preProc.pickTag.calledOnce).to.be.true;

      // Returns null
      pickTagRturnsNull = true;

      resetAll();
      pluginStream = plugin(OPTS_PICKTAG);
      expect(() => { pluginStream.write(newFile('content')); }).to.throw(ERR_MSG);
      expect(preProc.pickTag.calledOnce).to.be.true;

      done();
    });
  });

  it('should control an error by allowErrors', done => {
    const
      OPTS1 = {tag: 'TAG1', pickTag: {}},
      OPTS2 = {tag: 'TAG1', pickTag: {allowErrors: false}},
      OPTS3 = {tag: 'TAG1', pickTag: {allowErrors: true}},
      ERR_MSG = `Not found tag: ${OPTS1.tag}`;
    pickTagRturnsNull = true;

    let pluginStream = plugin(OPTS1);
    expect(() => { pluginStream.write(newFile('content')); }).to.throw(ERR_MSG);
    pluginStream = plugin(OPTS2);
    expect(() => { pluginStream.write(newFile('content')); }).to.throw(ERR_MSG);

    pluginStream = plugin(OPTS3);
    pluginStream.write(newFile('content'));
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.true;

      done();
    });
  });

  it('should return value from pickTag with allowErrors even if it is null', done => {
    const OPTS_PICKTAG = {pickTag: {allowErrors: true}, tag: 'TAG1'},
      R_PICKTAG = 'content<pickTag>';
    pickTagRturnsNull = false;

    resetAll();
    let pluginStream = plugin(OPTS_PICKTAG);
    pluginStream.write(newFile('content'));
    pluginStream.once('data', file => {
      expect(file.contents.toString()).to.equal(R_PICKTAG);
      expect(preProc.pickTag.calledOnce).to.be.true;

      // Returns null
      pickTagRturnsNull = true;

      resetAll();
      pluginStream = plugin(OPTS_PICKTAG);
      pluginStream.write(newFile('content'));
      pluginStream.once('data', file => {
        expect(file.isNull()).to.be.true;
        expect(preProc.pickTag.calledOnce).to.be.true;

        done();
      });
    });
  });

  it('should not call other methods when pickTag returned null', done => {
    const OPTS_METHODS_ARR =
      {pickTag: {allowErrors: true}, replaceTag: {}, removeTag: {}, tag: 'TAG1'};
    pickTagRturnsNull = false;

    resetAll();
    let pluginStream = plugin(OPTS_METHODS_ARR);
    pluginStream.write(newFile('content'));
    pluginStream.once('data', file => {
      expect(file.contents.toString()).to.equal(R_METHODS);
      expect(preProc.replaceTag.calledOnce).to.be.true;
      expect(preProc.removeTag.calledOnce).to.be.true;
      expect(preProc.pickTag.calledOnce).to.be.true;

      // Returns null
      pickTagRturnsNull = true;

      resetAll();
      pluginStream = plugin(OPTS_METHODS_ARR);
      pluginStream.write(newFile('content'));
      pluginStream.once('data', file => {
        expect(file.isNull()).to.be.true;
        expect(preProc.replaceTag.notCalled).to.be.true;
        expect(preProc.removeTag.notCalled).to.be.true;
        expect(preProc.pickTag.calledOnce).to.be.true;

        done();
      });
    });
  });

});
