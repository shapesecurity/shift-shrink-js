'use strict';

let test = require('ava');

let { parseScript } = require('shift-parser');
let { default: codeGen } = require('shift-codegen');
let { subtrees } = require('..');

function allSubtrees(src) {
  return [...subtrees(parseScript(src))]
    .map(tree => codeGen(tree));
}

test('subtrees', t => {
  let actual = allSubtrees('console.log(x + y);');
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

test('subtrees with blocks', t => {
  let all = allSubtrees('try { foo; bar; } catch (e) { }');
  t.true(all.includes('{foo;bar}'));

  all = allSubtrees('switch (0) { case x: foo; bar; }');
  t.true(all.includes('{foo;bar}'));

  all = allSubtrees('function f() { foo; bar; }');
  t.true(all.includes('{foo;bar}'));
});
