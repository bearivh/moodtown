import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // utils 폴더의 파일들이 별도 청크로 분리되지 않도록 설정
        manualChunks(id) {
          // utils 폴더의 파일들은 vendor 청크에 포함하여 메인 번들에 가깝게 유지
          if (id.includes('node_modules')) {
            return 'vendor'
          }
          // utils 파일들은 메인 번들에 포함 (별도 청크로 분리하지 않음)
          if (id.includes('/utils/')) {
            return undefined
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/analyze': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/analyze2': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/chat': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
