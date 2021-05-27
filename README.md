# Shift Shrink

A test case reducer for JavaScript ASTs in the [Shift](https://github.com/shapesecurity/shift-spec) format.

Well suited for use with [Shift Fuzzer](https://github.com/shapesecurity/shift-fuzzer-js).

## Installation

```
npm install shift-shrink
```

## Use

The primary interface for this tool takes as input an "interesting" AST (whatever that means for your use case) and a function which determines whether an AST is interesting, and returns the smallest interesting version of that AST it can find.

It only explores single-step simplifications, so this is not guaranteed to be the smallest possible interesting AST.

If you need to work with JavaScript programs rather than their ASTs, you can use [shift-parser](https://github.com/shapesecurity/shift-parser-js) and [shift-codegen](https://github.com/shapesecurity/shift-codegen-js) to go back and forth between the two.

Because this can take some time, you can provide a `log` callback in the optional third options bag argument which will be called periodically. This parameter is intended only to allow humans to confirm it's making progress, not as a consistent part of the API.

```js
let { shrink } = require('shift-shrink');

let testCase = ...;

// non-async functions also work, but `shrink` will still be async
let isStillGood = async tree => ...;

// a simpler AST, hopefully. returns `tree` without modification if no reduction is possible
let shrunk = await shrink(tree, isStillGood, { log: console.log });
console.log(shrunk);
```

### Shrinking code within a harness

If you have some harness code which should be left untouched, you can provide a `path` option giving the path to the node you want to shrink.

```js
let testCase = parseScript(`
  function run() {
    // code of interest goes here
  }
  run();
`);

// only attempt to shrink the body of `run`
let shrunk = await shrink(tree, isStillGood, { path: ['statements', 0, 'body'] });
```

## Contributing

* Open a Github issue with a description of your desired change. If one exists already, leave a message stating that you are working on it with the date you expect it to be complete.
* Sign the [CLA](https://github.com/shapesecurity/CLA) by submitting a PR as described in that repository.
* Fork this repo, and clone the forked repo.
* Install dependencies with `npm install`.
* Build and test in your environment with `npm run build && npm test`.
* Create a feature branch. Make your changes. Add tests.
* Build and test in your environment with `npm run build && npm test`.
* Make a commit that includes the text "fixes #*XX*" where *XX* is the Github issue.
* Open a Pull Request on Github.
