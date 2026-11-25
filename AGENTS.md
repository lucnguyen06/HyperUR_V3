# Project Bootstrap: Spec Kit & Skill Router

Read this file before starting work in this repository.

## 1. Mandatory Workflow: GitHub Spec Kit (Always On)

Every project uses **GitHub Spec Kit** (`specify` CLI — source: `github/spec-kit`) as the primary source of truth for specifications, plans, and tasks.

### Startup Gate
1. Check whether `specify` is installed (`specify --version`). If missing, install via `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`.
2. Check whether `.specify/` exists in the repository root. If missing, initialize Spec Kit before writing feature code:
   ```powershell
   specify init --here --non-interactive --script ps
   ```
   Verify installation with `specify check` if tools or integrations appear missing.
3. For every non-trivial feature, refactor, or architecture change, complete the Spec-Driven sequence in order:
   - **Constitution**: establish or review project principles in `.specify/`.
   - **Specify**: write or update the feature specification (requirements, acceptance criteria, edge cases).
   - **Plan**: produce the technical implementation plan against the spec.
   - **Tasks**: break the plan into ordered, verifiable tasks.
   - **Implement & Verify**: execute tasks against the spec and confirm every acceptance criterion passes.

**Completion criterion for Step 1**: `.specify/` exists and the active task maps to a written spec/plan before production code changes begin.

---

## 2. Project Stack Detection & Skill Selection

Before implementing, inspect repository manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `build.gradle*`, `pom.xml`, `*.sql`, `.github/workflows/`) and the user's request, then select **only** the skills that match the project stack and current task.

- Announce the selected skills in one short line when starting a new project or major task.
- Read each selected skill's `SKILL.md` before applying it.
- Local skill roots:
  - Standalone skills: `~/.gemini/config/skills/<name>/SKILL.md`
  - Plugin skills: `~/.gemini/config/plugins/<plugin>/skills/<name>/SKILL.md`
- If a matched skill is missing locally, consult `SKILLS-SOURCES.md` (in `lucnguyen06/agent-bootstrap`) for full upstream URLs and install commands.

### Skill Routing Matrix

#### A. Universal Engineering (Any Project — Match by Task)
| Trigger / Branch | Skill | Path (under `~/.gemini/config/`) | Source |
| :--- | :--- | :--- | :--- |
| Library/framework docs or API examples | `context7-mcp` | `plugins/context7/skills/context7-mcp/SKILL.md` | `upstash/context7` |
| Stress-test a plan/design before speccing | `grilling` / `grill-me` | `plugins/mattpocock-skills/skills/grilling/SKILL.md` | `mattpocock/skills` |
| Stress-test design + write ADRs & glossary | `grill-with-docs` | `plugins/mattpocock-skills/skills/grill-with-docs/SKILL.md` | `mattpocock/skills` |
| Deep primary-source technical research | `research` | `plugins/mattpocock-skills/skills/research/SKILL.md` | `mattpocock/skills` |
| Terminology, `GLOSSARY.md`, or ADRs | `domain-modeling` | `plugins/mattpocock-skills/skills/domain-modeling/SKILL.md` | `mattpocock/skills` |
| Module boundaries, deep modules, seams | `codebase-design` | `plugins/mattpocock-skills/skills/codebase-design/SKILL.md` | `mattpocock/skills` |
| Architecture audit & deepening report | `improve-codebase-architecture` | `plugins/mattpocock-skills/skills/improve-codebase-architecture/SKILL.md` | `mattpocock/skills` |
| Throwaway prototype to test state/UI | `prototype` | `plugins/mattpocock-skills/skills/prototype/SKILL.md` | `mattpocock/skills` |
| Test-first / red-green-refactor / integration tests | `tdd` | `plugins/mattpocock-skills/skills/tdd/SKILL.md` | `mattpocock/skills` |
| Hard bugs or performance regressions | `diagnosing-bugs` | `plugins/mattpocock-skills/skills/diagnosing-bugs/SKILL.md` | `mattpocock/skills` |
| Review diff against Standards + Spec | `code-review` | `plugins/mattpocock-skills/skills/code-review/SKILL.md` | `mattpocock/skills` |
| Write a Pull Request body | `pr` | `plugins/mattpocock-skills/skills/pr/SKILL.md` | `mattpocock/skills` |
| Multi-session roadmap / issue triage / handoff | `wayfinder` / `triage` / `handoff` | `plugins/mattpocock-skills/skills/<name>/SKILL.md` | `mattpocock/skills` |
| Interactive human-only setup steps | `wizard` | `plugins/mattpocock-skills/skills/wizard/SKILL.md` | `mattpocock/skills` |
| Edit `AGENTS.md`, `CLAUDE.md`, or `SKILL.md` | `writing-for-agents` | `plugins/mattpocock-skills/skills/writing-for-agents/SKILL.md` | `mattpocock/skills` |

*(Additional workflow helpers from `mattpocock/skills` in `plugins/mattpocock-skills/skills/`: `ask-matt`, `setup-matt-pocock-skills`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `to-questionnaire`, `retro`, `teach`, `wait-what`. Keep Spec Kit as the primary spec system when both could apply.)*

#### B. Security & CI/CD (Any Project with Git / Configs / GitHub Actions)
| Trigger / Branch | Skill | Path | Source |
| :--- | :--- | :--- | :--- |
| Security diff review, blast radius, test gaps | `differential-review` | `skills/differential-review/SKILL.md` | `trailofbits/skills` |
| Hardcoded secrets, fail-open flags, prod audit | `insecure-defaults` | `skills/insecure-defaults/SKILL.md` | `trailofbits/skills` |
| Failing GitHub Actions PR checks (`gh`) | `gh-fix-ci` | `skills/gh-fix-ci/SKILL.md` | `openai/skills` |

#### C. Web Frontend, UI/UX & Motion (`package.json`, React/Vue/Next/Nuxt/HTML/CSS)
| Trigger / Branch | Skill | Path | Source |
| :--- | :--- | :--- | :--- |
| Full UI/UX craft, critique, audit, polish, design system (`DESIGN.md`) | `impeccable` | `skills/impeccable/SKILL.md` | `pbakaus/impeccable` |
| Distinctive visual direction & typography for new UI | `frontend-design` | `skills/frontend-design/SKILL.md` | `anthropics/skills` |
| Motion animations (React/Vue/Nuxt/shadcn/Radix/icons) | `animate-ui` | `skills/animate-ui/SKILL.md` | `imskyleen/animate-ui` |
| Web Interface Guidelines & UX/a11y compliance | `web-design-guidelines` | `skills/web-design-guidelines/SKILL.md` | `vercel-labs/agent-skills` |
| Meta Astryx design system (`@astryxdesign/*`, React 19+ UI, or when requested) | `astryx` | `skills/astryx/SKILL.md` | `meta/astryx` |

#### D. Browser Debugging & Web Performance (Chrome DevTools MCP)
| Trigger / Branch | Skill | Path | Source |
| :--- | :--- | :--- | :--- |
| Live web debugging, network, browser automation | `chrome-devtools` | `plugins/chrome-devtools-plugin/skills/chrome-devtools/SKILL.md` | `ChromeDevTools/chrome-devtools-mcp` |
| Accessibility audit (ARIA, focus, keyboard, contrast) | `a11y-debugging` | `plugins/chrome-devtools-plugin/skills/a11y-debugging/SKILL.md` | `ChromeDevTools/chrome-devtools-mcp` |
| Slow page load / Core Web Vitals / LCP | `debug-optimize-lcp` | `plugins/chrome-devtools-plugin/skills/debug-optimize-lcp/SKILL.md` | `ChromeDevTools/chrome-devtools-mcp` |
| Cookies, 401/403 auth redirects, SameSite, consent | `cookie-debugging` | `plugins/chrome-devtools-plugin/skills/cookie-debugging/SKILL.md` | `ChromeDevTools/chrome-devtools-mcp` |
| JS/Node memory leaks, OOM, heap snapshots | `memory-leak-debugging` | `plugins/chrome-devtools-plugin/skills/memory-leak-debugging/SKILL.md` | `ChromeDevTools/chrome-devtools-mcp` |
| Chrome DevTools MCP connection errors | `troubleshooting` | `plugins/chrome-devtools-plugin/skills/troubleshooting/SKILL.md` | `ChromeDevTools/chrome-devtools-mcp` |

#### E. Android, Kotlin & Java (`build.gradle*`, `AndroidManifest.xml`, `pom.xml`)
| Trigger / Branch | Skill | Path | Source |
| :--- | :--- | :--- | :--- |
| Native Android, Material 3, Kotlin/Jetpack Compose | `android-native-dev` | `skills/android-native-dev/SKILL.md` | `MiniMax-AI/skills` |
| `android` CLI for SDK/AVD/device management | `android-cli` | `plugins/android-cli-plugin/skills/SKILL.md` | `antigravity-plugins-official/android-cli-plugin` |
| Render Jetpack Compose `@Preview` functions | `compose-preview` | `plugins/android-cli-plugin/skills/compose-preview/SKILL.md` | `antigravity-plugins-official/android-cli-plugin` |
| Mirror/control AVDs & adb devices | `android-device-hub` | `plugins/android-cli-plugin/skills/device-hub/SKILL.md` | `antigravity-plugins-official/android-cli-plugin` |
| Android Espresso UI instrumentation tests | `espresso-skill` | `skills/espresso-skill/SKILL.md` | `LambdaTest/agent-skills` |
| Java JUnit 5 + Mockito unit/integration tests | `junit-5-skill` | `skills/junit-5-skill/SKILL.md` | `LambdaTest/agent-skills` |

#### F. Python, Rust & SQL
| Trigger / Branch | Skill | Path | Source |
| :--- | :--- | :--- | :--- |
| Python tooling (`uv`, `ruff`, `ty`), scripts, migration | `modern-python` | `skills/modern-python/SKILL.md` | `trailofbits/skills` |
| Idiomatic Rust, borrowing, `Result`, perf, tests | `rust-best-practices` | `skills/rust-best-practices/SKILL.md` | `apollographql/rust-best-practices` |
| SQL queries (PostgreSQL, MySQL, BigQuery), reporting | `sql-queries` | `skills/sql-queries/SKILL.md` | `phuryn/pm-skills` |

---

## 3. Execution Discipline
- Load only the skills matched in Section 2 to keep context focused.
- Keep Spec Kit artifacts in sync with implementation changes.
- Before finishing any task, verify tests/builds pass and run `code-review` or `differential-review` on significant diffs.
