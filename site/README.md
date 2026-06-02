# Starlight Starter Kit: Basics

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

```
npm create astro@latest -- --template starlight
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   └── docs/
│   └── content.config.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Check out [Starlight’s docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build), or jump into the [Astro Discord server](https://astro.build/chat).

## 📦 Releasing a New Version

When you're ready to freeze the current documentation as a versioned snapshot, use the `promote` script.

### Usage

```bash
cd site
npm run promote -- --version=X.Y.Z
```

For example, to release v0.2.0:

```bash
npm run promote -- --version=0.2.0
```

### What it does

1. Creates a versioned folder at `src/content/docs/vX-Y-Z/` (e.g. `v0-2-0`)
2. Clones all current `.md`/`.mdx` files from `docs/` root, `concepts/`, and `examples/`
3. Generates a version index page with links to all cloned pages
4. Injects a "You are viewing docs for vX.Y.Z" banner into every page's frontmatter
5. Fixes relative imports in `.mdx` files to account for the extra directory depth
6. Adds the version to the sidebar Versions section in `astro.config.mjs`

After promoting, rebuild the site:

```bash
npm run build
```

### Guards

- **Missing `--version`** → prints usage and exits with code 1
- **Invalid format** (not `X.Y.Z`) → prints error and exits with code 1
- **Folder already exists** → refuses to overwrite (frozen versions are immutable)

### Removing a version

1. Delete the version folder: `rm -rf src/content/docs/v0-2-0/`
2. Remove the entry from the Versions `items` array in `astro.config.mjs`
3. Rebuild: `npm run build`

### How version switching works

- `scripts/gen-versions.mjs` runs at `prebuild`/`predev` and generates `public/versions.json` from the sidebar config
- `public/docs-nav.js` fetches `versions.json` at runtime and builds a version dropdown in the header
- The selected version is stored in `sessionStorage` and sidebar links are rewritten client-side

The single source of truth for all versions is the **Versions** section in `astro.config.mjs`.
