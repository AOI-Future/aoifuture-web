# AI Agent Security Sample Evidence — Deliberately Failing Demo

This output-only package demonstrates the evidence format produced by the AI-Agent Security Verification Kit.

## Scope

- Target: the Kit's bundled, deliberately insecure example configuration
- Result: 21 checks — 4 PASS / 16 FAIL / 1 SKIP / 0 ERROR
- Customer environment: none
- Input configuration: not included in this public output package

Because the input configuration is not distributed here, this package demonstrates result structure, traceability, and artifact integrity; it is not a reproducibility bundle. The included configuration locator is meaningful only inside the Kit's bundled example tree.

## Included artifacts

- `sample-verification-fail.json` — canonical machine-readable result
- `sample-verification-fail.pdf` — two-page human-readable report
- `sample-verification-fail.manifest.json` — JSON digest and timestamp metadata
- `sample-verification-fail.tsr` — RFC 3161 timestamp response

Each result has a unique test ID and maps to a current Field Manual requirement and threat class. Examples include:

- `VT-S-012B-002 → REQ-012 → TH-02` — sandboxed code execution
- `VT-S-015A-003 → REQ-015 → TH-02` — concrete-effect approval for a high-impact tool
- `VT-S-022 → REQ-022 → TH-04` — policy-controlled, provenance-tagged, privileged, reversible memory writes
- `VT-S-050D-001 → REQ-050 → TH-07` — MCP definition hash, change detection, and re-review gate

`VT-S-003D` is SKIP because the bundled target does not select EMA. The Field Manual does not require EMA specifically; another JIT/gateway mechanism may satisfy REQ-003.

## Integrity verification

Canonical JSON SHA-256:

`2df559f00240917ed97ecdb35a8b1e6f4482e62bacc750314b5b466c5384624f`

The RFC 3161 response was granted at `2026-07-16 03:21:03 UTC`. Its SHA-256 message imprint matches the canonical JSON digest. Independent verification still requires a trusted TSA CA certificate:

```sh
openssl ts -verify   -data sample-verification-fail.json   -in sample-verification-fail.tsr   -CAfile freetsa-cacert.pem
```

## Limits

This is not a customer assessment, a certificate that an AI agent is secure, a complete security evaluation, or a guarantee that a particular auditor, regulator, customer, or assurance framework will accept the artifacts. A timestamp verifies artifact integrity and time; it does not prove that the test design, scope, or source configuration is correct.

Reference and walkthrough: https://aoifuture.com/agent-security/evidence-demo/
