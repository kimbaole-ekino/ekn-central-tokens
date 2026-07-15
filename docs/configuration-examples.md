# Configuration examples

Read the [project configuration reference](project-configuration.md) and [target delivery reference](target-delivery.md) for all field rules.

## Add a token project

The config entry and `tokens.json` can be added in either order.

1. Use this canonical path in Token Architect:

   ```text
   token-definitions/projects/site-a/tokens.json
   ```

2. Add the project to `projects.config.json`:

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

   Keep all other project entries.

3. Central handles incomplete setup safely:

   - Config without `tokens.json`: skip validation for that project, build, and delivery.
   - `tokens.json` without config: validate the file, but do not build or deliver it.

4. When both files exist, run:

   ```sh
   npm run validate:tokens -- --project=site-a
   npm run build:artifacts -- --project=site-a
   ```

5. Check `dist/site-a/`. Review CSS, resolved JSON, `manifest.json`, Theme names, and flat or nested paths. The next build replaces this full folder.

Do not add fake token data. Token Architect creates the canonical file. Central only sets its path, output folder, and delivery.

## Deliver a project

1. Add a target to `targets.config.json`:

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

2. Make sure `project` matches a project ID.
3. Make sure `source` matches that project's `outputDir`.
4. Use a CSS destination that contains generated files only. Apply mode deletes and recreates it.
5. Run validation, build, and dry-run:

   ```sh
   npm run validate:tokens -- --project=site-a
   npm run build:artifacts -- --project=site-a
   npm run delivery:target-mr -- --project=site-a
   ```

6. Check the repository, base branch, delivery branch, and file mapping. Compare the manifest with the built files.
7. Use apply mode only after approval:

   ```sh
   GH_TOKEN=... npm run delivery:target-mr -- --project=site-a --apply
   ```

Central creates or updates a pull request. The target maintainer reviews and merges it.
