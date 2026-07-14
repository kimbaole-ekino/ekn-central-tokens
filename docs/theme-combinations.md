# Theme contexts and permutations

Central derives contexts entirely from canonical `$themes`. For each distinct group, it chooses exactly one Theme and builds the Cartesian product. A one-group Light/Dark document creates two contexts. Two groups with two Themes each create four.

Group order is deterministic: scan `$themes` from top to bottom and retain the first appearance of each group. Context Theme lists, output IDs, nested path segments, and manifest Theme arrays all use this order.

## Safety ceiling

The internal `MAX_THEME_PERMUTATIONS` is 20. It is deliberately not configurable per project. Exceeding it fails the build with the project ID and limit before artifacts are generated. This catches accidental combinatorial growth while keeping design ownership in the canonical file.

## Canonical validation

The shared validator rejects missing/duplicate Theme IDs, invalid groups or Set states, multiple choices for one group in an active context, and contexts that cannot resolve. Stable Theme IDs drive identity; display names drive normalized artifact names and are separately checked for path collisions.

## Plugin feature flag versus central capability

Token Architect currently has `ENABLE_THEME_GROUP = false`, so designers normally author a single `Default` group and one active Theme. Central remains group-capable because the canonical schema is group-capable and existing documents may contain multiple groups. This does not justify restoring project-level Theme configuration.
