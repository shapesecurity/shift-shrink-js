'use strict';

let test = require('ava');

let { parseScript } = require('shift-parser');
let { default: codeGen } = require('shift-codegen');
let { subtrees } = require('..');

test('subtrees', t => {
  let actual = [...subtrees(parseScript('console.log(x + y);'))]
    .map(tree => codeGen(tree));
  let expected = [
    '',
    ';',
    'null',
    'console.log',
    'null(x+y)',
    'console._(x+y)',
    'console.log()',
    'console(x+y)',
    'null.log(x+y)',
    'x+y',
    'console.log(null)',
    'console.log(x)',
    'console.log(null+y)',
    'console.log(y)',
    'console.log(x+null)',
  ];
  t.deepEqual(expected, actual);
});
