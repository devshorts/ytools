#!/usr/bin/env node

import {
  changedFiles,
  gitRoot,
  NpmDep,
  npmList,
  yarnWorkspaceInfo
} from "./tools";
import * as fs from "fs";

function log(msg: string) {
  if (process.argv.find(x => x === "-v")) {
    console.error(msg);
  }
}

function complete(result: {
  [p: string]: { name: string; path: string };
}): never {
  console.log(JSON.stringify(result));
  return process.exit(0);
}

async function detect() {
  const workspace = yarnWorkspaceInfo();

  const changed = changedFiles();

  const cwd = process.cwd();

  const configPath = `${cwd}/.ytools.js`;

  const result: { [name: string]: { name: string; path: string } } = {};

  let config = {
    requiredFiles: [".*\.json", ".*\.lock"]
  };

  if (fs.existsSync(configPath)) {
    log("Found config path of " + configPath);
    config = require(configPath);
  }

  const alwaysBuildFiles = changed.filter(x =>
    config.requiredFiles.find(y => x.match(y))
  );
  if (alwaysBuildFiles) {
    log(
      `Detected always build file changes, assuming whole workspace is dirty: \n${alwaysBuildFiles.join(
        "\n"
      )}`
    );

    for (let project in workspace) {
      const wp = workspace[project];
      result[project] = { name: project, path: wp.location };
    }
    return complete(result);
  }

  const dirtyProjects = new Set<string>();

  const allDependencies = new Map<string, NpmDep>();

  const root = gitRoot();

  await Promise.all(
    Object.keys(workspace).map(async project => {
      const workspaceInfo = workspace[project];
      const location = workspaceInfo.location;

      log(`processing ${project}...`);

      // get all the dependencies of this project
      const deps = await npmList(`${root}/${location}`);

      allDependencies.set(project, deps);

      for (let changedFile of changed) {
        if (changedFile.indexOf(location) === 0) {
          dirtyProjects.add(project);
        }
      }
    })
  );

  // no files in the repo are related to a project
  if (dirtyProjects.size === 0) {
    console.log(JSON.stringify({}));
    process.exit(0);
  }

  log(`Dirty projects: ${Array.from(dirtyProjects.values()).join(", ")}`);

  // find dirty projects
  let found = false;
  do {
    found = false;
    // find who in the workspace depends on the dirty, and who depends on them
    for (let project in workspace) {
      // already processed
      if (dirtyProjects.has(project)) {
        continue;
      }

      // get this projects dependencies
      const deps = allDependencies.get(project);
      if (!deps || !deps.dependencies) {
        continue;
      }

      const dependentProjects = Object.keys(deps.dependencies);

      // for all dirty projects, see if this project's dependencies are involved
      for (let dirty of dirtyProjects) {
        if (dependentProjects.find(x => x === dirty)) {
          found = true;
          // if its impliciated in the tree, its dirty too
          log(`  -> Marking ${project} dirty because it depends on ${dirty}`);

          dirtyProjects.add(project);
        }
      }
    }
    // repeat with all not already marked projects
  } while (found);

  for (let p of dirtyProjects) {
    for (let project in workspace) {
      const wp = workspace[project];
      if (p === project) {
        result[p] = { name: p, path: wp.location };
        break;
      }
    }
  }

  return complete(result);
}

detect();
