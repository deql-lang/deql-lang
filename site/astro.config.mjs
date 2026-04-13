// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightClientMermaid from '@pasqal-io/starlight-client-mermaid';
import deqlGrammar from './deql-grammar.mjs';
import deqlTheme from './deql-theme.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://deql-lang.github.io',
	base: '/deql-lang/',
	markdown: {
		shikiConfig: {
			langs: [deqlGrammar],
		},
	},
	integrations: [
		starlight({
			title: 'Decision Query Language',
			logo: {
				src: './src/assets/deql-logo.svg',
				alt: 'DeQL Logo',
			},
			favicon: '/favicon.svg',
			description:
				'A declarative language for defining, executing, and inspecting business decisions over event-sourced state, enabling progressively evolving and scalable CQRS-ES systems.',
			plugins: [starlightClientMermaid()],
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'script', attrs: { src: '/docs-nav.js' } },
				{ tag: 'link', attrs: { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css' } },
			],
			expressiveCode: {
				themes: [deqlTheme],
				shiki: {
					langs: [deqlGrammar],
				},
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/deql-lang/deql-lang',
				},
			],
			sidebar: [
				{ label: 'Overview', slug: 'overview' },
				{
					label: 'Language Reference',
					items: [
						{ label: 'Aggregate', slug: 'concepts/aggregate' },
						{ label: 'Command', slug: 'concepts/command' },
						{ label: 'Event', slug: 'concepts/event' },
						{ label: 'Decision', slug: 'concepts/decision' },
						{ label: 'Projection', slug: 'concepts/projection' },
						{ label: 'Template', slug: 'concepts/template' },
						{ label: 'EventStore', slug: 'concepts/eventstore' },
						{ label: 'Describe', slug: 'concepts/describe' },
					],
				},
				{ label: 'Two-Phase Model', slug: 'two-phase-model' },
				{ label: 'Inspection', slug: 'inspection' },
				{ label: 'Progressive Design', slug: 'progressive-design' },
				{
					label: 'Examples',
					items: [
						{ label: 'Inventory System', slug: 'examples/inventory-system' },
						{ label: 'Registry System', slug: 'examples/registry-system' },
						{ label: 'Telecom Wallet', slug: 'examples/telecom-wallet' },
					],
				},
			],
		}),
	],
});
