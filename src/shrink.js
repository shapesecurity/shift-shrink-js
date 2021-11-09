'use strict';

const Shift = require('shift-ast/checked');
const { default: isValid } = require('shift-validator');
const spec = require('./spec-objects.js');
const { accessPath, cloneWithReplacement } = require('./util.js');

const expressions = spec.ExpressionStatement.expression.arguments;

const isStatementType = t => t.type === 'Union' && t.arguments.has('ExpressionStatement');
const isStatementListType = t => t.type === 'List' && isStatementType(t.argument);

// map from names of types which contain a Statement[] field to the name of that field for that type
const statementLists = new Map(
  Object.entries(spec)
    .flatMap(
      ([k, v]) =>
        Object.entries(v)
          .filter(e => isStatementListType(e[1]))
          .map(e => [k, e[0]]),
    ),
);

// passing in the type of the root allows replacing it
function* subtrees(node, rootFieldType = null) {
  // we search breadth-first, since removing outer nodes is more valuable
  const queue = [{ path: [], fieldTypes: [rootFieldType], parentTypes: [] }];

  while (queue.length > 0) {
    const { path, fieldTypes, parentTypes } = queue.shift();
    const fieldType = fieldTypes[fieldTypes.length - 1];
    const parentType = parentTypes[parentTypes.length - 1];
    const c = accessPath(node, path);
    if (c === null) {
      // === instead of == so that giving invalid paths will still error
      continue;
    }

    const replaceThisNode = replacement => cloneWithReplacement(node, path, replacement);

    // lists: try dropping each element
    if (Array.isArray(c)) {
      // special case: can't empty a variable declarator list
      // special case: template elements must be removed in pairs, so handle them elsewhere
      // we could let the early error checker / validator handle these, but it's simple to do here
      const canRemove = !(parentType === 'VariableDeclaration' && c.length === 1) && parentType !== 'TemplateExpression';

      const childFieldTypes = fieldTypes.concat(fieldType ? fieldType.argument : null);
      const childNodeTypes = parentTypes.concat(null);

      // later code is likely to have fewer dependents than earlier code, so we're more likely to get away with removing later code
      // so try to remove later things first
      for (let i = c.length - 1; i >= 0; --i) {
        if (canRemove) {
          const copy = [...c];
          copy.splice(i, 1);
          yield replaceThisNode(copy);
        }
        queue.push({
          path: path.concat([i]),
          fieldTypes: childFieldTypes,
          parentTypes: childNodeTypes,
        });
      }
      continue;
    }

    if (fieldType && fieldType.type === 'Maybe') {
      yield replaceThisNode(null);
    }

    const type = c.type;

    // find/replace the nearest parent for which this is substitutable, if any
    // we do only the nearest because it reduces duplicate candidates when repeatedly shrinking: just a->b and then b->c, instead of also a->c
    let isCandidateForExpressionStatement = expressions.has(type);
    let isCandidateForBlockStatement = statementLists.has(type);
    for (let i = fieldTypes.length - 2; i >= 1; --i) {
      let parentFieldType = fieldTypes[i];
      if (parentFieldType !== null) {
        while (parentFieldType.type === 'Maybe') {
          parentFieldType = parentFieldType.argument;
        }
        if (parentFieldType.type === 'Union' && parentFieldType.arguments.has(type)) {
          yield cloneWithReplacement(node, path.slice(0, i), c);
          break;
        }

        // special case: an expression can replace a statement (other than an ExpressionStatement) if wrapped in a new ExpressionStatement
        if (
          isCandidateForExpressionStatement &&
          parentTypes[i] !== 'ExpressionStatement' &&
          isStatementType(parentFieldType)
        ) {
          yield cloneWithReplacement(node, path.slice(0, i), new Shift.ExpressionStatement({ expression: c }));
          break;
        }

        // special case: a statement list can replace a statement (other than a BlockStatement) if wrapped in a new BlockStatement & Block
        if (
          isCandidateForBlockStatement &&
          parentTypes[i] !== 'BlockStatement' &&
          isStatementType(parentFieldType)
        ) {
          yield cloneWithReplacement(node, path.slice(0, i), new Shift.BlockStatement({ block: new Shift.Block({ statements: c[statementLists.get(type)] }) }));
          break;
        }

      }

      // if this node is already in an ExpressionStatement, we can just let that one be substituted with any parent statements; no need to make a new one
      if (parentTypes[i] === 'ExpressionStatement') {
        isCandidateForExpressionStatement = false;
      }

      // ditto for Blocks into parent BlockStatement
      if (parentTypes[i] === 'BlockStatement') {
        isCandidateForBlockStatement = false;
      }
    }

    // try replacing anything in expression position with `null` and anything in statement position with `;`
    if (
      type !== 'LiteralNullExpression' &&
      fieldType &&
      fieldType.type === 'Union' &&
      fieldType.arguments.has('LiteralNullExpression')
    ) {
      yield replaceThisNode(new Shift.LiteralNullExpression());
    }

    if (
      type !== 'EmptyStatement' &&
      fieldType &&
      fieldType.type === 'Union' &&
      fieldType.arguments.has('EmptyStatement')
    ) {
      yield replaceThisNode(new Shift.EmptyStatement());
    }

    // special cases:
    // - string -> empty string
    // - property access -> `._`
    // - switch-with-default -> switch
    // - template with interpolation -> drop pairs, cf https://github.com/shapesecurity/shift-spec/issues/145
    // - arrow -> function expression (could go other way, just want a canonical choice)
    // - function/class declarations -> expressions
    // - class expression -> object literal
    // - object literal with method -> function expression
    switch (type) {
      case 'Directive': {
        if (c.rawValue !== '') {
          yield replaceThisNode(new Shift.Directive({ rawValue: '' }));
        }
        break;
      }
      case 'TemplateElement': {
        if (c.rawValue !== '') {
          yield replaceThisNode(new Shift.TemplateElement({ rawValue: '' }));
        }
        break;
      }
      case 'LiteralStringExpression': {
        if (c.value !== '') {
          yield replaceThisNode(new Shift.LiteralStringExpression({ value: '' }));
        }
        break;
      }
      case 'LiteralRegExpExpression': {
        const BASIC_PATTERN = 'a';
        if (c.pattern !== BASIC_PATTERN) {
          yield replaceThisNode(new Shift.LiteralRegExpExpression({
            pattern: BASIC_PATTERN,
            global: c.global,
            ignoreCase: c.ignoreCase,
            multiLine: c.multiLine,
            dotAll: c.dotAll,
            unicode: c.unicode,
            sticky: c.sticky,
          }));
        }
        break;
      }
      case 'StaticPropertyName': {
        if (c.value !== '') {
          yield replaceThisNode(new Shift.StaticPropertyName({ value: '' }));
        }
        break;
      }
      case 'TemplateExpression': {
        for (let i = 1; i < c.elements.length; i += 2) {
          const copy = [...c.elements];
          copy.splice(i - 1, 2);
          yield replaceThisNode(new Shift.TemplateExpression({ tag: c.tag, elements: copy }));
        }
        break;
      }
      case 'ComputedMemberAssignmentTarget':
      case 'ComputedMemberExpression': {
        let newType = type === 'ComputedMemberAssignmentTarget' ? 'StaticMemberAssignmentTarget' : 'StaticMemberExpression';
        yield replaceThisNode(new Shift[newType]({ object: c.object, property: '_' }));
        break;
      }
      case 'StaticMemberAssignmentTarget':
      case 'StaticMemberExpression': {
        if (c.property !== '_') {
          yield replaceThisNode(new Shift[type]({ object: c.object, property: '_' }));
        }
        break;
      }
      case 'SwitchStatementWithDefault': {
        yield replaceThisNode(
          new Shift.SwitchStatement({
            discriminant: c.discriminant,
            cases: c.preDefaultCases.concat(c.postDefaultCases),
          }),
        );
        break;
      }
      case 'ArrowExpression': {
        if (c.body.type === 'FunctionBody') {
          yield replaceThisNode(
            new Shift.FunctionExpression({
              isAsync: c.isAsync,
              isGenerator: false,
              name: null,
              params: c.params,
              body: c.body,
            }),
          );
        } else {
          const body = new Shift.FunctionBody({
            directives: [],
            statements: [new Shift.ReturnStatement({
              expression: c.body,
            })],
          });
          yield replaceThisNode(
            new Shift.FunctionExpression({
              isAsync: c.isAsync,
              isGenerator: false,
              name: null,
              params: c.params,
              body,
            }),
          );
        }
        break;
      }
      case 'FunctionDeclaration': {
        yield replaceThisNode(
          new Shift.ExpressionStatement({
            expression: new Shift.FunctionExpression({
              isAsync: c.isAsync,
              isGenerator: c.isGenerator,
              name: c.name === '*default*' ? null : c.name,
              params: c.params,
              body: c.body,
            }),
          }),
        );
        break;
      }
      case 'ClassDeclaration': {
        yield replaceThisNode(
          new Shift.ExpressionStatement({
            expression: new Shift.ClassExpression({
              name: c.name === '*default*' ? null : c.name,
              super: c.super,
              elements: c.elements,
            }),
          }),
        );
        break;
      }
      case 'ClassExpression': {
        yield replaceThisNode(
          new Shift.ObjectExpression({
            properties: c.elements.map(e => e.method),
          }),
        );
        break;
      }
      case 'ObjectExpression': {
        for (const property of c.properties) {
          if (property.type === 'Method') {
            yield replaceThisNode(
              new Shift.FunctionExpression({
                isAsync: property.isAsync,
                isGenerator: property.isGenerator,
                name: null,
                params: property.params,
                body: property.body,
              }),
            );
          } else if (property.type === 'Getter') {
            const params = new Shift.FormalParameters({ items: [], rest: null });
            yield replaceThisNode(
              new Shift.FunctionExpression({
                isAsync: false,
                isGenerator: false,
                name: null,
                params,
                body: property.body,
              }),
            );
          } else if (property.type === 'Setter') {
            const params = new Shift.FormalParameters({ items: [property.param], rest: null });
            yield replaceThisNode(
              new Shift.FunctionExpression({
                isAsync: false,
                isGenerator: false,
                name: null,
                params,
                body: property.body,
              }),
            );
          }
        }
        break;
      }
    }

    // make async functions plain, static methods instance, regex flags off, etc
    for (const [key, value] of Object.entries(c)) {
      if (value === true) {
        const copy = { ...c };
        copy[key] = false;
        yield replaceThisNode(copy);
      }
    }

    // recurse into the children
    const childNodeTypes = parentTypes.concat(type);
    for (const [field, childFieldType] of Object.entries(spec[type])) {
      queue.push({
        path: path.concat([field]),
        fieldTypes: fieldTypes.concat([childFieldType]),
        parentTypes: childNodeTypes,
      });
    }
  }
}

// when shrinking just a portion of a program, you must provide the full tree to this function
// because validity is a property of whole programs, not portions thereof
function* validSubtrees(tree, path = []) {
  let target, type;
  if (path.length === 0) {
    target = tree;
    type = null;
  } else {
    // infer the type for the subtree based on its position
    let parent = accessPath(tree, path.slice(0, -1));
    target = parent[path[path.length - 1]];
    if (Array.isArray(parent)) {
      if (path.length === 1) {
        // i.e., we were asked to reduce a position in a list, without knowing the type of the list
        type = null;
      } else {
        parent = accessPath(tree, path.slice(0, -2));
        type = spec[parent.type][path[path.length - 2]].argument;
      }
    } else {
      type = spec[parent.type][path[path.length - 1]];
    }
  }
  for (const subtree of subtrees(target, type)) {
    const wrapped = cloneWithReplacement(tree, path, subtree);
    if (!isValid(wrapped)) {
      continue;
    }
    yield wrapped;
  }
}

async function shrink(tree, isStillGood, { log = () => {}, path = [], onImproved = () => {} } = {}) {
  if (!await isStillGood(tree)) {
    throw new Error('Input is already not good!');
  }

  let best = tree;

  let improved = false;
  search: while (true) {
    log('tick');
    for (const candidate of validSubtrees(best, path)) {
      if (await isStillGood(candidate)) {
        log('improved!');
        onImproved(candidate);
        best = candidate;
        improved = true;
        continue search;
      } else {
        log('tock');
      }
    }
    break;
  }
  if (!improved) {
    log('could not improve');
  }

  return best;
}

module.exports = { subtrees, validSubtrees, shrink };
