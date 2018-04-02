'use strict';

let pickTagRturnsNull;
const expect = require('chai').expect,
  sinon = require('sinon'),
  File = require('vinyl'),
  proxyquire = require('proxyquire').noPreserveCache(),
  preProc = {
    pickTag: sinon.spy((tag, content) => (pickTagRturnsNull ? null : `${content}<pickTag>`)),
    replaceTag: sinon.spy((tag, replacement, content) => `${content}<replaceTag>`),
    removeTag: sinon.spy((tag, content) => `${content}<removeTag>`)
  },
  plugin = proxyquire('../', {
    'pre-proc': preProc,
    'fancy-log': {error: () => {}, warn: () => {}, info: () => {}, dir: () => {}}
  }),

  CONTENTS = 'content';

function resetAll() {
  preProc.pickTag.resetHistory();
  preProc.replaceTag.resetHistory();
  preProc.removeTag.resetHistory();
}

function newBufferFile(path) {
  return new File({
    // Check `allocUnsafe` to make sure of the new API.
    contents: Buffer.allocUnsafe && Buffer.from ? Buffer.from(CONTENTS) : new Buffer(CONTENTS),
    path
  });
}

describe('implements a basic flow as Buffer based plugin', () => {
  const OPTS_REPLACETAG = {tag: 'TAG1'};

  it('should accept contents from Buffer', done => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin({replaceTag: OPTS_REPLACETAG}),
      passedFile = newBufferFile();
    expect(passedFile.isNull()).to.be.false;
    expect(passedFile.isStream()).to.be.false;
    expect(passedFile.isBuffer()).to.be.true;

    pluginStream.write(passedFile);
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.false;
      expect(file.isStream()).to.be.false;
      expect(file.isBuffer()).to.be.true;
      expect(preProc.pickTag.notCalled).to.be.true;
      expect(preProc.replaceTag
        .calledOnceWithExactly(OPTS_REPLACETAG.tag, void 0, CONTENTS, null, void 0)).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(file.contents.toString()).to.equal(`${CONTENTS}<replaceTag>`);

      done();
    });
  });

  it('should throw an error if a Stream is input', () => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin({replaceTag: OPTS_REPLACETAG}),
      passedFile = new File({
        contents: new (require('stream')).Readable({objectMode: true})
          .wrap(require('event-stream').readArray(['stream', 'with', 'those', 'contents']))
      });
    expect(passedFile.isNull()).to.be.false;
    expect(passedFile.isStream()).to.be.true;
    expect(passedFile.isBuffer()).to.be.false;

    expect(() => { pluginStream.write(passedFile); }).to.throw('Streaming not supported');
    expect(preProc.pickTag.notCalled).to.be.true;
    expect(preProc.replaceTag.notCalled).to.be.true;
    expect(preProc.removeTag.notCalled).to.be.true;
  });

  it('should skip process if a null is input', done => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin({replaceTag: OPTS_REPLACETAG}),
      passedFile = new File();
    expect(passedFile.isNull()).to.be.true;
    expect(passedFile.isStream()).to.be.false;
    expect(passedFile.isBuffer()).to.be.false;

    pluginStream.write(passedFile);
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.true;
      expect(file.isStream()).to.be.false;
      expect(file.isBuffer()).to.be.false;
      expect(preProc.pickTag.notCalled).to.be.true;
      expect(preProc.replaceTag.notCalled).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;

      done();
    });
  });

});

describe('when option for each method is passed', () => {
  const OPTS_PICKTAG = {tag: 'TAG1'},
    OPTS_REPLACETAG = {tag: 'TAG2'};

  it('should call only pickTag', done => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin({pickTag: OPTS_PICKTAG});
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_PICKTAG.tag, CONTENTS)).to.be.true;
      expect(preProc.replaceTag.notCalled).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(file.contents.toString()).to.equal(`${CONTENTS}<pickTag>`);

      done();
    });
  });

  it('should call pickTag and replaceTag', done => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin({pickTag: OPTS_PICKTAG, replaceTag: OPTS_REPLACETAG});
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_PICKTAG.tag, CONTENTS)).to.be.true;
      expect(preProc.replaceTag
        .calledOnceWithExactly(OPTS_REPLACETAG.tag, void 0, `${CONTENTS}<pickTag>`, null, void 0))
        .to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(file.contents.toString()).to.equal(`${CONTENTS}<pickTag><replaceTag>`);

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
        pickTagRturnsNull = false;
        resetAll();
        const pluginStream = plugin(test.options);
        pluginStream.write(newBufferFile());
        pluginStream.once('data', () => {
          expect(preProc.pickTag.calledOnceWithExactly(test.expectedTag, CONTENTS)).to.be.true;
          expect(preProc.replaceTag.notCalled).to.be.true;
          expect(preProc.removeTag.notCalled).to.be.true;

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
        pickTagRturnsNull = false;
        resetAll();
        test.options.replaceTag.replacement = 'replacement';
        const pluginStream = plugin(test.options);
        pluginStream.write(newBufferFile());
        pluginStream.once('data', () => {
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.replaceTag
            .calledOnceWithExactly(test.expectedTag, 'replacement', CONTENTS, null, void 0))
            .to.be.true;
          expect(preProc.removeTag.notCalled).to.be.true;

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
        pickTagRturnsNull = false;
        resetAll();
        test.options.replaceTag.tag = 'TAG';
        test.options.replaceTag.replacement = 'replacement';
        const pluginStream = plugin(test.options);
        pluginStream.write(newBufferFile('SRCPATH'));
        pluginStream.once('data', () => {
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.replaceTag
            .calledOnceWithExactly('TAG', 'replacement', CONTENTS,
              test.expected.srcPath, test.expected.pathTest)).to.be.true;
          expect(preProc.removeTag.notCalled).to.be.true;

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
        pickTagRturnsNull = false;
        resetAll();
        const pluginStream = plugin(test.options);
        pluginStream.write(newBufferFile());
        pluginStream.once('data', () => {
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.replaceTag.notCalled).to.be.true;
          expect(preProc.removeTag
            .calledOnceWithExactly(test.expectedTag, CONTENTS, null, void 0)).to.be.true;

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
        pickTagRturnsNull = false;
        resetAll();
        test.options.removeTag.tag = 'TAG';
        const pluginStream = plugin(test.options);
        pluginStream.write(newBufferFile('SRCPATH'));
        pluginStream.once('data', () => {
          expect(preProc.pickTag.notCalled).to.be.true;
          expect(preProc.replaceTag.notCalled).to.be.true;
          expect(preProc.removeTag
            .calledOnceWithExactly('TAG', CONTENTS,
              test.expected.srcPath, test.expected.pathTest)).to.be.true;

          done();
        });
      });
    });
  });

});

describe('passed/returned value', () => {
  const OPTS_ALL = {pickTag: {}, replaceTag: {}, removeTag: {}, tag: 'TAG1'},
    RES_ALL = `${CONTENTS}<pickTag><replaceTag><removeTag>`;

  it('should return processed value by all required methods', done => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin(OPTS_ALL);
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_ALL.tag, CONTENTS)).to.be.true;
      expect(preProc.replaceTag
        .calledOnceWithExactly(OPTS_ALL.tag, void 0, `${CONTENTS}<pickTag>`, null, void 0))
        .to.be.true;
      expect(preProc.removeTag
        .calledOnceWithExactly(OPTS_ALL.tag, `${CONTENTS}<pickTag><replaceTag>`, null, void 0))
        .to.be.true;
      expect(file.contents.toString()).to.equal(RES_ALL);

      done();
    });
  });

  it('should return a null if a null is input', done => {
    pickTagRturnsNull = false;
    resetAll();
    const pluginStream = plugin(OPTS_ALL),
      passedFile = new File();
    expect(passedFile.isNull()).to.be.true;
    pluginStream.write(passedFile);
    pluginStream.once('data', file => {
      expect(preProc.pickTag.notCalled).to.be.true;
      expect(preProc.replaceTag.notCalled).to.be.true;
      expect(preProc.removeTag.notCalled).to.be.true;
      expect(file.isNull()).to.be.true;

      done();
    });
  });

  it('should throw an error if pickTag returned a null', done => {
    const OPTS_PICKTAG = {pickTag: {}, tag: 'TAG1'},
      ERR_MSG = `Not found tag: ${OPTS_PICKTAG.tag}`;

    pickTagRturnsNull = false;
    resetAll();
    let pluginStream = plugin(OPTS_PICKTAG);
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_PICKTAG.tag, CONTENTS)).to.be.true;
      expect(file.contents.toString()).to.equal(`${CONTENTS}<pickTag>`);

      // Returns null
      pickTagRturnsNull = true;
      resetAll();
      pluginStream = plugin(OPTS_PICKTAG);
      expect(() => { pluginStream.write(newBufferFile()); }).to.throw(ERR_MSG);
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_PICKTAG.tag, CONTENTS)).to.be.true;

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
    expect(() => { pluginStream.write(newBufferFile()); }).to.throw(ERR_MSG);
    pluginStream = plugin(OPTS2);
    expect(() => { pluginStream.write(newBufferFile()); }).to.throw(ERR_MSG);

    pluginStream = plugin(OPTS3);
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(file.isNull()).to.be.true;

      done();
    });
  });

  it('should return a null if pickTag returned a null with allowErrors', done => {
    const OPTS_PICKTAG = {pickTag: {allowErrors: true}, tag: 'TAG1'};

    pickTagRturnsNull = false;
    resetAll();
    let pluginStream = plugin(OPTS_PICKTAG);
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_PICKTAG.tag, CONTENTS)).to.be.true;
      expect(file.contents.toString()).to.equal(`${CONTENTS}<pickTag>`);

      // Returns null
      pickTagRturnsNull = true;
      resetAll();
      pluginStream = plugin(OPTS_PICKTAG);
      pluginStream.write(newBufferFile());
      pluginStream.once('data', file => {
        expect(preProc.pickTag.calledOnceWithExactly(OPTS_PICKTAG.tag, CONTENTS)).to.be.true;
        expect(file.isNull()).to.be.true;

        done();
      });
    });
  });

  it('should not call other methods when pickTag returned a null', done => {
    const OPTS_ALL = {pickTag: {allowErrors: true}, replaceTag: {}, removeTag: {}, tag: 'TAG1'};

    pickTagRturnsNull = false;
    resetAll();
    let pluginStream = plugin(OPTS_ALL);
    pluginStream.write(newBufferFile());
    pluginStream.once('data', file => {
      expect(preProc.pickTag.calledOnceWithExactly(OPTS_ALL.tag, CONTENTS)).to.be.true;
      expect(preProc.replaceTag
        .calledOnceWithExactly(OPTS_ALL.tag, void 0, `${CONTENTS}<pickTag>`, null, void 0))
        .to.be.true;
      expect(preProc.removeTag
        .calledOnceWithExactly(OPTS_ALL.tag, `${CONTENTS}<pickTag><replaceTag>`, null, void 0))
        .to.be.true;
      expect(file.contents.toString()).to.equal(RES_ALL);

      // Returns null
      pickTagRturnsNull = true;
      resetAll();
      pluginStream = plugin(OPTS_ALL);
      pluginStream.write(newBufferFile());
      pluginStream.once('data', file => {
        expect(file.isNull()).to.be.true;
        expect(preProc.pickTag.calledOnceWithExactly(OPTS_ALL.tag, CONTENTS)).to.be.true;
        expect(preProc.replaceTag.notCalled).to.be.true;
        expect(preProc.removeTag.notCalled).to.be.true;

        done();
      });
    });
  });

});
