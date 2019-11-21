#!/usr/bin/env node

import {
  changedFiles,
  gitRoot,
  NpmDep,
  npmList,
  yarnWorkspaceInfo
} from "./tools";

function log(msg: string) {
  if (process.argv.find(x => x === "-v")) {
    console.error(msg);
  }
}

async function detect() {
  const workspace = yarnWorkspaceInfo();

  const changed = changedFiles();

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

  const result: { [name: string]: { name: string; path: string } } = {};

  for (let p of dirtyProjects) {
    for (let project in workspace) {
      const wp = workspace[project];
      if (p === project) {
        result[p] = { name: p, path: wp.location };
        break;
      }
    }
  }
  console.log(JSON.stringify(result));
}

detect();
