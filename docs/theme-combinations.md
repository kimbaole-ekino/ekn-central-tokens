# Theme contexts and combinations

Central reads Theme Groups from canonical `$themes`. It selects one Theme from each group and builds every valid combination.

One group with Light and Dark creates two contexts. Two groups with two Themes each create four contexts.

Group order is stable. Central scans `$themes` from top to bottom and uses the first appearance of each group. Theme lists, output IDs, paths, and manifest data all use this order.

## Build limit

Central allows at most 20 Theme combinations. This limit is not a project setting. If a document creates more, the build stops before writing artifacts and shows the project ID and limit.

## Validation

The shared validator rejects missing or duplicate Theme IDs, invalid groups, invalid Set states, and invalid contexts. Stable Theme IDs provide identity. Display names provide output names and are checked for path conflicts.

## Current Plugin behavior

Token Architect currently has `ENABLE_THEME_GROUP = false`. Designers normally create Themes in one hidden `Default` group and use one active Theme. Central still supports valid canonical files with several groups.
