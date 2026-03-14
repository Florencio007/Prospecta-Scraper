import React from "react";
import { Logo } from "./Logo";

interface LoadingLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  message?: string;
  className?: string;
}

export function LoadingLogo({ 
  size = "md", 
  message, 
  className = "" 
}: LoadingLogoProps) {
  const containerSizeMap = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
    xl: "h-48 w-48",
  };

  const logoSizeMap = {
    sm: "sm" as const,
    md: "md" as const,
    lg: "lg" as const,
    xl: "xl" as const,
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
      <div className={`relative flex items-center justify-center ${containerSizeMap[size]}`}>
        {/* Animated outer ring - gradient border effect */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent/30 animate-spin" style={{ animationDuration: '1.5s' }} />
        
        {/* Secondary inner pulse ring */}
        <div className="absolute inset-2 rounded-full border border-accent/10 animate-pulse" />
        
        {/* The Prospecta Logo in the center */}
        <div className="relative z-10 transition-transform duration-500 hover:scale-110">
          <Logo size={logoSizeMap[size]} />
        </div>
      </div>
      
      {message && (
        <p className="text-sm font-medium text-muted-foreground animate-pulse text-center max-w-[200px]">
          {message}
        </p>
      )}
    </div>
  );
}
