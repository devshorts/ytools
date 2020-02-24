import {run, yarnWorkspaceInfo } from "./tools";
import * as path from "path";

test("parses yarn", async () => {
  const data = yarnWorkspaceInfo(path.join(process.cwd(), "samples"));
  expect(data).toMatchObject({
    hoist1: {
      location: "packages/hoist1",
      workspaceDependencies: ["hoist2"],
      mismatchedWorkspaceDependencies: []
    },
    hoist2: {
      location: "packages/hoist2",
      workspaceDependencies: [],
      mismatchedWorkspaceDependencies: []
    },
    nohoist: {
      location: "packages/nohoist",
      workspaceDependencies: ["hoist1", "hoist2"],
      mismatchedWorkspaceDependencies: []
    }
  });
});
