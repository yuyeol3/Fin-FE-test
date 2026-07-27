import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext';
import App from './App.jsx'
import './index.css'

// StrictMode의 effect 이중 호출로 /auth/refresh가 두 번 나가면
// 1회용 리프레시 토큰이 회전되며 세션이 끊긴다.
// client.js의 single-flight refresh가 두 호출을 하나로 합치므로 이제 켜도 안전하다.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
