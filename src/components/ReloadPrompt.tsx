import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

/**
 * Composant de détection de mise à jour de la PWA.
 * Affiche une notification persistante lorsqu'une nouvelle version est détectée,
 * invitant l'utilisateur à recharger la page plutôt que d'imposer un rafraîchissement forcé.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Vérifie les mises à jour toutes les 60 minutes si l'onglet reste ouvert
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast("🚀 Nouvelle mise à jour ! 🎉", {
        description: "Une version plus récente et plus rapide de l'application est disponible. Mettez à jour maintenant !",
        action: {
          label: "Mettre à jour",
          onClick: () => {
             updateServiceWorker(true);
          },
        },
        duration: 100000000, 
        position: 'bottom-center'
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
