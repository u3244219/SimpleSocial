import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo-name>/, not from the root.
// If you rename the repo, change this (or set BASE_PATH in the deploy workflow).
const base = process.env.BASE_PATH ?? '/SimpleSocial/'

export default defineConfig({
  base,
  plugins: [react()],
})
