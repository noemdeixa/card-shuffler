import { defineConfig } from 'vite'

export default defineConfig({
	base: '/card-shuffler/',
	server: {
		watch: {
		usePolling: true,
		},
	},
})