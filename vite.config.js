import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages at https://<user>.github.io/<repo>/ set BASE_PATH=/<repo>/
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
