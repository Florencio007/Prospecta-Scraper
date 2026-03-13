interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "md", className = "" }: LogoProps) {
  const sizeMap = {
    sm: "h-6 w-auto",
    md: "h-8 w-auto",
    lg: "h-10 w-auto",
    xl: "h-16 w-auto",
  };

  return (
    <>
      {/* Logo clair (affichage en light mode) */}
      <img
        src="/logo_prospecta_dark.png"
        alt="Prospecta"
        className={`${sizeMap[size]} ${className} block dark:hidden`}
      />
      {/* Logo sombre (affichage en dark mode) */}
      <img
        src="/logo_prospecta_claire.png"
        alt="Prospecta"
        className={`${sizeMap[size]} ${className} hidden dark:block`}
      />
    </>
  );
}
