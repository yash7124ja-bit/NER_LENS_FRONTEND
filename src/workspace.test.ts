import assert from "node:assert/strict";
import test from "node:test";
import { permittedWorkspaces, workspaceFromPath } from "./workspace.ts";

test("workspace paths and roles stay distinct", () => {
  assert.equal(workspaceFromPath("/field/reports"), "field");
  assert.equal(workspaceFromPath("/v1/field-reports"), null);
  assert.deepEqual(permittedWorkspaces(["field_reporter"]), ["field"]);
  assert.deepEqual(permittedWorkspaces(["driver"]), ["field"]);
  assert.deepEqual(permittedWorkspaces(["system_admin", "dispatcher"]), ["control", "authority"]);
  assert.deepEqual(permittedWorkspaces([]), []);
});
