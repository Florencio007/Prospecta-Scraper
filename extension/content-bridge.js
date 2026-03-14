// Inject the real bridge into the page DOM
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen to messages from the injected script (Vercel App)
window.addEventListener("MESSAGE_FROM_VERCEL", (event) => {
    // Forward message to the extension Background Service Worker
    chrome.runtime.sendMessage(event.detail, (response) => {
        // Send the response back to Vercel App
        window.dispatchEvent(new CustomEvent("MESSAGE_FROM_EXTENSION", { detail: response }));
    });
});

// Listen to progress events from the Background Service Worker and relay them to Vercel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROSPECT_FOUND' || message.type === 'SCRAPE_PROGRESS') {
        window.dispatchEvent(new CustomEvent("EVENT_FROM_EXTENSION", { detail: message }));
    }
});
