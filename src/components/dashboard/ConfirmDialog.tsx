import React from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
}

export const ConfirmDialog = ({
    isOpen,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText = "Confirmer",
    cancelText = "Annuler",
    variant = "destructive"
}: ConfirmDialogProps) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent className="bg-white dark:bg-[#0b0f1a] border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl p-8 max-w-md animate-in fade-in zoom-in-95 duration-300">
                <AlertDialogHeader className="space-y-4">
                    <div className="flex justify-center mb-2">
                        <div className={`h-16 w-16 rounded-full flex items-center justify-center ${variant === "destructive" ? "bg-red-500/10 text-red-500" : "bg-accent/10 text-accent"} shadow-inner`}>
                            {variant === "destructive" ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
                        </div>
                    </div>
                    <AlertDialogTitle className="text-2xl font-black text-center text-slate-900 dark:text-white font-outfit">
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
                    <AlertDialogCancel 
                        className="flex-1 h-12 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                    >
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        className={`flex-1 h-12 rounded-xl font-black text-white shadow-lg transition-all active:scale-95 ${
                            variant === "destructive" 
                            ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" 
                            : "bg-accent hover:bg-accent/90 shadow-accent/20"
                        }`}
                    >
                        {confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
