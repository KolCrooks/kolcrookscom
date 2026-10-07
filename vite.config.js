import { fileURLToPath } from 'node:url';
import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: [
				mdsvex({
					layout: fileURLToPath(new URL('./src/routes/blog/blog-layout.svelte', import.meta.url)),
					extensions: ['.svx']
				})
			],
			extensions: ['.svelte', '.svx'],
			adapter: adapter(),
			// served from the root of the custom domain (kolcrooks.com), not /kolcrookscom
			paths: { base: '' }
		}),
		tailwindcss()
	]
});
