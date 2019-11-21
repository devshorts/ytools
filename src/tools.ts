import * as child_process from "child_process";

export function run(command: string, cwd?: string): string {
  const [c, ...args] = command.split(' ')
  const result = child_process.spawnSync(c, args, {
    encoding: "utf-8",
    env: process.env,
    stdio: "pipe",
    cwd
  });

  return result.stdout.toString().trim();
}

export interface Project {
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: [];
}

export interface Workspace {
  [project: string]: Project;
}

export interface NpmDep {
  name: string;
  dependencies: {
    [p: string]: {};
  };
}

export function npmList(path: string): NpmDep {
  return JSON.parse(run("npm list --json --silent", path)) as NpmDep;
}

export function yarnWorkspaceInfo(): Workspace {
  return JSON.parse(
    JSON.parse(run("yarn workspaces info --json"))["data"]
  ) as Workspace;
}

export function changedFiles(): string[] {
  return run("git diff --name-only master").split("\n");
}

export function gitRoot(): string {
  return run("git rev-parse --show-toplevel");
}
