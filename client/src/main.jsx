import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { FavoritesProvider } from './contexts/FavoritesContext.jsx'

// Attach a global click ripple effect once at startup
function attachGlobalRipple() {
  if (window.__rippleAttached) return;
  window.__rippleAttached = true;
  document.addEventListener('click', (e) => {
    // Only left click, ignore modified clicks or non-primary buttons
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Ignore clicks inside toasts (avoid clutter) by checking closest .toaster
    if (e.target && e.target.closest && e.target.closest('.toaster')) return;
    const ripple = document.createElement('span');
    ripple.className = 'click-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

attachGlobalRipple();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <FavoritesProvider>
        <App />
      </FavoritesProvider>
    </BrowserRouter>
  </StrictMode>,
)