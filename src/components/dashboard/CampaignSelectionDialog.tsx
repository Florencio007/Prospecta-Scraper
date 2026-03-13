import { useState, useEffect } from "react";
import { Plus, Loader2, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEmailCampaigns, type EmailCampaign } from "@/hooks/useEmailCampaigns";

interface CampaignSelectionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    prospectIds: string[];
    onSuccess?: () => void;
}

const CampaignSelectionDialog = ({
    isOpen,
    onOpenChange,
    prospectIds,
    onSuccess
}: CampaignSelectionDialogProps) => {
    const { toast } = useToast();
    const { campaigns, loading, fetchCampaigns, createCampaign, importFromProspects } = useEmailCampaigns();
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState("");
    const [newCampaignDescription, setNewCampaignDescription] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchCampaigns();
            setIsCreatingCampaign(false);
        }
    }, [isOpen]);

    const handleAddToCampaign = async (campaignId: string) => {
        if (prospectIds.length === 0) return;

        try {
            const result = await importFromProspects(campaignId, prospectIds);

            if (result.success) {
                toast({
                    title: "Importation terminée",
                    description: `${result.added} prospects ajoutés. ${result.skipped} ignorés.`,
                });
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                toast({
                    title: "Note",
                    description: "Aucun nouveau prospect n'a été ajouté.",
                    variant: "default"
                });
            }
        } catch (error: any) {
            toast({
                title: "Erreur",
                description: error.message || "Erreur lors de l'ajout à la campagne",
                variant: "destructive"
            });
        }
    };

    const handleQuickCreateCampaign = async () => {
        if (!newCampaignName.trim()) {
            toast({
                title: "Nom requis",
                description: "Veuillez donner un nom à votre campagne.",
                variant: "destructive"
            });
            return;
        }

        try {
            // 1. Create the campaign using the hook
            const campaign = await createCampaign({
                name: newCampaignName,
                status: "draft",
                subject: "Proposition de collaboration", // Default
                from_name: "Mon Entreprise", // Default
                from_email: "votre@email.com", // Default
                body_html: "<p>Bonjour {{prenom}},</p><p>Je souhaitais vous contacter...</p>",
                tags: []
            });

            if (!campaign) throw new Error("Échec de la création de la campagne");

            // 2. Link the prospects using the hook
            let added = 0;
            let skipped = 0;
            if (prospectIds.length > 0) {
                const result = await importFromProspects(campaign.id, prospectIds);
                added = result.added;
                skipped = result.skipped;
            }

            toast({
                title: "Succès !",
                description: prospectIds.length > 0
                    ? `Campagne "${newCampaignName}" créée. ${added} ajoutés, ${skipped} ignorés.`
                    : `Campagne "${newCampaignName}" créée avec succès.`,
            });

            setNewCampaignName("");
            setNewCampaignDescription("");
            setIsCreatingCampaign(false);
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast({
                title: "Erreur",
                description: error.message || "Erreur lors de la création de la campagne",
                variant: "destructive"
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-[#0A0E1A] text-white border-slate-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="text-accent" size={20} />
                        {isCreatingCampaign ? "Créer une nouvelle campagne" : "Choisir une campagne"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {isCreatingCampaign
                            ? "Définissez les détails de votre nouvelle campagne."
                            : prospectIds.length > 1
                                ? `Ajouter ${prospectIds.length} prospects à une campagne.`
                                : "Sélectionnez la campagne à laquelle vous souhaitez ajouter ce prospect."}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    {isCreatingCampaign ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label htmlFor="campaign-name">Nom de la campagne</Label>
                                <Input
                                    id="campaign-name"
                                    placeholder="ex: Prospection Hôtels Diego"
                                    value={newCampaignName}
                                    onChange={(e) => setNewCampaignName(e.target.value)}
                                    className="bg-slate-900/50 border-slate-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="campaign-desc">Description (optionnelle)</Label>
                                <Input
                                    id="campaign-desc"
                                    placeholder="ex: Campagne de relance pour les hôtels du nord"
                                    value={newCampaignDescription}
                                    onChange={(e) => setNewCampaignDescription(e.target.value)}
                                    className="bg-slate-900/50 border-slate-800"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1 text-slate-400 hover:text-white"
                                    onClick={() => setIsCreatingCampaign(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="flex-1 bg-accent hover:bg-accent/90"
                                    onClick={handleQuickCreateCampaign}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : "Créer et ajouter"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                                    <span className="text-sm text-slate-500">Chargement des campagnes...</span>
                                </div>
                            ) : campaigns.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                                        {campaigns.map((campaign) => (
                                            <button
                                                key={campaign.id}
                                                onClick={() => handleAddToCampaign(campaign.id)}
                                                className="w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-accent/50 hover:bg-slate-900 transition-all group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold group-hover:text-accent transition-colors">{campaign.name}</div>
                                                        <div className="text-xs text-slate-500 line-clamp-1">{campaign.subject}</div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400 capitalize">
                                                        {campaign.status}
                                                    </Badge>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-accent"
                                        onClick={() => setIsCreatingCampaign(true)}
                                    >
                                        <Plus size={16} className="mr-2" /> Créer une nouvelle campagne
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-8 space-y-4">
                                    <div className="h-16 w-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto text-slate-500">
                                        <Plus size={32} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-300">Aucune campagne active</div>
                                        <p className="text-sm text-slate-500">Vous devez créer une campagne avant d'y ajouter des prospects.</p>
                                    </div>
                                    <Button
                                        onClick={() => setIsCreatingCampaign(true)}
                                        className="w-full bg-accent hover:bg-accent/90"
                                    >
                                        Créer ma première campagne
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CampaignSelectionDialog;
