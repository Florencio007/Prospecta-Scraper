/**
 * Local Agent Utilities
 * Centralizes the connection logic for the Prospecta Local Agent.
 */

export const DEFAULT_AGENT_PORT = 7842;

/**
 * Gets the current API URL for the local agent.
 * Checks localStorage for a discovered port, otherwise uses the default.
 */
export const getAgentApiUrl = (path: string = ''): string => {
  // If we are on the production domain (not localhost), use relative paths.
  // This ensures the frontend calls the co-located backend.
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isLocal) {
    const baseUrl = import.meta.env.VITE_SERVER_PUBLIC_URL || '';
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${formattedPath}`;
  }

  const customPort = localStorage.getItem('prospecta-agent-port');
  const port = customPort ? parseInt(customPort, 10) : DEFAULT_AGENT_PORT;
  const baseUrl = `http://localhost:${port}`;
  
  if (!path) return baseUrl;
  
  // Ensure path starts with /
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${formattedPath}`;
};

/**
 * Detects if the agent is online on any port in the range 7842-7852.
 * Updates localStorage if a new port is found.
 */
export const discoverAgentPort = async (): Promise<number | null> => {
  const ports = Array.from({ length: 11 }, (_, i) => DEFAULT_AGENT_PORT + i);
  
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) {
        localStorage.setItem('prospecta-agent-port', port.toString());
        return port;
      }
    } catch (e) {
      // Continue to next port
    }
  }
  
  return null;
};
