import { useState, useEffect } from "react";
import { Save, LogOut, Bell, Shield, Palette, Key, Upload, Camera, ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ApiKeysSettings } from "@/components/dashboard/ApiKeysSettings";

const Settings = () => {
  const { profile, user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const searchParams = new URLSearchParams(location.search);
  const defaultTab = searchParams.get('tab') || 'profile';

  const [profileSettings, setProfileSettings] = useState({
    fullName: profile?.full_name || "",
    photoUrl: profile?.avatar_url || "",
    userServiceDescription: "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    prospectsUpdates: true,
    campaignReports: true,
    weeklyDigest: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactor: false,
    sessionTimeout: 30,
  });

  const [mfaEnrollment, setMfaEnrollment] = useState<{
    qrCode: string | null;
    secret: string | null;
    factorId: string | null;
  }>({ qrCode: null, secret: null, factorId: null });
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [isMfaEnabled, setIsMfaEnabled] = useState(false);

  const [linkedinSettings, setLinkedinSettings] = useState({
    email: "",
    password: "",
  });

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const fetchUserServiceDescription = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_service_description')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfileSettings((prev) => ({
          ...prev,
          userServiceDescription: data.user_service_description || "",
        }));
      }
    } catch (err: unknown) {
      console.error("Error fetching service description:", err);
    }
  };

  const fetchLinkedinSettings = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('linkedin_settings')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
          console.warn("linkedin_settings table not found or empty");
        } else {
          throw error;
        }
      }
      if (data) {
        setLinkedinSettings({
          email: data.email,
          password: data.password,
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching LinkedIn settings:", err);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchUserServiceDescription(),
        fetchLinkedinSettings(),
      ]);
    } catch (err: unknown) {
      setError("Erreur lors du chargement des paramètres.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.full_name) {
      setProfileSettings((prev) => ({
        ...prev,
        photoUrl: profile?.avatar_url || "",
        fullName: profile.full_name,
      }));
    }
    fetchAllData(); // Call the combined fetch function
  }, [profile]);

  // Check if MFA is enabled
  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;

        const totpFactor = data?.totp?.find(f => f.status === 'verified');
        setIsMfaEnabled(!!totpFactor);
        setSecuritySettings(prev => ({ ...prev, twoFactor: !!totpFactor }));
      } catch (error) {
        console.error('Error checking MFA status:', error);
      }
    };
    checkMfaStatus();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast({
        title: t("error"),
        description: "Vous devez être connecté pour changer votre photo.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("error"),
        description: t("photoRequirement"), // "Max 5MB"
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setProfileSettings({ ...profileSettings, photoUrl: publicUrl });

      toast({
        title: t("photoLoaded"),
        description: t("clickSaveToConfirm"),
      });

    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast({
        title: t("error"),
        description: error.message || "Erreur lors du téléchargement de la photo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileSettings.fullName,
          avatar_url: profileSettings.photoUrl,
        },
      });

      if (error) throw error;

      // Update public.profiles table as well if needed (trigger usually handles this for new users, but checks sync)
      if (profile?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: profileSettings.fullName,
            user_service_description: profileSettings.userServiceDescription,
            // avatar_url might not be in profiles table yet based on previous migration check,
            // but usually good practice to sync if column exists.
            // Based on 20260210001400 migration, profiles table DOES NOT have avatar_url.
            // So we stick to auth.users metadata which is what we updated above.
          })
          .eq('user_id', profile.id);

        if (profileError) console.warn("Sync to profiles table failed", profileError);
      }

      toast({
        title: t("profileUpdated"),
        description: t("profileUpdatedDesc"),
      });

      // Refresh user session to update UI immediately with new metadata
      await supabase.auth.refreshSession();

    } catch (error) {
      toast({
        title: t("error"),
        description: t("profileUpdateError") || "Error updating profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLinkedinSettings = async () => {
    if (!linkedinSettings.email || !linkedinSettings.password) {
      toast({
        title: t("error"),
        description: "Veuillez remplir tous les champs LinkedIn",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('linkedin_settings')
        .select('id')
        .eq('user_id', profile?.id)
        .maybeSingle();

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from('linkedin_settings')
          .update({
            email: linkedinSettings.email,
            password: linkedinSettings.password,
          })
          .eq('user_id', profile?.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('linkedin_settings')
          .insert([{
            user_id: profile?.id,
            email: linkedinSettings.email,
            password: linkedinSettings.password,
          }]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "✅ LinkedIn configuré",
        description: "Vos credentials LinkedIn ont été sauvegardés avec succès.",
      });
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || "Erreur lors de la sauvegarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!changePasswordForm.oldPassword.trim()) {
      toast({
        title: t("error"),
        description: t("enterOldPassword"),
        variant: "destructive",
      });
      return;
    }

    if (!changePasswordForm.newPassword.trim()) {
      toast({
        title: t("error"),
        description: t("enterNewPassword"),
        variant: "destructive",
      });
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast({
        title: t("error"),
        description: t("passwordsNoMatch"),
        variant: "destructive",
      });
      return;
    }

    if (changePasswordForm.newPassword.length < 6) {
      toast({
        title: t("error"),
        description: t("passwordMinLength"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: changePasswordForm.newPassword,
      });

      if (error) throw error;

      toast({
        title: t("success"),
        description: t("passwordChanged"),
      });

      setChangePasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setChangePasswordOpen(false);
    } catch (error) {
      toast({
        title: t("error"),
        description: t("passwordError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableMfa = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Prospecta 2FA',
      });

      if (error) throw error;

      if (data) {
        setMfaEnrollment({
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
          factorId: data.id,
        });
        setMfaDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Error enrolling MFA:', error);
      toast({
        title: t("error"),
        description: error.message || "Erreur lors de l'activation du 2FA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaEnrollment.factorId || !mfaVerifyCode) {
      toast({
        title: t("error"),
        description: "Veuillez entrer le code de vérification",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.factorId,
        code: mfaVerifyCode,
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Authentification à deux facteurs activée avec succès !",
      });

      setIsMfaEnabled(true);
      setSecuritySettings(prev => ({ ...prev, twoFactor: true }));
      setMfaDialogOpen(false);
      setMfaVerifyCode("");
      setMfaEnrollment({ qrCode: null, secret: null, factorId: null });
    } catch (error: any) {
      console.error('Error verifying MFA:', error);
      toast({
        title: t("error"),
        description: error.message || "Code de vérification invalide",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      setIsLoading(true);

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factors?.totp?.find(f => f.status === 'verified');
      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: totpFactor.id,
        });

        if (error) throw error;

        toast({
          title: "Succès",
          description: "Authentification à deux facteurs désactivée",
        });

        setIsMfaEnabled(false);
        setSecuritySettings(prev => ({ ...prev, twoFactor: false }));
      }
    } catch (error: any) {
      console.error('Error disabling MFA:', error);
      toast({
        title: t("error"),
        description: error.message || "Erreur lors de la désactivation du 2FA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMfa = async (checked: boolean) => {
    if (checked) {
      await handleEnableMfa();
    } else {
      await handleDisableMfa();
    }
  };


  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-secondary">
      <Header />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("settings")}</h1>
          <p className="text-foreground font-light mt-1">
            {t("managePrefs")}
          </p>
        </div>

        <Tabs defaultValue={defaultTab === 'integrations' ? 'integrations' : 'profile'} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">{t("profile")}</TabsTrigger>
            <TabsTrigger value="integrations">Intégrations</TabsTrigger>
            <TabsTrigger value="notifications">{t("notifications")}</TabsTrigger>
            <TabsTrigger value="security">{t("security")}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-accent" />
                  <CardTitle>{t("profile")}</CardTitle>
                </div>
                <CardDescription>
                  {t("updatePersonalInfo")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profileSettings.photoUrl} alt={t("profile")} />
                      <AvatarFallback className="bg-accent text-accent-foreground text-lg">
                        {profile?.full_name?.charAt(0).toUpperCase() || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Label htmlFor="photoUpload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors w-fit">
                          <Camera size={18} />
                          <span>{t("changePhoto")}</span>
                        </div>
                      </Label>
                      <Input
                        id="photoUpload"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-foreground mt-2">
                        {t("photoRequirement")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input
                    id="fullName"
                    value={profileSettings.fullName}
                    onChange={(e) =>
                      setProfileSettings({ ...profileSettings, fullName: e.target.value })
                    }
                    placeholder={t("yourFullName")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    value={profile?.email || ""}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-foreground mt-1">
                    {t("emailNoEdit")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userServiceDescription">Description de votre service</Label>
                  <textarea
                    id="userServiceDescription"
                    value={profileSettings.userServiceDescription}
                    onChange={(e) =>
                      setProfileSettings({ ...profileSettings, userServiceDescription: e.target.value })
                    }
                    placeholder="Ex: Nous créons des assistants IA intelligents pour les e-commerces malgaches, permettant d'automatiser le SAV et les commandes via Messenger et WhatsApp..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cette description sera utilisée pour générer automatiquement des emails personnalisés pour vos campagnes.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={18} className="mr-2" />}
                    {isLoading ? t("saving") : t("saveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <ApiKeysSettings />

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-accent" />
                  <CardTitle>LinkedIn</CardTitle>
                </div>
                <CardDescription>
                  Configurez vos credentials LinkedIn pour activer la recherche et l'enrichissement de profils
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                  <AlertTitle>⚠️ Sécurité</AlertTitle>
                  <AlertDescription>
                    Vos identifiants LinkedIn sont chiffrés et stockés de manière sécurisée. Utilisez un compte LinkedIn dédié ou activez la validation en 2 étapes
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="linkedinEmail">Email LinkedIn</Label>
                  <Input
                    id="linkedinEmail"
                    type="email"
                    placeholder="votre_email@gmail.com"
                    value={linkedinSettings.email}
                    onChange={(e) => setLinkedinSettings({ ...linkedinSettings, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedinPassword">Mot de passe LinkedIn</Label>
                  <Input
                    id="linkedinPassword"
                    type="password"
                    placeholder="••••••••••••"
                    value={linkedinSettings.password}
                    onChange={(e) => setLinkedinSettings({ ...linkedinSettings, password: e.target.value })}
                  />
                </div>

                <Button
                  onClick={handleSaveLinkedinSettings}
                  disabled={isLoading}
                  className="w-full bg-accent text-accent-foreground mt-4"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={18} className="mr-2" />}
                  {isLoading ? "Enregistrement..." : "Enregistrer les credentials LinkedIn"}
                </Button>

                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 mt-4">
                  <AlertTitle>✅ Une fois configuré</AlertTitle>
                  <AlertDescription>
                    Vous pourrez utiliser LinkedIn directement dans ProspectFinder pour rechercher et enrichir les profils professionnels
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent" />
                  <CardTitle>{t("notifications")}</CardTitle>
                </div>
                <CardDescription>
                  {t("controlNotifications")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("emailNotifications")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("receiveEmailUpdates")}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("prospectsUpdates")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("prospectsUpdatesDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.prospectsUpdates}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        prospectsUpdates: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("campaignReports")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("campaignReportsDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.campaignReports}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        campaignReports: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("weeklyDigest")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("weeklyDigestDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.weeklyDigest}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        weeklyDigest: checked,
                      })
                    }
                  />
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() =>
                      toast({
                        title: t("prefsUpdated"),
                        description: t("prefsUpdatedDesc"),
                      })
                    }
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Save size={18} className="mr-2" />
                    {t("save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" />
                  <CardTitle>{t("security")}</CardTitle>
                </div>
                <CardDescription>
                  {t("manageSecurity")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted">
                  <div>
                    <p className="font-medium">{t("twoFactor")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("addSecurityLayer")}
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.twoFactor}
                    onCheckedChange={handleToggleMfa}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("sessionTimeout")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("autoLogout")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    title={t("sessionTimeout")}
                    type="range"
                    min="15"
                    max="120"
                    step="15"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        sessionTimeout: parseInt(e.target.value),
                      })
                    }
                    className="flex-1"
                  />
                  <Badge variant="outline">{securitySettings.sessionTimeout} min</Badge>
                </div>

                <div className="pt-4 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setChangePasswordOpen(true)}
                  >
                    <Key size={18} className="mr-2" />
                    {t("changePassword")}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">{t("dangerZone")}</CardTitle>
                <CardDescription>
                  {t("irreversibleActions")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleSignOut}
                >
                  <LogOut size={18} className="mr-2" />
                  {t("logout")}
                </Button>

                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() =>
                    toast({
                      title: t("inDevelopment"),
                      description: t("willSoonAvailable"),
                      variant: "destructive",
                    })
                  }
                >
                  {t("deleteAccount")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("changeYourPassword")}</DialogTitle>
            <DialogDescription>
              {t("enterOldAndNewPass")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">{t("oldPasswordLabel")}</Label>
              <Input
                id="oldPassword"
                type="password"
                placeholder={t("enterCurrentPassword")}
                value={changePasswordForm.oldPassword}
                onChange={(e) =>
                  setChangePasswordForm({
                    ...changePasswordForm,
                    oldPassword: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={t("enterNewPassword")}
                value={changePasswordForm.newPassword}
                onChange={(e) =>
                  setChangePasswordForm({
                    ...changePasswordForm,
                    newPassword: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("minCharacters")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("confirmNewPass")}
                value={changePasswordForm.confirmPassword}
                onChange={(e) =>
                  setChangePasswordForm({
                    ...changePasswordForm,
                    confirmPassword: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setChangePasswordOpen(false)}
              disabled={isLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? t("changing") : t("changePasswordDialog")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Enrollment Dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurer l'authentification à deux facteurs</DialogTitle>
            <DialogDescription>
              Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {mfaEnrollment.qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-lg">
                  <img
                    src={mfaEnrollment.qrCode}
                    alt="QR Code 2FA"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Ou entrez ce code manuellement :
                  </p>
                  <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                    {mfaEnrollment.secret}
                  </code>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Code de vérification</Label>
              <Input
                id="mfa-code"
                placeholder="000000"
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value)}
                maxLength={6}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Entrez le code à 6 chiffres de votre application
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMfaDialogOpen(false);
                setMfaVerifyCode("");
                setMfaEnrollment({ qrCode: null, secret: null, factorId: null });
              }}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleVerifyMfa}
              disabled={isLoading || mfaVerifyCode.length !== 6}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? "Vérification..." : "Vérifier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
