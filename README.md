# ytools
Yarn workspace tools.  Detects which projects in a workspace have changed given staged files from master.  Why?  If you have a large monorepo running all your tests/linting/etc on every project for each change is wasteful.  Better to leverage the tools that yarn and npm already expose (such as listing your workspace metadata and getting your dependencies) to detect which workspace packages have changed (along with their transitive dependencies) and only run your tooling on that.

`ytools` exposes exactly this glue.  You can use the resulting json from `stdout` (logging is to `stderr`) to conditionally run tests, linting, any other phases you want.  You can easily format the result to pipe to `wsrun` which accepts a repeated list of `-p` flags indicating which packages to run against.  

# install

```
yarn install yarn-workspace-tools
```

# run

```
ytools
```

To add logging (to `stderr`) use the `-v` flag.  

To pipe directly into pretty formatted json pipe into [jq](https://stedolan.github.io/jq/):

```
ytools -v | jq
```

Returns json of the format:
```
{
  "dependency": {
    "name": "dependency",
    "path": "packages/... path"
  },
  "dependency2": {
    "name": "dependency2",
    "path": "packages/... path"
  }
}
```

Of workspace packages that have changed against master

# Configuration

Configure files that always trigger everything to build (like root package.json, etc) with:


```
// .ytools.js

module.exports = {
    // regular expressions to match
    requiredFiles: [".*"]
}
```

By default `*.json`, `*.lock` at the root will always trigger a full workspace result
