# Shift Shrink

A test case reducer for JavaScript ASTs in the [Shift](https://github.com/shapesecurity/shift-spec) format.

Well suited for use with [Shift Fuzzer](https://github.com/shapesecurity/shift-fuzzer-js).

## Installation

```
npm install shift-shrink
```

## Use

The primary interface for this tool takes as input an "interesting" AST (whatever that means for your use case) and a function which determines whether an AST is interesting, and returns the smallest interesting version of that AST it can find. For example, if you've generated a large AST that has different output when evaluated in V8 versus in SpiderMonkey, you can use this to find a smaller AST that has that property.

It only explores single-step simplifications, so this is not guaranteed to be the smallest possible interesting AST.

If you need to work with JavaScript programs rather than their ASTs, you can use [shift-parser](https://github.com/shapesecurity/shift-parser-js) and [shift-codegen](https://github.com/shapesecurity/shift-codegen-js) to go back and forth between the two.

Because this can take some time, you can provide a `log` callback in the optional third options bag argument which will be called periodically. This parameter is intended only to allow humans to confirm it's making progress, not as a consistent part of the API. Additionally, the `onImproved` callback is called whenever a new best candidate is found, so you can see progress (and interrupt the shrinking without losing progress, as long as you persist the result).

```js
let { shrink } = require('shift-shrink');
let { parseScript } = require('shift-parser');

let testCase = parseScript('let x = 0;');

// non-async functions also work, but `shrink` will still be async
let isStillGood = async tree => ...;

// a simpler AST, hopefully. returns `testCase` without modification if no reduction is possible
let shrunk = await shrink(testCase, isStillGood, { log: console.log, onImproved: tree => fs.writeFileSync('best.js', JSON.stringify(tree), 'utf8') });
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
let shrunk = await shrink(testCase, isStillGood, { path: ['statements', 0, 'body'] });
```

### lookahead

By default, the runner will iterate over trees which are reachable by changing one of the top-level AST nodes, then trees reachable by changing one of the one-level-deep AST nodes, and so on.

The options bag takes a `lookahead` option which allows you to specify that it should eagerly generate the specified number of candidates and iterate over them in ascending order of an approximation of AST size. This can considerably improve performance when there are many reductions possible.

```js
await shrink(testCase, isStillGood, { lookahead: 100 })
```

## "smaller"

The goal of this project is to produce "interesting" trees which are smaller than the original "interesting" example. "Smaller" is mainly taken to mean having fewer nodes in the AST, but there are in addition some more subjective rules: for example, `null` is considered to be the smallest expression, plain function expressions are considered to be smaller than arrows or generators, etc. Currently it does not differentiate among literals except that it considers the empty string to be the smallest string.

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
