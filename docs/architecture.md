# Architecture

This page describes Central architecture only. Read the [overall product architecture](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/docs/project/architecture.md) for the complete Token Architect, validator, Central, and target system.

## Central boundary

Central receives reviewed canonical `tokens.json`, builds artifacts, and prepares configured target delivery.

Central consumes `@eknvn/token-validator` for Token Set order, Theme states, references, and effective values. The [validator documentation](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/tree/main/packages/token-validator/docs) owns those rules. Central owns project selection, safe paths, Theme combination builds, output names, collision checks, manifests, and delivery plans.

## Build steps

1. Read `projects.config.json` and any project filter.
2. Read raw JSON and reject duplicate keys.
3. Run shared submission validation.
4. For each Theme Group, select one Theme and create all allowed combinations. Group order follows the first group appearance in `$themes`.
5. Use the shared validator to resolve the effective token graph.
6. Use Style Dictionary and Tokens Studio transforms for names and supported type changes.
7. Write CSS, resolved JSON, and `manifest.json` to the project output folder.
8. Check `targets.config.json`, plan only listed file mappings, and prepare a target pull request.

One Theme Group creates flat files. Several Theme Groups create nested paths from selected Theme names.

## Safety rules

Central stops on missing required files, unsafe paths, duplicate project IDs, invalid token data, output path conflicts, CSS name conflicts, missing manifest entries, or overlapping target folders.

The build only removes and recreates a checked project output folder. Delivery only copies file types that have a target mapping.

## Artifact roles

CSS is the target runtime contract. Resolved JSON helps maintainers check final values. `manifest.json` links Theme contexts to files and is used to plan delivery.

Delivery includes only mapped artifact types. A CSS-only mapping keeps resolved JSON and the manifest in Central.

## CSS references

The validator resolves every value to check it. The CSS step then keeps a simple direct reference as `var(--target-name)` when it is safe. Resolved JSON always stores the final value.
