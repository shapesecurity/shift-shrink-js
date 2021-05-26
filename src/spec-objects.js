'use strict';

// shfit-spec has fields as an array
// we want random access, so re-wrap as objects

const spec = require('shift-spec').default;

const wrapped = Object.create(null);

const constantTypes = new Set(['Boolean', 'Number', 'String', 'Enum', 'Const']);

function flattenUnion(type) {
  if (type.typeName !== 'Union') {
    return [type];
  }
  return type.arguments.flatMap(flattenUnion);
}

function flatten(type) {
  switch (type.typeName) {
    case 'Union': {
      const children = new Set(flattenUnion(type).map(t => t.typeName));
      if (['Union', 'List', 'Maybe'].some(t => children.has(t))) {
        throw new Error('union is nontrivial');
      }
      return {
        type: 'Union',
        arguments: children,
      };
    }
    case 'List': {
      return {
        type: 'List',
        argument: flatten(type.argument),
      };
    }
    case 'Maybe': {
      return {
        type: 'Maybe',
        argument: flatten(type.argument),
      };
    }
    default: {
      // it's simpler to treat constant node types as union-of-one
      return {
        type: 'Union',
        arguments: new Set([type.typeName]),
      };
    }
  }
}

function isConstantType(type) {
  return constantTypes.has(type.typeName) || (type.typeName === 'List' || type.typeName === 'Maybe') && isConstantType(type.argument);
}

for (const [name, { fields }] of Object.entries(spec)) {
  wrapped[name] = Object.fromEntries(
    fields
      .filter(field => !isConstantType(field.type))
      .map(field => [
        field.name,
        flatten(field.type),
      ]),
  );
}

module.exports = wrapped;
