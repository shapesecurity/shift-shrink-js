'use strict';

let test = require('ava');

let { parseModule } = require('shift-parser');
let { default: codegen } = require('shift-codegen');

let { validSubtrees, lookaheadBySize } = require('..');

let program = parseModule('let x = 0; let y = 1; function f() { function inner(){ complex; stuff; here; return x + y; } }');

test('validSubtrees is normally outer-nodes-first', t => {
  let i = 0;
  let subtrees = [];
  for (let subtree of validSubtrees(program)) {
    subtrees.push(codegen(subtree));
    ++i;
    if (i >= 3) {
      break;
    }
  }
  t.deepEqual([
    'let x=0;let y=1',
    'let x=0;function f(){function inner(){complex;stuff;here;return x+y}}',
    'let y=1;function f(){function inner(){complex;stuff;here;return x+y}}',
  ], subtrees);
});

test('validSubtrees with lookahead is best-nodes-first', t => {
  let i = 0;
  let subtrees = [];
  for (let subtree of lookaheadBySize(validSubtrees(program), 10)) {
    subtrees.push(codegen(subtree));
    ++i;
    if (i >= 3) {
      break;
    }
  }
  t.deepEqual([
    'let x=0;let y=1',
    'let x=0;let y=1;;',
    'let x=0;let y=1;function f(){}',
  ], subtrees);
});
