# looking-glass

> A mirror for code. Visual PR review via Playwright captures and multimodal LLM critique.

`looking-glass` is a composite GitHub Action that turns every pull request into a markdown design review. It walks your dev deploy, takes desktop + mobile screenshots, asks a multimodal LLM what it sees, then grades the page against a design rubric you control. The output is an artefact (and optional PR comment) shaped like a design crit, not a stack trace.

## Why

Most CI gives you green ticks. Looking-glass gives you a second opinion. It is the bit of the team that points at a screen and says "the CTA is hiding, the rhythm is off, the mobile layout is sad". It is soft-fail by default; it never blocks merges, it just leaves notes.

## What it does (v0.3)

Three jobs are planned. Today, two ship:

1. **Caption** - what is on this screen, written like a sighted human describing it to a friend.
2. **Critique** - how this screen scores against the rubric, with a verdict and concrete suggestions.
3. **Explain** - coming in v0.5 (BDD scenarios from captures + repo context).

BDD generation lands in v0.4. v0.3 is captions + critique only.

## Quick start

Three steps. Copy, paste, ship.

> ## Required permissions
>
> `gh models run` calls require `models: read` on the workflow's `GITHUB_TOKEN`. Add to your workflow:
>
> ```yaml
> permissions:
>   contents: read
>   pull-requests: write
>   models: read
> ```
>
> Without it, captions and critique will return 401 and the comment will degrade to screenshots-only.

**1. Drop the rubric** in your repo root as `design-rubric.yml`:

```yaml
brand:
  voice: "playful, confident"
visual:
  rules:
    - "consistent 8px spacing rhythm"
    - "primary action visible above the fold"
primaryActions:
  home: "Start building"
```

Full example: [`examples/design-rubric.example.yml`](examples/design-rubric.example.yml).

**2. Drop the workflow** at `.github/workflows/looking-glass.yml`:

```yaml
name: looking-glass
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
  models: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: WaywardHayward/looking-glass@v0.3.0
        with:
          base-url: https://dev.example.com
          routes: |
            [{"slug":"home","url":"/","label":"Home"}]
          gh-token: ${{ secrets.GITHUB_TOKEN }}
```

Full example: [`examples/workflow.example.yml`](examples/workflow.example.yml).

**3. Open a PR.** The action attaches a markdown artefact called `looking-glass-review.md` and (by default) posts a sticky PR comment with the summary.

## Inputs

| Name | Required | Default | Description |
|---|---|---|---|
| `base-url` | yes | - | URL Playwright visits (e.g. dev deploy URL). |
| `routes` | yes | - | JSON array of routes: `[{slug,url,label}]`. |
| `viewports` | no | desktop + mobile | JSON array of viewports. |
| `rubric-path` | no | `design-rubric.yml` | Path to rubric in consumer repo. |
| `captions` | no | `true` | Run caption job. |
| `critique` | no | `true` | Run critique job. |
| `model` | no | auto | LLM model id. Auto-selects per transport. |
| `pr-comment` | no | `true` | Post / update PR comment. |
| `gh-token` | yes | - | `GITHUB_TOKEN` with PR write scope. |

## Outputs

| Name | Description |
|---|---|
| `artefact-path` | Absolute path to the markdown artefact. |
| `summary` | Short summary text (good for step summaries). |
| `status` | `ok`, `partial`, or `error`. |

## Rubric

A rubric is YAML, every section optional. See [`examples/design-rubric.example.yml`](examples/design-rubric.example.yml). The loader is forgiving: missing sections fall back to sensible defaults; malformed YAML throws loudly.

Top-level keys:
- `brand` - voice and tone.
- `visual.rules` - list of bullet rules the critic must check.
- `primaryActions` - map slug to the call-to-action the user should be able to perform.
- `journeys` - multi-page flows with expectations.

## Adding a new route

Add an entry to the `routes` input:

```yaml
routes: |
  [
    {"slug":"home","url":"/","label":"Home"},
    {"slug":"pricing","url":"/pricing","label":"Pricing"}
  ]
```

Then optionally add a `primaryActions.pricing` entry to your rubric so the critic knows what success looks like on that page.

## Transport auto-detect

Looking-glass picks its LLM transport from the environment:

- In GitHub Actions (`GITHUB_ACTIONS=true`): uses `gh models run` via the GitHub CLI. The default model is set in `src/transport/payload.mjs`.
- Locally: uses the OpenClaw `model` CLI for development on a paired host.

Override either with the `model` input, or by setting the env var the underlying transport expects.

## Soft-fail by design

The action never returns a non-zero exit on a critique failure. Captures and partial results are always attached. The only thing that fails the job is a hard error in the capture pipeline (network, browser launch, missing token). This keeps the action friendly for design-curious PRs without blocking shipping.

## Limitations

- v0.3 only ships captions + critique. BDD scenarios (job 3) land in v0.4.
- `gh models run` image-attachment support is assumed; verify in your runner if you see model errors about missing image input.
- One artefact per run; no historical diffing yet.
- Playwright is a peer dependency; consumers must let `setup-node` install it (or pin it in their workflow).

## Roadmap

- **v0.4** - BDD scenario generation (job 3).
- **v0.5** - "Explain" job: contextual rationale tying captures back to repo code.
- **v0.6** - Visual diff against base ref.
- **Later** - rubric linting, accessibility heuristics, screenshot redaction.

## Development

```bash
npm install
npm test
```

Tests are colocated under `tests/` and follow VIE (Value, Interaction, Edge). Files are capped at 200 lines; see [`AGENTS.md`](AGENTS.md) for the full code-quality standards.

## License

MIT. See `package.json`.
