# Theme contexts and combinations

Central reads Theme Groups from canonical `$themes`. It selects one Theme from each group and builds every valid combination.

One group with Light and Dark creates two contexts. Two groups with two Themes each create four contexts.

Group order is stable. Central scans `$themes` from top to bottom and uses the first appearance of each group. Theme lists, output IDs, paths, and manifest data all use this order.

## Validation

The shared validator rejects missing or duplicate Theme IDs, invalid groups, invalid Set states, and invalid contexts. Stable Theme IDs provide identity. Display names provide output names and are checked for path conflicts. Exact Theme semantics belong to the [validator contract](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/packages/token-validator/docs/canonical-document-contract.md).

Token Architect authoring behavior is outside Central scope. See the [Plugin Themes guide](https://github.com/phamtruonghoaithanh-ekino/ekn-design-tokens-personal/blob/main/docs/en/themes-guide.md).
