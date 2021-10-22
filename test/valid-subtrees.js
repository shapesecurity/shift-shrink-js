'use strict';

let test = require('ava');

let Shift = require('shift-ast/checked');
let { Validator } = require('shift-validator');
let { parseModule } = require('shift-parser');
let { fuzzScript, fuzzModule } = require('shift-fuzzer');

let { shrink, validSubtrees } = require('..');


function strictReconstruct(tree) {
  if (tree === null) {
    return null;
  }
  if (typeof tree !== 'object') {
    return tree;
  }
  if (Array.isArray(tree)) {
    return tree.map(strictReconstruct);
  }
  let { type, ...fields } = tree;
  return new Shift[type](Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, strictReconstruct(v)])));
}

function isWellTyped(tree) {
  // seems like we should expose a method to do this
  // but in the mean time, this hack works fine
  try {
    strictReconstruct(tree);
    return true;
  } catch (e) {
    return false;
  }
}

let valid = t => isWellTyped(t) && Validator.validate(t).length === 0;

function isValidButSubtreeIsNotValid(tree) {
  if (!valid(tree)) {
    return false;
  }
  for (let subtree of validSubtrees(tree)) {
    if (!valid(subtree)) {
      return true;
    }
  }
  return false;
}

test('fuzzing: all subtrees of random trees are valid and well-formed', async t => {
  t.plan(0);
  outer: for (let i = 0; i < 100; ++i) {
    let tree = (Math.random() < 0.5 ? fuzzScript : fuzzModule)();
    if (!valid(tree)) {
      // we should really fix the fuzzer
      --i;
      continue;
    }
    for (let subtree of validSubtrees(tree)) {
      if (!valid(subtree)) {
        // we have a minimzer, might as well use it
        let minimized = await shrink(tree, isValidButSubtreeIsNotValid);
        t.fail('tree is valid but some subtree is not valid: ' + JSON.stringify(minimized));
        break outer;
      }
    }
  }
});

test('subtrees of `export default` are well-formed', async t => {
  let tree = parseModule('export default function f() {}');
  for (let subtree of validSubtrees(tree)) {
    t.assert(valid(subtree), 'subtree is not valid: ' + JSON.stringify(subtree));
  }
});
