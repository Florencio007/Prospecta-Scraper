import { useState } from "react";
import { Download, FileText, Check, Filter } from "lucide-react";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { exportProspects } from "@/lib/exportUtils";
import { logExportGenerated } from "@/lib/activityLogger";

interface ExportOption {
  id: string;
  name: string;
  description: string;
  format: string;
  icon: string;
}

const Reports = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedFormat, setSelectedFormat] = useState<string>("csv");
  const [configureOpen, setConfigureOpen] = useState(false);
  const [scheduledReports, setScheduledReports] = useState({
    conversion: true,
    monthly: false,
  });
  const [reportSettings, setReportSettings] = useState({
    conversionDay: "monday",
    conversionTime: "09:00",
    monthlyDay: "1",
    monthlyTime: "08:00",
  });
  const [filters, setFilters] = useState({
    includeScores: true,
    includeSource: true,
    includeDate: true,
    includeTags: true,
  });

  const exportOptions: ExportOption[] = [
    {
      id: "csv",
      name: "CSV",
      description: t("csvDesc"),
      format: ".csv",
      icon: "📊",
    },
    {
      id: "xlsx",
      name: "Excel",
      description: t("xlsxDesc"),
      format: ".xlsx",
      icon: "📈",
    },
    {
      id: "json",
      name: "JSON",
      description: t("jsonDesc"),
      format: ".json",
      icon: "⚙️",
    },
    {
      id: "pdf",
      name: "PDF",
      description: t("pdfDesc"),
      format: ".pdf",
      icon: "📄",
    },
  ];

  const reports = [
    {
      name: t("conversionReport"),
      description: t("convReportDesc"),
      status: t("available"),
      date: "10 Feb 2026",
      size: "2.4 MB",
    },
    {
      name: t("prospectAnalysis"),
      description: t("prospectAnalysisDesc"),
      status: t("available"),
      date: "10 Feb 2026",
      size: "5.1 MB",
    },
    {
      name: t("campaignReport"),
      description: t("campReportDesc"),
      status: t("available"),
      date: "10 Feb 2026",
      size: "1.8 MB",
    },
    {
      name: t("sourceAnalysis"),
      description: t("sourceAnalysisDesc"),
      status: t("available"),
      date: "9 Feb 2026",
      size: "1.2 MB",
    },
  ];

  const handleExport = async () => {
    if (!user?.id) {
      toast({
        title: t("error"),
        description: "Utilisateur non authentifié. Veuillez vous reconnecter.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("exportInProgress"),
      description: `${t("exportingProspects")} ${selectedFormat.toUpperCase()}...`,
    });

    try {
      // Fetch prospects from Supabase
      const { data: prospects, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!prospects || prospects.length === 0) {
        toast({
          title: t("error"),
          description: "Aucun prospect à exporter. Ajoutez des prospects d'abord.",
          variant: "destructive",
        });
        return;
      }

      // Export using the utility function
      exportProspects(prospects, selectedFormat as 'csv' | 'json' | 'excel', filters);

      // Log activity
      await logExportGenerated(user.id, selectedFormat.toUpperCase(), prospects.length);

      toast({
        title: t("success"),
        description: `${prospects.length} prospects exportés avec succès en ${selectedFormat.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: t("error"),
        description: error.message || "Erreur lors de l'export",
        variant: "destructive",
      });
    }
  };

  const handleGenerateReport = (reportName: string) => {
    toast({
      title: t("reportGenerated"),
      description: `${reportName} ${t("downloadedSuccess")}`,
    });
  };

  const handleConfigureReports = () => {
    setConfigureOpen(!configureOpen);
  };

  const toggleScheduledReport = (reportKey: "conversion" | "monthly") => {
    setScheduledReports((prev) => ({
      ...prev,
      [reportKey]: !prev[reportKey],
    }));
    toast({
      title: t("configUpdated"),
      description: `${reportKey === "conversion" ? t("conversionReport") : t("monthlyReport")} ${!scheduledReports[reportKey] ? t("enabled") : t("disabled")
        }`,
    });
  };

  return (
    <div className="min-h-screen bg-secondary">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("exportsAndReports")}</h1>
          <p className="text-foreground font-light mt-1">
            {t("exportDataAndReports")}
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download size={20} className="text-accent" />
              {t("quickExport")}
            </CardTitle>
            <CardDescription>
              {t("exportChoiceFormat")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-4">{t("chooseFormat")}</h3>
              <div className="grid md:grid-cols-4 gap-4">
                {exportOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedFormat(option.id)}
                    className={`p-4 rounded-lg border transition-all ${selectedFormat === option.id
                      ? "border-accent bg-accent/10"
                      : "border-muted hover:border-accent/50"
                      }`}
                  >
                    <div className="text-3xl mb-2">{option.icon}</div>
                    <p className="font-semibold text-foreground mb-1">{option.name}</p>
                    <p className="text-xs text-foreground">{option.description}</p>
                    <Badge variant="outline" className="mt-2">
                      {option.format}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Filter size={18} />
                {t("columnsToInclude")}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:border-accent/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={filters.includeScores}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, includeScores: checked as boolean })
                    }
                  />
                  <div>
                    <p className="font-medium text-foreground">{t("qualityScores")}</p>
                    <p className="text-xs text-foreground">{t("scoreDescription")}</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:border-accent/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={filters.includeSource}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, includeSource: checked as boolean })
                    }
                  />
                  <div>
                    <p className="font-medium text-foreground">{t("source")}</p>
                    <p className="text-xs text-foreground">{t("sourceDescription")}</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:border-accent/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={filters.includeDate}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, includeDate: checked as boolean })
                    }
                  />
                  <div>
                    <p className="font-medium text-foreground">{t("dateAdded")}</p>
                    <p className="text-xs text-foreground">{t("foundDateDescription")}</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-muted hover:border-accent/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={filters.includeTags}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, includeTags: checked as boolean })
                    }
                  />
                  <div>
                    <p className="font-medium text-foreground">{t("contacts")}</p>
                    <p className="text-xs text-foreground">{t("tagsDescription")}</p>
                  </div>
                </label>
              </div>
            </div>

            <Button
              onClick={handleExport}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-base py-6"
            >
              <Download size={20} className="mr-2" />
              {t("exportNow")} ({selectedFormat.toUpperCase()})
            </Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText size={24} className="text-accent" />
            {t("availableReports")}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {reports.map((report, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1">
                      <p className="text-foreground">
                        <span className="font-medium text-foreground">{t("generatedOn")}</span> {report.date}
                      </p>
                      <p className="text-foreground">
                        <span className="font-medium text-foreground">{t("size")}</span> {report.size}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                      {report.status}
                    </Badge>
                  </div>

                  <Button
                    onClick={() => handleGenerateReport(report.name)}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Download size={18} className="mr-2" />
                    {t("download")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{t("scheduledReports")}</CardTitle>
            <CardDescription>
              {t("receiveAutomatically")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-muted bg-muted/50">
              <div>
                <p className="font-medium text-foreground">{t("conversionReport")}</p>
                <p className="text-sm text-foreground">{t("everyMonday")}</p>
              </div>
              <Badge
                className={`cursor-pointer ${scheduledReports.conversion ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-gray-500 text-white hover:bg-gray-600"}`}
                onClick={() => toggleScheduledReport("conversion")}
              >
                {scheduledReports.conversion ? t("activated") : t("deactivated")}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-muted">
              <div>
                <p className="font-medium text-foreground">{t("monthlyReport")}</p>
                <p className="text-sm text-foreground">{t("firstOfEachMonth")}</p>
              </div>
              <Badge
                className={`cursor-pointer ${scheduledReports.monthly ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-gray-500 text-white hover:bg-gray-600"}`}
                onClick={() => toggleScheduledReport("monthly")}
              >
                {scheduledReports.monthly ? t("activated") : t("deactivated")}
              </Badge>
            </div>

            <Button
              onClick={handleConfigureReports}
              variant="outline"
              className="w-full hover:bg-accent/10 hover:text-accent"
            >
              {t("configureScheduled")}
            </Button>
          </CardContent>
        </Card>

        <Dialog open={configureOpen} onOpenChange={setConfigureOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">{t("configureScheduled")}</DialogTitle>
              <DialogDescription className="text-foreground">
                {t("manageAutoSent")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-3 p-4 rounded-lg border border-muted bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{t("conversionReport")}</p>
                  </div>
                  <Switch
                    checked={scheduledReports.conversion}
                    onCheckedChange={() => toggleScheduledReport("conversion")}
                  />
                </div>
                {scheduledReports.conversion && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-muted">
                    <div>
                      <Label htmlFor="conversionDay" className="text-foreground text-sm">{t("day")}</Label>
                      <select
                        id="conversionDay"
                        value={reportSettings.conversionDay}
                        onChange={(e) => setReportSettings({ ...reportSettings, conversionDay: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-foreground"
                      >
                        <option value="monday">{t("monday")}</option>
                        <option value="tuesday">{t("tuesday")}</option>
                        <option value="wednesday">{t("wednesday")}</option>
                        <option value="thursday">{t("thursday")}</option>
                        <option value="friday">{t("friday")}</option>
                        <option value="saturday">{t("saturday")}</option>
                        <option value="sunday">{t("sunday")}</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="conversionTime" className="text-foreground text-sm">{t("hour")}</Label>
                      <Input
                        id="conversionTime"
                        type="time"
                        value={reportSettings.conversionTime}
                        onChange={(e) => setReportSettings({ ...reportSettings, conversionTime: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 rounded-lg border border-muted bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{t("monthlyReport")}</p>
                  </div>
                  <Switch
                    checked={scheduledReports.monthly}
                    onCheckedChange={() => toggleScheduledReport("monthly")}
                  />
                </div>
                {scheduledReports.monthly && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-muted">
                    <div>
                      <Label htmlFor="monthlyDay" className="text-foreground text-sm">{t("dayOfMonth")}</Label>
                      <Input
                        id="monthlyDay"
                        type="number"
                        min="1"
                        max="31"
                        value={reportSettings.monthlyDay}
                        onChange={(e) => setReportSettings({ ...reportSettings, monthlyDay: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyTime" className="text-foreground text-sm">{t("hour")}</Label>
                      <Input
                        id="monthlyTime"
                        type="time"
                        value={reportSettings.monthlyTime}
                        onChange={(e) => setReportSettings({ ...reportSettings, monthlyTime: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setConfigureOpen(false)}
                variant="outline"
                className="flex-1"
              >
                {t("close")}
              </Button>
              <Button
                onClick={() => {
                  setConfigureOpen(false);
                  toast({
                    title: t("settingsSaved"),
                    description: `${t("conversionReport")}: ${t(reportSettings.conversionDay)} ${t("at")} ${reportSettings.conversionTime}. ${t("monthlyReport")}: ${t("dayLabel")} ${reportSettings.monthlyDay} ${t("at")} ${reportSettings.monthlyTime}`,
                  });
                }}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Reports;