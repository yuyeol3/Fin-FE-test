import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 백엔드 CORS allowedOrigins가 http://localhost:5173 하나뿐이라,
  // 포트가 밀리면 모든 요청이 preflight에서 막힌다.
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
})
