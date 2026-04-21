// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightClientMermaid from '@pasqal-io/starlight-client-mermaid';
import deqlGrammar from './deql-grammar.mjs';
import deqlTheme from './deql-theme.mjs';

const base = '/deql-lang/';

// https://astro.build/config
export default defineConfig({
	site: 'https://deql-lang.github.io',
	base,
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
				{ tag: 'meta', attrs: { name: 'base-path', content: base } },
				{ tag: 'script', attrs: { src: `${base}docs-nav.js` } },
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
						{ label: 'Beyond Aggregates', slug: 'examples/beyond-aggregates' },
						{
							label: 'Getting Started',
							items: [
								{ label: 'Employee Domain', slug: 'examples/demoscript' },
							],
						},
						{
							label: 'Decision Patterns',
							items: [
								{ label: 'Approval Workflow', slug: 'examples/approval-workflow' },
								{ label: 'Order Fulfillment', slug: 'examples/order-fulfillment' },
								{ label: 'Idempotent Payments', slug: 'examples/idempotent-payments' },
								{ label: 'Subscription Billing', slug: 'examples/subscription-billing' },
								{ label: 'Decision Branching', slug: 'examples/decision-branching' },
							],
						},
						{
							label: 'Inspection',
							items: [
								{ label: 'Inspect Decisions', slug: 'examples/inspect-demo' },
								{ label: 'Inspect Projections', slug: 'examples/inspect-projection' },
								{ label: 'Describe & Validate', slug: 'examples/describe-and-validate' },
							],
						},
						{
							label: 'Full Systems',
							items: [
								{ label: 'Audit Trail', slug: 'examples/audit-trail' },
								{ label: 'Inventory System', slug: 'examples/inventory-system' },
								{ label: 'Registry System', slug: 'examples/registry-system' },
								{ label: 'Telecom Wallet', slug: 'examples/telecom-wallet' },
								{ label: 'Admin Login App', slug: 'examples/admin-login-app' },
							],
						},
					],
				},
				{
					label: 'REST API',
					items: [
						{ label: 'Overview', slug: 'rest-api' },
						{ label: 'Aggregate', slug: 'rest-api/aggregate' },
						{ label: 'Command', slug: 'rest-api/command' },
						{ label: 'Event', slug: 'rest-api/event' },
						{ label: 'Decision', slug: 'rest-api/decision' },
						{ label: 'Projection', slug: 'rest-api/projection' },
						{ label: 'Template', slug: 'rest-api/template' },
						{ label: 'EventStore', slug: 'rest-api/eventstore' },
						{ label: 'DeReg', slug: 'rest-api/dereg' },
						{ label: 'Query Console', slug: 'rest-api/query' },
						{ label: 'Health & Info', slug: 'rest-api/health' },
					],
				},
			],
		}),
	],
});
