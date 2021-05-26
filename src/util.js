'use strict';

function accessPath(node, path) {
  let head = node;
  for (const prop of path) {
    head = head[prop];
  }
  return head;
}

function cloneWithReplacement(node, path, replacement) {
  if (path.length === 0) {
    return replacement;
  }

  let clone = Array.isArray(node) ? [...node] : { ...node };
  clone[path[0]] = cloneWithReplacement(clone[path[0]], path.slice(1), replacement);
  return clone;
}

module.exports = { accessPath, cloneWithReplacement };
