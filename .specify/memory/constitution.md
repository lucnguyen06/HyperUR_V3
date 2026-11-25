# HyperUR V3 Constitution

## Core Principles

### I. Fail-Closed Security by Default
All mutating, administrative, webhook, and bot activation endpoints MUST enforce authentication and fail closed when secrets are unset or set to placeholder values. Never rely on spoofable headers (e.g., `X-Forwarded-For`) for access control, and never expose raw internal exception messages to unauthenticated clients.

### II. Parameterized Queries & Audit Integrity
Every database query taking external or derived input MUST use `mysqli` prepared statements with exact type bindings (`i`/`s`/`d`/`b`). Audit records in `admin_logs` MUST accurately preserve `admin_id` (non-null integer, `0` for system/webhook/bot) and `username` (string).

### III. Idempotent & Amount-Verified Payment Activation
SePay webhook processing MUST verify signature/replay window first, verify minimum payment amount (`SEPAY_MIN_AMOUNT`) BEFORE mutating `registrations` or `serial` to `Active`/`unlimited`, avoid false-positive activation on non-`UR` bank transfers, and remain strictly idempotent on retries and duplicate payments.

### IV. Lightweight Zero-Build Architecture
Preserve the project's pure HTML5/CSS3/Vanilla JS frontend and standard PHP 8.x + MySQL/MariaDB backend with no unnecessary runtime dependencies or breaking changes to existing public APIs and CLI invocations.

### V. Spec & Documentation Alignment
Keep `README.md`, `md/DEVELOPER_ARCHITECTURE.md`, `api/config.example.php`, and E2E test scripts (`scripts/sepay-e2e/`) synchronized with actual codebase behavior.

## Governance
- All non-trivial fixes and features follow the Spec Kit flow: Constitution → Specify → Plan → Tasks → Implement & Verify.
- Every change is verified with automated checks (syntax/tests where available) and reviewed against both Standards and Spec.

**Version**: 1.0.0 | **Ratified**: 2026-11-25 | **Last Amended**: 2026-11-25
