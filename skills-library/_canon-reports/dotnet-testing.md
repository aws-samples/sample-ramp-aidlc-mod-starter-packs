# dotnet-testing — canonicalization

No external source of truth (absent from agent-plugins and agent-toolkit-for-aws).

Variants (2 copies, 2 versions):
| hash | bytes | packs |
|------|-------|-------|
| 0dc36ff9 | 5680 | cots-rewrite-on-cloudnative |
| 8a2a5937 | 5729 | serverless-event-driven-on-aws |

Only difference: SKILL.md `description`. serverless-event-driven's is a strict
superset (adds "for mobile app tests use mobile-test-automation"). All 5
reference files identical.

**Chosen:** serverless-event-driven-on-aws variant (superset description). 6 files.
