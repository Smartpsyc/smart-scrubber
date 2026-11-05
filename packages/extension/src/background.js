// The service worker only wires the toolbar button to the side panel.
// It never sees case text: scrubbing, storage and restore all happen in the panel.

const openOnClick = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(openOnClick);
chrome.runtime.onStartup.addListener(openOnClick);
openOnClick();
