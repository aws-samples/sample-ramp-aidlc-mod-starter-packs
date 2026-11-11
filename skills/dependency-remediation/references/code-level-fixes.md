# Code-Level Fixes (SAST & Secret findings)

Not every finding is a version number. SAST findings and secret-detection findings require a **code or process change** — a dependency bump does nothing. Route these here.

## When this applies

- Triage group category is `sast` (Semgrep et al.) — a vulnerable *pattern* in your own code.
- Triage group category is `secret_detection` — a credential committed to the repo.
- A dependency CVE has **no published fix** and triage chose a code-level workaround (e.g. sanitize input before calling the vulnerable API, or stop using the affected function).

## SAST findings

The fix is to change the flagged code so the weakness (CWE) no longer holds. Common Node.js classes and their fixes:

| CWE / pattern | Typical fix |
|---|---|
| Command injection (`child_process.exec` with input) | Use `execFile`/`spawn` with an args array; never interpolate user input into a shell string |
| SQL injection (string-built queries) | Parameterized queries / prepared statements; use the driver's binding, not concatenation |
| Path traversal (`fs` with user path) | Normalize + validate against an allowlisted base dir; reject `..` |
| Insecure randomness (`Math.random` for tokens) | `crypto.randomBytes` / `crypto.randomUUID` |
| ReDoS (catastrophic regex) | Bound/rewrite the regex; validate input length |
| Hardcoded config / weak crypto | Move to config/secret manager; use vetted algorithms |
| XSS in server-rendered output | Context-aware output encoding; framework auto-escaping |

Process:
1. Read the finding's `location` (`file`, `start_line`) and the CWE/rule id.
2. Understand the data flow — where does untrusted input enter, and how does it reach the sink?
3. Apply the minimal fix that breaks the vulnerable flow (validate/encode/parameterize), preserving behavior.
4. If GitLab flagged it `flagged-as-likely-false-positive`, still record evidence for the disposition — don't dismiss on the flag alone.
5. **Verify:** add or run a test asserting the weakness is closed (e.g. a malicious input is rejected/escaped), then re-run the SAST scan on the branch if available.

Keep the change surgical. A SAST fix that refactors unrelated code widens review and risk.

## Secret-detection findings

A committed secret is compromised the moment it lands in history. The fix is **not** a code edit alone:

1. **Rotate the secret immediately** — revoke and reissue the credential at its source (the vulnerable value must stop working). This is the real fix; everything else is cleanup.
2. **Remove it from the codebase** — replace with a reference to an environment variable or secret manager (e.g. Vault, AWS Secrets Manager / SSM Parameter Store, GitLab CI/CD variables).
3. **Scrub history if required** — if it was committed, the value lives in git history. Rewriting history (`git filter-repo`, BFG) is disruptive on shared branches; treat it as a **high-risk operation requiring explicit human approval**, and coordinate with the team. Rotation (step 1) is what actually protects you; history scrubbing reduces future exposure of the old value.
4. **Prevent recurrence** — add the path to secret-scanning pre-commit hooks / CI.

Never print the secret value in logs, MR descriptions, or the audit trail — reference it by name/location only.

If secret findings are frequent in your reports, this warrants a dedicated `secret-remediation` skill; flag that to the pack owner.

## Handoff

- Code fixes produce a normal diff → `gitlab-mr` raises the MR with the finding id and the "what changed / why safe" note.
- Secret rotations: the MR removes the secret and wires the manager; the **rotation itself happens out-of-band** and must be confirmed done before the finding is closed. Record who rotated and when in the audit log (not the value).
