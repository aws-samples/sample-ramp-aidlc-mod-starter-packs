# Report Locations & CI Artifacts

Where GitLab keeps vulnerability reports, and how to fetch them without guessing paths. Use at intake to hand JSON to `vulnerability-triage`.

## Where reports live

1. **CI job artifacts** — the security scanners run as CI jobs and upload JSON reports as artifacts:
   - `gl-dependency-scanning-report.json`
   - `gl-sast-report.json`
   - `gl-container-scanning-report.json`
   - `gl-secret-detection-report.json`
   - (newer) `gl-sbom-*.cdx.json` (CycloneDX)
   These are declared as `artifacts:reports:<type>` in `.gitlab-ci.yml`. The raw JSON lives with the job that produced it.

2. **Vulnerability Report / Security Dashboard** — GitLab ingests those artifacts into an aggregated, deduplicated project view (Secure → Vulnerability report). Good for the merged state; the raw JSON is still the artifact.

3. **Committed / attached** — occasionally a report is committed to the repo or attached to an issue/MR. Check before assuming CI.

## Fetch via `glab`

```bash
glab auth status                                  # confirm auth first

# Find the latest pipeline / relevant job
glab ci list
glab ci get -p <pipeline-id>

# Download artifacts from a job (writes them to cwd)
glab ci artifact <ref> <job-name>                 # e.g. glab ci artifact main dependency_scanning
```
The exact job name comes from `.gitlab-ci.yml` (often `dependency_scanning`, `sast`, `container_scanning`, `secret_detection` from the GitLab-managed templates).

## Fetch via REST API

Artifacts by job:
```bash
# Latest artifact archive for a job on a ref:
curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API_URL/projects/<id>/jobs/artifacts/<ref>/download?job=<job-name>" -o artifacts.zip

# A single artifact file from a specific job:
curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API_URL/projects/<id>/jobs/<job-id>/artifacts/gl-dependency-scanning-report.json" \
  -o gl-dependency-scanning-report.json
```
- `<id>` is the numeric project id or URL-encoded `group%2Fproject`.
- `$GITLAB_API_URL` e.g. `https://gitlab.com/api/v4` (or your self-managed host).

Find recent pipelines/jobs to get `<job-id>`:
```bash
curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$GITLAB_API_URL/projects/<id>/pipelines?ref=main&per_page=5"
curl --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$GITLAB_API_URL/projects/<id>/pipelines/<pipeline-id>/jobs"
```

## Fetch via GitLab MCP

If the pack's GitLab MCP is enabled, use its repository/CI tools to list pipelines/jobs and download the artifact, rather than shelling out. Prefer this when available — it keeps auth in the MCP config.

## Which ref to pull from

- Default branch (`main`/`master`) reflects the current shipping state — usually what you want to triage.
- For a fix branch, pull the report generated on that branch to confirm findings cleared (see verification).

## Token scopes

The token needs at least:
- `read_api` (list pipelines/jobs, download artifacts) for intake.
- `api` + `write_repository` to create branches/commits/MRs (delivery).
- Dismissing findings needs Developer/Maintainer role on the project.

Use the **narrowest** scope that works, prefer a project-scoped token, and honor your org's data-egress rules. Never print the token.
