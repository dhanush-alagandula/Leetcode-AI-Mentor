// injected.js

(function () {
    console.log("LeetCode AI: Injected script loaded");

    let editorModel = null;
    let lastCode = "";

    function findMonaco() {
        if (window.monaco && window.monaco.editor) {
            const editors = window.monaco.editor.getEditors();
            if (editors.length > 0) {
                // Usually the first editor is the main one
                const editor = editors[0];
                const model = editor.getModel();

                if (model) {
                    console.log("LeetCode AI: Monaco Editor Model found");
                    editorModel = model;

                    // Send initial code
                    const code = model.getValue();
                    sendCode(code);

                    // Listen for changes
                    model.onDidChangeContent(() => {
                        const newCode = model.getValue();
                        // Debounce slightly if needed, but for now sending directly is fine
                        // or we can rely on the content script to debounce.
                        // Let's just send it.
                        sendCode(newCode);
                    });
                    return true;
                }
            }
        }
        return false;
    }

    function sendCode(code) {
        if (code !== lastCode) {
            lastCode = code;
            window.postMessage({ type: "LEETCODE_AI_CODE_UPDATE", code: code }, "*");
        }
    }

    // Poll until Monaco is ready
    const interval = setInterval(() => {
        if (findMonaco()) {
            clearInterval(interval);
        }
    }, 500);

    // Stop polling after 30 seconds if not found
    setTimeout(() => clearInterval(interval), 30000);
})();
