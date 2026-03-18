import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@/index.css";
import "@/i18n"; // Initialize i18next
import { registerSW } from 'virtual:pwa-register';

// PWA auto-update logic
const updateSW = registerSW({
  onRegistered(r) {
    // Check for updates every 60 minutes if the user leaves the tab open
    if (r) {
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('SW registration error', error);
  }
});

// Force page reload when a new service worker takes over
let refreshing = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
