# ytools

Yarn workspace tools. Detects which projects in a workspace have changed given staged files from master. Why? If you have a large monorepo running all your tests/linting/etc on every project for each change is wasteful. Better to leverage the tools that yarn and npm already expose (such as listing your workspace metadata and getting your dependencies) to detect which workspace packages have changed (along with their transitive dependencies) and only run your tooling on that.

`ytools` exposes exactly this glue. You can use the resulting json from `stdout` (logging is to `stderr`) to conditionally run tests, linting, any other phases you want. You can easily format the result to pipe to [`wsrun`](https://github.com/hfour/wsrun) which accepts a repeated list of `-p` flags indicating which packages to run against.

# install

```
yarn install yarn-workspace-tools
```

# run

```
ytools
```

CLI options
```
$ ytools -h
Usage: ytools [options]

Options:
  -v, --verbose                    Write verbose to stderr
  -t, --tag <tag>                  Compare to tag (master, HEAD~1, sha, etc) (default: "master")
  -c, --config <config>            Path to config. If not specified will try and find one at .ytools.js
  -p, --parallelism <parallelism>  Parallelism factor (number of projects to process at once) (default: 5)
  -h, --help                       display help for command
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
    requiredFiles: [".*"],
    root: ""// absolute path to theroot of your project, otherwise the git root is used
}
```

By default `*.json`, `*.lock` at the root will always trigger a full workspace result

# Example

```
#!/usr/bin/env ruby

require 'json'

`yarn install --pure-lockfile --prefer-offline`

wsrun_args = JSON.parse(`npx ytools -v`).keys.map { |x| '-p ' + x }.join(' ')

# compile everything no matter what
`yarn run compile`

# run lint phases for dirty workspace folders
`npx wsrun #{wsrun_args} --fast-exit --exclude-missing --parallel --concurrency 4 lint`

# run test phases for dirty workspace folders
`npx wsrun #{wsrun_args} --fast-exit --exclude-missing --parallel --concurrency 4 test`
```

# Testing

```
yarn compile
cd samples
yarn install
../dist/index.js
```
