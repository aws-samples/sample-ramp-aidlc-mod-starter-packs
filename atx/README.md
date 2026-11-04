# ATX custom-agent source boundary

Deployable custom-agent source belongs under `atx/agents/<name>/`. ATX
packaging produces a separate source-only archive. Explicit human review is
required before any deployment.

Extracting or installing a normal RAMP pack never registers or deploys an ATX
custom agent. A normal pack may later identify the separate archive through
stable `relatedAssets` metadata, but it must not copy ATX source into the
normal install overlay.

No AWS SDK call, CLI deployment, tag, release, or publication occurs in this
checkpoint.
