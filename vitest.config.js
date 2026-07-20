import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Components are rendered with react-dom/server, so no DOM environment is
// needed — this checks real markup against the real 487-session dataset.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['tests/**/*.test.jsx'] },
})
