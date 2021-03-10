#!/usr/bin/env node

import {
  changedFiles,
  filesInCurrent,
  filesInStaged,
  gitRoot,
  NpmDep,
  npmList,
  Project,
  run,
  yarnWorkspaceInfo
} from "./tools";
import Bottleneck from "bottleneck";
import * as fs from "fs";

const program = require("commander");

interface Args {
  verbose: boolean;
  tag: string;
  config: string;
  parallelism: number;
  staged: boolean;
  noTransitive: boolean;
  currentCommit: boolean;
  listCommand: string;
}

program
  .option("-v, --verbose", "Write verbose to stderr")
  .option(
    "-t, --tag <tag>",
    "Compare to tag (master, HEAD~1, sha, etc)",
    "master"
  )
  .option(
    "--staged",
    "Only use currently staged files (files added with git add)"
  )
  .option("--listCommand", "Command to execute to get set of changed files")
  .option("--currentCommit", "Only use files in the current commit")
  .option("--noTransitive", "Dont follow transitive dependencies")
  .option(
    "-c, --config <config>",
    "Path to config. If not specified will try and find one at .ytools.js",
    `${process.cwd()}/.ytools.js`
  )
  .option(
    "-p, --parallelism <parallelism>",
    "Parallelism factor (number of projects to process at once)",
    5
  )
  .parse(process.argv);

const opts = program.opts() as Args;

function log(msg: string) {
  if (opts.verbose) {
    console.error(msg);
  }
}

function complete(result: {
  [p: string]: { name: string; path: string };
}): never {
  console.log(JSON.stringify(result));
  return process.exit(0);
}

function getChanged(flags: Args): string[] {
  if (flags.listCommand) {
    return run(flags.listCommand).split("\n");
  }

  if (flags.currentCommit) {
    return filesInCurrent();
  }

  if (flags.staged) {
    return filesInStaged();
  }

  return changedFiles(flags.tag);
}

async function detect() {
  let config = {
    requiredFiles: [/^[a-z0-9]+\.(json|lock)$/i],
    root: gitRoot()
  };

  const configPath = opts.config;

  if (fs.existsSync(configPath)) {
    log("Found config path of " + configPath);
    config = Object.assign({}, config, require(configPath));
  }

  const workspace = yarnWorkspaceInfo(config.root);

  log(`Checking changes files from current to ${opts.tag}`);

  let changed = getChanged(opts);

  const result: { [name: string]: { name: string; path: string } } = {};

  const alwaysBuildFiles = changed.filter(x =>
    config.requiredFiles.find(y => x.match(y))
  );
  if (alwaysBuildFiles.length > 0) {
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

  const root = config.root ?? gitRoot();

  const workspaceArray: (Project & { name: string })[] = [];

  // limit the number of npm processes we spin up
  const limiter = new Bottleneck({
    maxConcurrent: opts.parallelism
  });

  // for all folders in the workspace find their dependencies
  await Promise.all(
    Object.keys(workspace).map(async project => {
      const workspaceInfo = workspace[project];
      const location = workspaceInfo.location;

      workspaceArray.push({ ...workspaceInfo, name: project });

      if (!opts.noTransitive) {
        // get all the dependencies of this project
        const deps = await limiter.schedule(() => {
          log(`processing ${project}...`);

          return npmList(`${root}/${location}`).catch(e => {
            console.error(`Failed processing ${root}/${location}`, e);
            throw e;
          });
        });

        allDependencies.set(project, deps);
      }
    })
  );

  // go by the longest location first
  workspaceArray.sort((a, b) => b.location.length - a.location.length);

  log("File locations:");
  for (let project of workspaceArray) {
    for (let changedFile of changed) {
      // find the changed file in the deepest location first
      if (changedFile.indexOf(project.location) === 0) {
        dirtyProjects.add(project.name);

        // if we found it, we've consumed that file so remove it
        changed = changed.filter(x => x != changedFile);
        log(`  -> ${project.location}: ${changedFile}`);
      }
    }
  }

  // no files in the repo are related to a project
  if (dirtyProjects.size === 0) {
    console.log(JSON.stringify({}));
    process.exit(0);
  }

  log(
    `Dirty projects by default: ${Array.from(dirtyProjects.values()).join(
      ", "
    )}`
  );

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

          // we've already added this project, no need to add it twice
          break;
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
