# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Development: `pnpm dev` or `pnpm start`
- Build: `pnpm build`
- Preview: `pnpm preview`
- Type check: `pnpm check`
- Format code: `pnpm format`
- Format check: `pnpm format:check`
- Lint: `pnpm lint`
- Lint check: `pnpm lint:check`

## Code Style Guidelines
- **Framework**: Astro with MDX for content
- **Formatting**: Uses Prettier with 100 character line width, tabs (2 spaces), double quotes
- **TypeScript**: Strict mode with strict null checks
- **Components**: Keep Astro components focused on a single responsibility
- **CSS**: Use class-based styling in dedicated CSS files
- **Imports**: Group imports by type (built-in, third-party, local)
- **Naming**: Use camelCase for variables/functions, PascalCase for components
- **Error Handling**: Use TypeScript's strict mode for type safety
- **File Structure**: Follow the existing directory structure with content in src/content