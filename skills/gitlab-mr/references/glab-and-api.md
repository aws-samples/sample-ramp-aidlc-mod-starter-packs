# glab CLI & REST API — Branches, Commits, MRs

Command sequences to create a branch, commit the fix, and raise the MR. Use `glab` when installed/authenticated; fall back to the REST API with `curl`. Prefer the GitLab MCP tools when the pack's MCP is enabled.

## Auth check (always first)

```bash
glab auth status                 # glab path
# or confirm a token exists for the API path (do not echo it):
[ -n "$GITLAB_TOKEN" ] && echo "token present"
```

## Branch + commit via local git (simplest when you have a clone)

```bash
git checkout -b security/CVE-2021-23337-lodash
# apply the fix (npm install <pkg>@<target>, or overrides + npm install, or code edit)
git add package.json package-lock.json           # + any code files for code fixes
git commit -m "fix(deps): bump lodash 4.17.19 → 4.17.21 (CVE-2021-23337)"
git push -u origin security/CVE-2021-23337-lodash
```
Do **not** push to `main`/`master`. Push the feature branch and open an MR from it.

## Raise the MR via glab

```bash
glab mr create \
  --source-branch security/CVE-2021-23337-lodash \
  --target-branch main \
  --title "security: fix CVE-2021-23337 (lodash prototype pollution)" \
  --description "$(cat mr-body.md)" \
  --label security --label dependencies \
  --remove-source-branch
```
- Put the full templated body (references/mr-templates.md) in `mr-body.md`.
- Add reviewers with `--reviewer <user>` per project convention.

## REST API path (no clone / no glab)

Create a branch:
```bash
curl --request POST --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API_URL/projects/<id>/repository/branches?branch=security/CVE-2021-23337-lodash&ref=main"
```

Commit file changes (multiple files in one commit) via the Commits API:
```bash
curl --request POST --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  "$GITLAB_API_URL/projects/<id>/repository/commits" \
  --data '{
    "branch": "security/CVE-2021-23337-lodash",
    "commit_message": "fix(deps): bump lodash 4.17.19 → 4.17.21 (CVE-2021-23337)",
    "actions": [
      { "action": "update", "file_path": "package.json",      "content": "<full new contents>" },
      { "action": "update", "file_path": "package-lock.json", "content": "<full new contents>" }
    ]
  }'
```
Note: the Commits API sends **full file contents** per action (not a diff). For large lockfiles this is heavy — pushing via git is usually better; use the API path only when you can't clone.

Open the MR:
```bash
curl --request POST --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  "$GITLAB_API_URL/projects/<id>/merge_requests" \
  --data '{
    "source_branch": "security/CVE-2021-23337-lodash",
    "target_branch": "main",
    "title": "security: fix CVE-2021-23337 (lodash prototype pollution)",
    "description": "<templated MR body>",
    "labels": "security,dependencies",
    "remove_source_branch": true
  }'
```

## Batched MR

Same flow, one branch (`security/<report-id>-batch-p1`), multiple commits (one per group so history stays traceable), and an MR body that lists every included group. Keep a batch to one risk class.

## Notes

- Numeric project id or URL-encoded path (`group%2Fsubgroup%2Fproject`) both work as `<id>`.
- Respect required approval rules / protected-branch settings — the MR waits for approvals; don't attempt to bypass them.
- If CI runs the security scan on MRs, let it re-scan the branch to confirm the finding cleared (verification loop).
