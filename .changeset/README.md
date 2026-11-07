# Changesets

Every PR that changes a published package should include a changeset:

```sh
npx changeset
```

Pick the packages, the bump type (patch / minor / major) and write a one-line summary.
On merge to `main`, the release workflow opens a "Version Packages" PR; merging that PR publishes to npm.
