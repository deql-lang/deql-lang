# Contributing to DeQL

Thanks for your interest in contributing to DeQL. This project is in its early stages — focused on language design and documentation — so every contribution matters.

## Ways to Contribute

- **Language feedback** — Open an issue if a concept feels unclear, inconsistent, or missing
- **Documentation** — Fix typos, improve explanations, add examples
- **Examples** — Add new `.deql` example systems that demonstrate real-world patterns
- **Site improvements** — The docs site lives in `site/` and is built with Astro + Starlight

## Getting Started

1. Fork the repo and clone it locally
2. For documentation/site changes:
   ```bash
   cd site
   npm install
   npm run dev
   ```
3. Make your changes and verify they look right locally

## Submitting Changes

1. Create a branch from `main` with a descriptive name (e.g., `fix/projection-docs`, `example/shipping-system`)
2. Keep commits focused — one logical change per commit
3. Open a pull request against `main`
4. Describe what you changed and why

## Project Structure

```
examples/           — .deql example systems
site/               — Astro/Starlight documentation site
  src/content/docs/ — Markdown documentation pages
  public/           — Static assets (casts, scripts, vendor libs)
```

## Guidelines

- Keep documentation clear and concise
- Use DeQL code blocks (` ```deql `) for language examples
- Follow existing patterns in the codebase
- If proposing a language change, open an issue for discussion first

## Code of Conduct

Be respectful, constructive, and welcoming. We're building something together.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
