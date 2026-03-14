// This script runs in the actual Vercel Web App DOM context
window.__PROSPECTA_EXTENSION__ = {
    installed: true,
    version: "1.0.0",
    
    // Function to start a search request to the extension
    startSearch: function(params) {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            
            // Temporary listener for the final response
            const responseListener = (event) => {
                const response = event.detail;
                if (response.requestId === requestId) {
                    window.removeEventListener("MESSAGE_FROM_EXTENSION", responseListener);
                    if (response.error) reject(new Error(response.error));
                    else resolve(response.data);
                }
            };
            window.addEventListener("MESSAGE_FROM_EXTENSION", responseListener);
            
            // Send the command
            window.dispatchEvent(new CustomEvent("MESSAGE_FROM_VERCEL", { 
                detail: { 
                    command: "START_SCRAPE", 
                    params: params,
                    requestId: requestId
                }
            }));
        });
    },

    // Function to listen to streaming progress events (like SSE)
    onProgress: function(callback) {
        const listener = (event) => callback(event.detail);
        window.addEventListener("EVENT_FROM_EXTENSION", listener);
        return () => window.removeEventListener("EVENT_FROM_EXTENSION", listener);
    }
};
console.log("🚀 Prospecta Native Agent Injecté et Prêt !");
