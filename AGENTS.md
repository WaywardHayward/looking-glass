# AGENTS.md

Code-quality contract for `looking-glass`. Every contributor (human or agent) follows these. Reviewers reject PRs that violate them.

## Scope

`looking-glass` is a small composite GitHub Action. The source is intentionally tiny: a capture script, three jobs (caption, critique, render), a transport selector, and a few libs. Keep it that way.

## The 14 standards

1. **No em dashes.** Hyphens only. Rewrite if a hyphen reads worse.
2. **No magic numbers or strings.** Extract constants, enums, or config objects at the top of the file or in a shared module.
3. **DRY.** If the same shape appears twice, extract it. If three classes repeat a pattern, abstract it.
4. **One type per file.** One class, interface, or top-level component per file. Helpers stay private to the file.
5. **Single responsibility.** Each module and function does one thing, named for that thing.
6. **Guard clauses first.** Early return on bad input; never wrap the happy path in nesting.
7. **Multi-guard extraction.** Two or more sequential guards become a `canDoX()` predicate or a `validateX()` helper.
8. **No if-else chains.** Use switch expressions, pattern matching, or polymorphism. A bare `if` is fine; an `else if` ladder is not.
9. **Max 2-3 levels of nesting.** Extract nested logic into well-named helpers.
10. **Try-catch pairs.** If a function body is entirely a try-catch, split it: `tryX()` + `x()`. The caller decides whether to recover.
11. **200 line file ceiling.** Hard cap. Includes blank lines and comments. Refactor before crossing.
12. **Typed schemas / JSDoc.** Use JSDoc `@param` and `@returns` on every exported function. Prefer typed schemas over inline JSON shapes.
13. **VIE tests.** Each module under test gets Value (correct output), Interaction (side effects, calls), and Edge (malformed, empty, throws) coverage.
14. **Inclusive naming.** Follow https://inclusivenaming.org. `main` not `master`. No exclusionary terms.

## Repo conventions

- Source lives under `src/`. No top-level scripts.
- Tests live under `tests/` and end in `.test.mjs`. Run with `npm test`.
- One module per file under `src/lib/` and `src/transport/`.
- ESM only (`"type": "module"`).
- Node 20+. No transpile step.
- No dependencies beyond `yaml` and `playwright` (peer). Add new deps only with strong justification.

## Commit hygiene

- Small, logical commits. Conventional prefixes welcome (`feat:`, `fix:`, `chore:`, `docs:`).
- Push the branch; open a PR. `main` is protected in spirit if not in policy.
- Never commit secrets. `gh-token` is an action input, never a file.

## Test discipline

- Every new module ships with a test file.
- Tests must be deterministic. No network. No real Playwright. Mock at the transport boundary.
- Run `npm test` before every push. Green or it does not merge.

## What this repo will not do

- No BDD generation in v0.3. That is v0.4.
- No "explain" job in v0.3. That is v0.5.
- No wiring into consumer repos from inside this repo. Consumers opt in via their own workflow.
- No telemetry, no analytics, no phone-home.

## When in doubt

Re-read SOUL.md and AGENTS.md in the parent workspace. Be helpful, be honest, be small.
