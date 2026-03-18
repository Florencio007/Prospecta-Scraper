import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LegalDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyDialog: React.FC<LegalDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("privacyPolicy")}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="pr-4 mt-4 h-[50vh]">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <h3 className="text-foreground font-semibold">1. Introduction</h3>
            <p>{t("privacyPolicyContent")}</p>
            
            <h3 className="text-foreground font-semibold">2. Collecte des données</h3>
            <p>
              Nous collectons les informations que vous nous fournissez directement lors de la création de votre compte, 
              notamment votre nom, adresse email et préférences de prospection.
            </p>

            <h3 className="text-foreground font-semibold">3. Utilisation des données</h3>
            <p>
              Vos données sont utilisées pour :
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Fournir et maintenir nos services de prospection</li>
                <li>Personnaliser votre expérience utilisateur</li>
                <li>Générer des rapports et analyses de performance</li>
                <li>Communiquer avec vous concernant votre compte</li>
              </ul>
            </p>

            <h3 className="text-foreground font-semibold">4. Sécurité des données</h3>
            <p>
              Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger 
              vos données contre tout accès non autorisé, perte ou destruction.
            </p>

            <h3 className="text-foreground font-semibold">5. Vos droits</h3>
            <p>
              Conformément au RGPD et aux lois locales (Madagascar), vous disposez d'un droit d'accès, de rectification 
              et de suppression de vos données personnelles. Vous pouvez exercer ces droits depuis vos paramètres 
              ou en nous contactant.
            </p>

            <h3 className="text-foreground font-semibold">6. Cookies</h3>
            <p>
              Nous utilisons des cookies pour améliorer la navigation et analyser le trafic de notre plateforme. 
              Vous pouvez gérer vos préférences de cookies via notre bandeau de consentement.
            </p>
          </div>
        </ScrollArea>
        <DialogFooter className="mt-6">
          <Button onClick={onClose}>{t("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const TermsOfUseDialog: React.FC<LegalDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("termsOfUse")}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="pr-4 mt-4 h-[50vh]">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <h3 className="text-foreground font-semibold">1. Acceptation des conditions</h3>
            <p>{t("termsOfUseContent")}</p>

            <h3 className="text-foreground font-semibold">2. Utilisation du service</h3>
            <p>
              L'utilisateur s'engage à utiliser Prospecta de manière éthique et légale. Toute utilisation abusive 
              du service de scraping ou d'envoi d'emails (spam) est strictement interdite.
            </p>

            <h3 className="text-foreground font-semibold">3. Propriété intellectuelle</h3>
            <p>
              Tous les contenus de la plateforme Prospecta (logiciel, design, textes) sont la propriété exclusive 
              de Prospecta ou de ses concédants.
            </p>

            <h3 className="text-foreground font-semibold">4. Responsabilité</h3>
            <p>
              Prospecta s'efforce de fournir des données de prospection précises mais ne peut garantir l'exactitude 
              complète des informations collectées via le web-scraping. L'utilisateur est responsable de l'usage 
              qu'il fait des données obtenues.
            </p>

            <h3 className="text-foreground font-semibold">5. Résiliation</h3>
            <p>
              Nous nous réservons le droit de suspendre ou de résilier votre compte en cas de violation des 
              présentes conditions d'utilisation.
            </p>

            <h3 className="text-foreground font-semibold">6. Droit applicable</h3>
            <p>
              Ces conditions sont régies par le droit en vigueur à Madagascar.
            </p>
          </div>
        </ScrollArea>
        <DialogFooter className="mt-6">
          <Button onClick={onClose}>{t("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
