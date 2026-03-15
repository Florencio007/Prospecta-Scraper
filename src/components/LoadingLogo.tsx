import React from "react";
import { Logo } from "./Logo";

interface LoadingLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  message?: string;
  className?: string;
  compact?: boolean; // If true, removes vertical spacing/container
}

export function LoadingLogo({ 
  size = "md", 
  message, 
  className = "",
  compact = false
}: LoadingLogoProps) {
  const containerSizeMap = {
    xs: "h-5 w-5",
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
    xl: "h-48 w-48",
  };

  const logoSizeMap = {
    xs: "sm" as const, // Use smallest logo for xs
    sm: "sm" as const,
    md: "md" as const,
    lg: "lg" as const,
    xl: "xl" as const,
  };

  return (
    <div className={`${compact ? 'inline-flex' : 'flex flex-col'} items-center justify-center ${compact ? '' : 'space-y-4'} ${className}`}>
      <div className={`relative flex items-center justify-center ${containerSizeMap[size]}`}>
        {/* Animated outer ring */}
        <div 
          className={`absolute inset-0 rounded-full border-transparent border-t-accent border-r-accent/30 animate-spin`} 
          style={{ 
            animationDuration: '1.5s',
            borderWidth: size === 'xs' ? '1.5px' : '2px'
          }} 
        />
        
        {/* Secondary inner pulse ring - only for larger sizes */}
        {size !== 'xs' && (
          <div className="absolute inset-2 rounded-full border border-accent/10 animate-pulse" />
        )}
        
        {/* The Prospecta Logo in the center */}
        <div className={`relative z-10 transition-all duration-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full p-1.5 shadow-xl border border-white/20 dark:border-slate-700/50 ${size === 'xs' ? 'p-0.5' : 'hover:scale-110 hover:shadow-accent/20'}`}>
          <Logo size={logoSizeMap[size]} className={size === 'xs' ? 'h-3 w-3' : ''} />
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
