import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  Search,
  BarChart3,
  Download,
  Zap,
  Users,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Github,
  Linkedin,
  Mail,
  Languages,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  if (user) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Logo size="lg" />
            <div className="text-2xl font-bold text-foreground tracking-tight">Prospecta</div>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage("fr")}>
                  🇫🇷 Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage("en")}>
                  🇬🇧 English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              onClick={() => navigate("/login")}
              className="text-foreground hover:text-foreground/90"
            >
              {t("login")}
            </Button>
            <Button
              onClick={() => navigate("/login")}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {t("getStarted")}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-32 text-center">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-6xl font-bold text-foreground tracking-tight leading-tight">
            {t("findProspectsAuto").split(t("findProspectsAutoColor"))[0]}
            <br />
            <span className="text-accent">{t("findProspectsAutoColor")}</span>
            {t("findProspectsAuto").split(t("findProspectsAutoColor"))[1]}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("heroDescription")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 text-base"
          >
            {t("startFree")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-accent text-foreground hover:bg-accent/10 text-base"
          >
            {t("learnMore")}
          </Button>
        </div>

        {/* Hero Image Placeholder */}
        <div className="rounded-lg border bg-card shadow-2xl overflow-hidden">
          <div className="aspect-video bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 mx-auto text-accent mb-4 opacity-50" />
              <p className="text-muted-foreground">{t("intuitiveDashboard")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t("whyChooseProspecta")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("everythingNeeded")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: Search,
              title: t("multiChannelProspection"),
              description: t("multiChannelDesc"),
            },
            {
              icon: Users,
              title: t("dataCentralization"),
              description: t("dataCentralizationDesc"),
            },
            {
              icon: Download,
              title: t("easyExport"),
              description: t("easyExportDesc"),
            },
            {
              icon: BarChart3,
              title: t("fullDashboard"),
              description: t("fullDashboardDesc"),
            },
            {
              icon: Zap,
              title: t("automation"),
              description: t("automationDesc"),
            },
            {
              icon: TrendingUp,
              title: t("analysisAndReports"),
              description: t("analysisAndReportsDesc"),
            },
          ].map((feature, index) => (
            <div key={index} className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow hover:border-accent/50">
              <feature.icon className="h-8 w-8 text-accent mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 bg-card rounded-lg border">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t("howItWorks")}
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: "1", title: t("step1"), desc: t("step1Desc") },
            { step: "2", title: t("step2"), desc: t("step2Desc") },
            { step: "3", title: t("step3"), desc: t("step3Desc") },
            { step: "4", title: t("step4"), desc: t("step4Desc") },
          ].map((item, index) => (
            <div key={index} className="text-center relative">
              <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
              {index < 3 && (
                <div className="hidden md:block absolute top-6 -right-2 text-accent">
                  <ArrowRight className="h-6 w-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t("simplePricing")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("startFreePricing")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: t("starterPlan"),
              price: t("starterPrice"),
              desc: t("starterDesc"),
              features: [
                t("feature50Prospects"),
                t("featureGoogleSearch"),
                t("featureCSVExport"),
                t("featureSupportEmail"),
              ],
            },
            {
              name: t("proPlan"),
              price: t("proPrice"),
              desc: t("proDesc"),
              featured: true,
              features: [
                t("featureUnlimitedProspects"),
                t("featureAllChannels"),
                t("featureN8nIntegration"),
                t("featureExcelExport"),
                t("featureAdvancedReports"),
                t("featurePrioritySupport"),
              ],
            },
            {
              name: t("enterprisePlan"),
              price: t("enterprisePrice"),
              desc: t("enterpriseDesc"),
              features: [
                t("featureAllProPlans"),
                t("featureUnlimitedUsers"),
                t("featureCustomAPI"),
                t("featureN8nIntegration"),
                t("featureDedicatedOnboarding"),
              ],
            },
          ].map((plan, index) => (
            <div
              key={index}
              className={`p-8 rounded-lg border transition-all ${plan.featured
                ? "bg-gradient-to-br from-accent/10 to-primary/10 border-accent shadow-lg scale-105"
                : "bg-card hover:shadow-lg"
                }`}
            >
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
              <p className="text-muted-foreground mb-4">{plan.desc}</p>
              <div className="text-3xl font-bold text-accent mb-6">{plan.price}</div>
              <Button
                className={`w-full mb-6 ${plan.featured
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "border-accent text-accent hover:bg-accent/10"
                  }`}
                variant={plan.featured ? "default" : "outline"}
                onClick={() => navigate("/login")}
              >
                {t("choosePlan")}
              </Button>
              <div className="space-y-3">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-20 text-center">
        <div className="bg-gradient-to-r from-primary to-accent p-12 rounded-lg">
          <h2 className="text-3xl sm:text-4xl font-bold text-accent-foreground mb-4">
            {t("readyToTransform")}
          </h2>
          <p className="text-lg text-accent-foreground/80 mb-8">
            {t("joinHundreds")}
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="bg-accent-foreground text-primary hover:bg-accent-foreground/90 text-base"
          >
            {t("startNow")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-foreground mb-4">Prospecta</h3>
              <p className="text-sm text-muted-foreground">
                {t("platformDescription")}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t("product")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">{t("features")}</a></li>
                <li><a href="#" className="hover:text-foreground">{t("pricing")}</a></li>
                <li><a href="#" className="hover:text-foreground">{t("security")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t("resources")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">{t("documentation")}</a></li>
                <li><a href="#" className="hover:text-foreground">{t("blog")}</a></li>
                <li><a href="#" className="hover:text-foreground">{t("support")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t("followUs")}</h4>
              <div className="flex gap-4">
                <a href="#" title="LinkedIn" className="text-muted-foreground hover:text-foreground">
                  <Linkedin className="h-5 w-5" />
                </a>
                <a href="#" title="GitHub" className="text-muted-foreground hover:text-foreground">
                  <Github className="h-5 w-5" />
                </a>
                <a href="#" title="Email" className="text-muted-foreground hover:text-foreground">
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>&copy; 2026 Prospecta. {t("allRightsReserved")}</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <a href="#" className="hover:text-foreground">{t("termsOfUse")}</a>
              <a href="#" className="hover:text-foreground">{t("privacyPolicy")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
