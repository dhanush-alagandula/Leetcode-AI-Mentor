document.addEventListener("DOMContentLoaded", () => {
    console.log("Popup loaded");
  
    const notLeetcodeDiv = document.getElementById("notLeetcode");
    const setupUIDiv = document.getElementById("setupUI");
    const input = document.getElementById("apiKey");
    const status = document.getElementById("status");
    const button = document.getElementById("saveBtn");
  
    if (!notLeetcodeDiv || !setupUIDiv || !input || !status || !button) {
      console.error("Popup DOM not loaded correctly");
      return;
    }
  
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || "";
  
      if (!url.includes("leetcode.com")) {
        notLeetcodeDiv.style.display = "block";
        setupUIDiv.style.display = "none";
        return;
      }
  
      notLeetcodeDiv.style.display = "none";
      setupUIDiv.style.display = "block";
  
      chrome.storage.sync.get(["geminiKey"], (result) => {
        if (result.geminiKey) {
          input.value = result.geminiKey;
          status.textContent = "API key already saved";
        }
      });
    });
  
    button.addEventListener("click", () => {
      const key = input.value.trim();
  
      if (!key) {
        status.textContent = "Please enter a valid API key";
        return;
      }
  
      chrome.storage.sync.set({ geminiKey: key }, () => {
        status.textContent = "API key saved successfully";
      });
    });
  });