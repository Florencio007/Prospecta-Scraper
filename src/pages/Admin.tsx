import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingLogo } from "@/components/LoadingLogo";
import { Shield, Users, Mail, Calendar } from "lucide-react";

/**
 * Page d'administration
 * Permet de visualiser et gérer les utilisateurs du système.
 */
const Admin = () => {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary dark:text-white">Panneau d'administration</h1>
            <p className="mt-1 text-muted-foreground">Gérez les utilisateurs et surveillez l'activité du système.</p>
          </div>
          <div className="flex items-center gap-3">
             <Badge variant="outline" className="px-3 py-1 border-accent/20 bg-accent/5 text-accent font-medium rounded-full">
              Mode Administrateur Actif
             </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-accent/10 bg-accent/5 shadow-none rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profiles.length}</div>
            </CardContent>
          </Card>
          
          <Card className="border-emerald-500/10 bg-emerald-500/5 shadow-none rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
              <Shield className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profiles.filter(p => p.role === 'admin').length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-accent/10 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Liste des Utilisateurs</CardTitle>
                <CardDescription>Vue d'ensemble de tous les comptes enregistrés.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <LoadingLogo size="md" message="Chargement des utilisateurs..." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    <TableHead className="py-4 pl-6">Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut Onboarding</TableHead>
                    <TableHead className="pr-6">Date Inscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id} className="group hover:bg-accent/5 transition-colors border-accent/5">
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                            {p.initials || "?"}
                          </div>
                          <span className="font-medium">{p.full_name || "Sans nom"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                          <Mail className="h-3 w-3" />
                          <span>{p.email || "Non défini"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.role === 'admin' ? "default" : "secondary"} className="rounded-full px-3">
                          {p.role === 'admin' ? "Admin" : "Utilisateur"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.onboarding_completed ? "outline" : "outline"} className={`rounded-full px-3 ${p.onboarding_completed ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-amber-500 text-amber-600 bg-amber-50'}`}>
                          {p.onboarding_completed ? "Complété" : "En cours"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
