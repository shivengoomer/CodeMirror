chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("codemirror-notification-poll", { periodInMinutes: 30 });
});
