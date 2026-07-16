# AI Agent Security Sample Evidence — Deliberately Failing Demo

This output-only package demonstrates the evidence format produced by the AI-Agent Security Verification Kit.

## Scope

- Verification profile: `core-runtime-v1`, a focused subset of the Field Manual — not full conformance
- Target: the Kit's bundled, deliberately insecure example configuration
- Result: 28 checks — 7 PASS / 20 FAIL / 1 SKIP / 0 ERROR
- Result IDs: unique and stable across tool/MCP array reordering
- Customer environment: none
- Input configuration: not included in this public output package

The profile accounts for every Field Manual SHALL requirement as in scope or explicitly out of scope with a reason. `VT-S-054` compares the master matrix with Result objects actually emitted by implemented checks for every in-scope SHALL. Because the input configuration is not distributed here, this package demonstrates result structure, traceability, scope accounting, and artifact integrity; it is not a reproducibility bundle.

## Package contents

Support file:

- `README.md` — this scope, verification, and limitations guide

Evidence artifacts:

- `sample-verification-fail.json` — canonical machine-readable result
- `sample-verification-fail.pdf` — human-readable report
- `sample-verification-fail.manifest.json` — JSON digest and timestamp metadata
- `sample-verification-fail.tsr` — RFC 3161 timestamp response

Representative mappings:

- `VT-S-011-SHELL → REQ-011 → TH-02` — least privilege and input-schema validation
- `VT-S-012B-SHELL → REQ-012 → TH-02` — sandboxed code execution
- `VT-S-015A-WIRE-TRANSFER → REQ-015 → TH-02` — concrete-effect approval
- `VT-S-050D-RANDOM-MCP → REQ-050 → TH-07` — MCP change detection and re-review

`VT-S-003D` is SKIP because the bundled target does not select EMA. The Field Manual does not require EMA specifically; another JIT/gateway mechanism may satisfy REQ-003.

## Integrity verification

Canonical JSON SHA-256:

`5f630a55fabc0732dc01b89f4f89252602f8d8740fa88ef061ad6f62c3523370`

The RFC 3161 response was granted at `2026-07-16 04:30:31 UTC`. Its SHA-256 message imprint matches the canonical JSON digest.

Download the FreeTSA root certificate with the exact filename used below:

```sh
curl -fsSLo freetsa-cacert.pem https://freetsa.org/files/cacert.pem
```

Expected downloaded-file SHA-256:

`2151b61137ffa86bf664691ba67e7da0b19f98c758e3d228d5d8ebf27e044438`

Certificate SHA-256 fingerprint:

`A6:37:9E:7C:EC:C0:5F:AA:3C:BF:07:60:13:D7:45:E3:27:BB:BA:A3:8C:0B:9A:F2:24:69:D4:70:1D:18:AA:BC`

Verify the certificate file before using it, then verify the timestamp:

```sh
shasum -a 256 freetsa-cacert.pem
openssl ts -verify   -data sample-verification-fail.json   -in sample-verification-fail.tsr   -CAfile freetsa-cacert.pem
```

## Limits

This is not a customer assessment, full Field Manual conformance, a certificate that an AI agent is secure, a complete security evaluation, or a guarantee that an auditor, regulator, customer, or assurance framework will accept the artifacts. A timestamp verifies artifact integrity and time; it does not prove that the test design, scope, or source configuration is correct.

Reference and walkthrough: https://aoifuture.com/agent-security/evidence-demo/
