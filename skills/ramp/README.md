# RAMP-owned portable skills

A portable RAMP skill lives at `skills/ramp/<name>/`. Each skill directory
requires `SKILL.md` followed by adjacent `skill.yaml` metadata. The metadata
uses the `ramp-skill-v1` contract and contains no `ownerPack`; `ownerPack` is
forbidden for a repository-owned skill.

Exact upstream content does not belong here. Its repository, immutable
commit, file closure, license, and notice provenance belong in
`dependencies/skills.sources.yaml` and `dependencies/skills.lock.yaml`.

A pack-local override remains under `packs/<pack-id>/skills/<name>/` and uses
the same schema with `ownerPack: <pack-id>`. Moving any existing skill into
this directory is deferred to the pilot-provenance checkpoint, after every
supported installer follows the same verified precedence.

Normal installation may copy a portable skill into a customer repository but
never deploys an ATX custom agent.
