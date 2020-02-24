import * as child_process from "child_process";
import { spawn } from "child_process";

export function run(command: string, cwd?: string): string {
  const [c, ...args] = command.split(" ");
  const result = child_process.spawnSync(c, args, {
    encoding: "UTF8",
    env: process.env,
    stdio: "pipe",
    cwd
  });

  return result.stdout
    .toString()
    .trim()
    .replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ""
    );
}

export async function asyncRun(command: string, cwd?: string): Promise<string> {
  const [cmd, ...args] = command.split(" ");

  return new Promise<string>((result, reject) => {
    const s = spawn(cmd, args, {
      cwd: cwd,
      stdio: "pipe",
      env: process.env
    });

    // capture outputs in case commands fail
    const stdout: string[] = [];
    const stderr: string[] = [];

    if (s.stdout !== null) {
      s.stdout.on("data", data => {
        stdout.push(data.toString());
      });
    }

    s.on("close", code => {
      result(stdout.join(""));
    });
    s.on("error", e => {
      reject(e);
    });
  });
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

export async function npmList(path: string): Promise<NpmDep> {
  const data = await asyncRun("npm list --json --silent", path);
  return JSON.parse(data) as NpmDep;
}

export function yarnWorkspaceInfo(cwd?: string): Workspace {
  return JSON.parse(run("yarn -s workspaces info json", cwd)) as Workspace;
}

export function changedFiles(): string[] {
  return run("git diff --name-only master").split("\n");
}

export function gitRoot(): string {
  return run("git rev-parse --show-toplevel");
}
