# 🤖 LeetCode AI Mentor

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore)
[![Gemini API](https://img.shields.io/badge/Powered%20by-Gemini%20API-4285F4.svg)](https://ai.google.dev/)

An intelligent Chrome extension that transforms your LeetCode experience by providing **AI-powered hints** instead of full solutions. Built with Google's Gemini API, it helps you learn and improve your coding skills incrementally.

## ✨ Features

- **🧠 Smart Hints Only**: Get incremental guidance without spoilers – perfect for learning
- **💬 Interactive Chat**: Ask questions and receive contextual hints based on your current code
- **🎯 Monaco Editor Integration**: Seamlessly reads your code from LeetCode's editor
- **🔒 Privacy First**: Your API key is stored locally and never shared
- **⚡ Real-time Updates**: Detects problem changes and code edits automatically

## 🚀 Installation

### Prerequisites

- Google Chrome browser
- A [Google Gemini API key](https://makersuite.google.com/app/apikey) (free tier available)

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/leetcode-ai-mentor.git
   cd leetcode-ai-mentor
   ```

2. **Get your Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key (keep it safe!)

3. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the project folder

4. **Activate the extension**
   - Click the extension icon in Chrome toolbar
   - Enter your Gemini API key
   - Click "Save & Activate"

## 📖 Usage

1. **Navigate to any LeetCode problem**
2. **Click the 🤖 bot** in the bottom-right corner
3. **Start chatting!**
   - Click "Hint" for general guidance
   - Ask specific questions about your approach
   - Get help debugging your code

### Example Interaction

```
You: "I'm stuck on this two-pointer problem"
Mentor: "Line 5: `if (left < right)` — Consider what happens when the pointers meet.
         What condition should trigger the swap?"
```

## 🔧 How It Works

The extension uses advanced DOM manipulation to:

- **Read Problem Statements**: Extracts text from LeetCode's dynamic content
- **Monitor Code Changes**: Integrates with Monaco editor's API for real-time code reading
- **AI-Powered Hints**: Sends context to Gemini with strict instructions to provide hints only
- **Secure Communication**: Direct API calls with your personal key

**Happy coding! 🚀** If you find this helpful, please star the repo and share with fellow coders.
