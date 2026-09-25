import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const snapshot = JSON.parse(readFileSync(new URL("../contracts/openapi-v1.json", import.meta.url)));
const sibling = new URL("../../NER_LENS/docs/openapi/v1.json", import.meta.url);

function pathsIn(node) {
  if (ts.isConditionalExpression(node)) return [...pathsIn(node.whenTrue), ...pathsIn(node.whenFalse)];
  if (ts.isParenthesizedExpression(node)) return pathsIn(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return [node.head.text + node.templateSpans.map(span => `{dynamic}${span.literal.text}`).join("")];
  return [];
}

function methodOf(call, name) {
  if (name === "mutate") return "post";
  if (name === "request") return call.arguments.length >= 3 ? "post" : "get";
  const options = call.arguments[1];
  if (options && ts.isObjectLiteralExpression(options)) {
    const method = options.properties.find(prop => ts.isPropertyAssignment(prop) && prop.name.getText().replaceAll('"', "") === "method");
    if (method && ts.isStringLiteral(method.initializer)) return method.initializer.text.toLowerCase();
  }
  return "get";
}

function matchingRoute(path) {
  const parts = path.split("?")[0].split("/");
  return Object.keys(snapshot.paths).find(route => {
    const expected = route.split("/");
    return expected.length === parts.length && expected.every((part, i) =>
      part === parts[i] || (/^\{[^}]+\}$/.test(part) && /^\{[^}]+\}$/.test(parts[i])));
  });
}

test("frontend API calls exist with their methods in the published OpenAPI contract", () => {
  if (existsSync(sibling)) assert.deepEqual(snapshot, JSON.parse(readFileSync(sibling)));
  const calls = new Set();
  const paths = new Set();
  for (const file of readdirSync(new URL("./", import.meta.url)).filter(name => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))) {
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      for (const path of pathsIn(node)) if (path.startsWith("/v1/") || path.startsWith("/health/")) paths.add(path);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["request", "fetch", "send", "mutate"].includes(node.expression.text)) {
        for (const path of pathsIn(node.arguments[0])) {
          if (path.startsWith("/v1/") || path.startsWith("/health/")) calls.add(`${methodOf(node, node.expression.text).toUpperCase()} ${path}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(calls.size > 20, "API call discovery unexpectedly found too few calls");
  for (const path of paths) assert.ok(matchingRoute(path), `No OpenAPI route for ${path}`);
  for (const call of calls) {
    const [method, path] = call.split(" ");
    assert.ok(snapshot.paths[matchingRoute(path)]?.[method.toLowerCase()], `No OpenAPI method for ${call}`);
  }
});
