# Wave 3 Checkpoint 5 — live JavaScript review

## Current verdict

The standalone JavaScript manifest and installer renderers are approved in
their current form. Final Checkpoint 5 approval remains pending because bundle
and README integration had not landed when this review snapshot was taken.

## Reviewed

- `installer/src/release/install-manifest.js`
- `installer/src/release/installers.js`
- `installer/test/install-manifest.test.js`
- the current Checkpoint 5 implementation brief
- the existing Checkpoint 4 bundle/input-closure contract

## Findings closed during implementation

The first live review found:

- no aggregate bundle-byte bound;
- an O(n²) prefix-collision scan at the 16,384-entry limit;
- acceptance of unknown model/file fields;
- acceptance of the reserved `.origins` ownership key;
- acceptance of template strings instead of authenticated captured bytes; and
- non-fatal UTF-8 decoding.

The current implementation closes all six:

- total payload bytes are bounded by `RELEASE_LIMITS.bundleBytes`;
- sorted-adjacent prefix checking is O(n);
- exact model/file/template fields are enforced;
- dot-prefixed ownership state names are reserved;
- pack version text is validated as SemVer;
- templates must be `Buffer` values and use fatal UTF-8 decoding; and
- CRLF template ambiguity is rejected.

## Current contract assessment

- Manifest metadata and file rows are deterministic and LF-terminated.
- Only authenticated `overlay/` entries become install records.
- Paths reuse the release-grade portable path validator.
- Checksums are recomputed from captured bytes; optional declared checksums
  must match.
- Only full regular-file source modes `0o100644` and `0o100755` are accepted,
  rendered as canonical `0644` and `0755`.
- Duplicate, ASCII case-fold, and file/directory-prefix collisions fail.
- Inputs are not mutated.
- Installer rendering requires the exact five-field model and exact two
  captured templates.
- Each layout placeholder must occur exactly once and no generated placeholder
  may remain.
- Replacement values are restricted to safe portable single-segment names, so
  JavaScript replacement-string expansion cannot inject shell content.

`npm test --prefix installer -- test/install-manifest.test.js` passed all
17 tests during the live review.

## Final integration checks still required

Re-run this review after product integration lands and require:

1. all four new generator/template files are included in
   `RELEASE_GENERATOR_FILES`;
2. the exact template bytes used by `renderInstallers()` are the bytes recorded
   in `consumedInputs`, with no late filesystem reread;
3. bundle entries include `install-files.tsv` (`100644`), `install.sh`
   (`100755`), and `install.ps1` (`100644`);
4. `install-files.tsv` is derived from the already captured `overlayEntries`,
   authenticated artifact name, ownership key, and pack version;
5. `bundle-manifest.json.files` remains overlay-only;
6. `SHA256SUMS` covers the three generated helper entries but not itself;
7. exact layout and defensive-copy behavior remain intact;
8. README guidance advertises both helpers, retains manual-copy guidance, and
   does not claim that the bundle lacks an installer;
9. builds remain byte-identical across cwd/locale/timezone/root changes; and
10. no generator, template, or helper path escapes the declared Checkpoint 5
    product boundary.
