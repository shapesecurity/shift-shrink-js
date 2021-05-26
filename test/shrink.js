'use strict';

let test = require('ava');

let { fuzzScript } = require('shift-fuzzer');
let { default: codeGen } = require('shift-codegen');
let { Validator } = require('shift-validator');
let Shift = require('shift-ast/checked');

let { shrink } = require('..');

function containsType(type, tree) {
  return tree.type === type || Object.values(tree).some(c => c && typeof c === 'object' && containsType(type, c));
}

async function searchFor(type, wrap = x => x, path = []) {
  let isStillGood = c => containsType(type, c);
  let candidate = wrap(fuzzScript());
  if (!isStillGood(candidate)) {
    return null;
  }
  // this should not be necessary, but apparently we have a bug in the fuzzer
  if (Validator.validate(candidate).length > 0) {
    return null;
  }

  return codeGen(await shrink(candidate, isStillGood, { path }));
}

test('simple reduction: return', async t => {
  for (let i = 0; i < 10; ++i) {
    let sample = await searchFor('ReturnStatement');
    if (sample === null) {
      --i;
      continue;
    }

    t.is(sample, '(function(){return})');
  }
});

test('simple reduction: await', async t => {
  for (let i = 0; i < 10; ++i) {
    let sample = await searchFor('AwaitExpression');
    if (sample === null) {
      --i;
      continue;
    }

    t.is(sample, '(async function(){await null})');
  }
});

test('simple reduction: throw', async t => {
  for (let i = 0; i < 10; ++i) {
    let sample = await searchFor('ThrowStatement');
    if (sample === null) {
      --i;
      continue;
    }

    t.is(sample, 'throw null');
  }
});

test('reduction: template', async t => {
  for (let i = 0; i < 10; ++i) {
    let sample = await searchFor('TemplateExpression');
    if (sample === null) {
      --i;
      continue;
    }

    t.is(sample, '``');
  }
});

test('reduction: string', async t => {
  for (let i = 0; i < 10; ++i) {
    let sample = await searchFor('LiteralStringExpression');
    if (sample === null) {
      --i;
      continue;
    }

    t.is(sample, '("")');
  }
});

test('support for subpaths', async t => {
  let wrap = script => {
    script.directives = [];
    script.statements = [new Shift.FunctionDeclaration({
      isAsync: false,
      isGenerator: false,
      name: new Shift.BindingIdentifier({ name: 'wrapper' }),
      params: new Shift.FormalParameters({ items: [], rest: null }),
      body: new Shift.FunctionBody({
        directives: [],
        statements: script.statements,
      }),
    })];
    return script;
  };
  let path = ['statements', 0, 'body', 'statements'];

  for (let i = 0; i < 10; ++i) {
    let sample = await searchFor('ThrowStatement', wrap, path);
    if (sample === null) {
      --i;
      continue;
    }

    t.is(sample, 'function wrapper(){throw null}');
  }
});
