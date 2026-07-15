# Configuration examples

Use these walkthroughs after reading the [project configuration reference](project-configuration.md) and [target delivery reference](target-delivery.md).

## Add a new token project

The configuration entry and canonical file can be created in either order.

1. Use this canonical path in the Plugin:

   ```text
   token-definitions/projects/site-a/tokens.json
   ```

2. Add the matching project to the root `projects.config.json`:

   ```json
   {
     "projects": [
       {
         "id": "site-a",
         "tokenFile": "token-definitions/projects/site-a/tokens.json",
         "outputDir": "dist/site-a"
       }
     ]
   }
   ```

   Preserve other registered projects when editing the array.

3. Until both inputs exist, Central handles either incomplete state safely:

   - Configuration without `tokens.json`: validation, build, and delivery skip the project.
   - `tokens.json` without configuration: Central validates the document but does not build or deliver it.

4. When both inputs exist, validate the project:

   ```sh
   npm run validate:tokens -- --project=site-a
   ```

5. Build artifacts:

   ```sh
   npm run build:artifacts -- --project=site-a
   ```

6. Inspect `dist/site-a/`. Verify the CSS, resolved JSON, root `manifest.json`, normalized Theme names, and expected flat or nested path structure. Remember that the next build removes and recreates this directory.

Do not add a placeholder token document. The Plugin creates canonical `tokens.json`; Central configuration defines its location, output, and delivery.

## Deliver a project to a target repository

1. Add a target to the root `targets.config.json`:

   ```json
   {
     "targets": [
       {
         "project": "site-a",
         "repo": "https://github.com/example/site-a.git",
         "branch": "main",
         "source": "dist/site-a",
         "destination": {
           "css": "src/styles/generated-tokens"
         },
         "delivery": {
           "provider": "github",
           "branchPrefix": "tokens/",
           "labels": ["design-tokens"]
         }
       }
     ]
   }
   ```

   Preserve other targets when editing the array.

2. Confirm that `project` exactly matches `projects.config.json.projects[].id`.

3. Confirm that `source` exactly matches that project's `outputDir`.

4. Choose a `destination.css` containing generated files only. Apply delivery deletes and recreates it.

5. Validate and build, then run a project-specific dry-run:

   ```sh
   npm run validate:tokens -- --project=site-a
   npm run build:artifacts -- --project=site-a
   npm run delivery:target-mr -- --project=site-a
   ```

6. Review the reported repository, base branch, delivery branch, and source-to-destination mapping. Compare the manifest paths with the files under `dist/site-a/` to verify the copied layout.

7. Run apply mode only after reviewing the dry-run. Supply a GitHub token with access to the target repository:

   ```sh
   GH_TOKEN=... npm run delivery:target-mr -- --project=site-a --apply
   ```

   Central creates or updates a pull request. The target maintainer remains responsible for review and merge.
