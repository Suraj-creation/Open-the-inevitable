// Conventional Commits enforcement (commitlint). Scopes map to package/domain names.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "protocols",
        "kernel",
        "events",
        "runtime",
        "observability",
        "governance",
        "memory",
        "orchestration",
        "scheduler",
        "contracts",
        "shared",
        "tooling",
        "spec",
        "repo",
        "ci",
        "deps",
      ],
    ],
  },
};
