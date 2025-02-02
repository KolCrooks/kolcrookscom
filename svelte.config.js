import { mdsvex } from "mdsvex";
import adapter from "@sveltejs/adapter-static";


/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		paths: {
			base: process.argv.includes('dev') ? '' : '/kolcrookscom'
		}
	},
    preprocess: [mdsvex()],
    extensions: [".svelte", ".svx"],
};

export default config;
