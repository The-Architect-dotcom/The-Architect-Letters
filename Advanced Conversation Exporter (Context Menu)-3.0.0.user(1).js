// ==UserScript==
// @name         Advanced Conversation Exporter (Context Menu)
// @namespace    https://github.com/The-Architect-dotcom
// @version      3.0.0
// @description  Export conversations as beautiful HTML files with syntax highlighting and JSON (normal + LZW compressed) - Context Menu Only
// @author       Faizal Randy
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @grant        GM_registerMenuCommand
// @license      MIT
// @homepageURL  https://github.com/The-Architect-dotcom/The-Architect-Letters
// @supportURL   https://github.com/The-Architect-dotcom/The-Architect-Letters/issues
// ==/UserScript==

(function() {
    'use strict';

    console.log('Advanced Exporter by Faizal Randy - Loading...');

    // -------------------
    // Lightweight LZW encoder for compression output
    // returns array of codes joined by comma (compact string)
    function lzwEncodeString(s) {
        if (!s) return '';
        const dict = new Map();
        for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
        let phrase = '';
        let code = 256;
        const output = [];
        for (let i = 0; i < s.length; i++) {
            const c = s.charAt(i);
            const pc = phrase + c;
            if (dict.has(pc)) {
                phrase = pc;
            } else {
                output.push(dict.get(phrase || c.charAt(0)));
                dict.set(pc, code++);
                phrase = c;
            }
        }
        if (phrase !== '') output.push(dict.get(phrase));
        return output.join(',');
    }
    // -------------------

    // Collect conversation from Claude.ai structure
    function collectConversationFromClaude() {
        const conversation = [];

        // Claude.ai uses different selectors - let's find the conversation container
        const conversationContainer = document.querySelector('[data-testid="conversation"]') ||
              document.querySelector('div[class*="conversation"]') ||
              document.querySelector('main');

        if (!conversationContainer) {
            throw new Error('Could not find conversation container');
        }

        // Look for message elements - Claude uses various patterns
        const messageSelectors = [
            '[data-testid="user-message"]',
            '[data-testid="assistant-message"]',
            'div[class*="message"]',
            'div[class*="user"]',
            'div[class*="assistant"]',
            'div[class*="human"]',
            'div[class*="claude"]'
        ];

        let messages = [];

        // Try different selectors to find messages
        for (const selector of messageSelectors) {
            const found = conversationContainer.querySelectorAll(selector);
            if (found.length > 0) {
                messages = Array.from(found);
                break;
            }
        }

        // Fallback: look for any div that might contain conversation
        if (messages.length === 0) {
            // Look for alternating pattern in main content
            const allDivs = Array.from(conversationContainer.querySelectorAll('div'));
            messages = allDivs.filter(div => {
                const text = div.innerText?.trim();
                return text && text.length > 10 &&
                    !div.querySelector('button') &&
                    !div.querySelector('input');
            });
        }

        if (messages.length === 0) {
            throw new Error('No conversation messages found. Make sure you are viewing a conversation.');
        }

        // Process messages and detect role
        messages.forEach((messageEl, index) => {
            const text = messageEl.innerText?.trim() || '';
            if (!text || text.length < 3) return;

            // Try to detect role from element attributes/classes
            let role = 'unknown';
            const elementClass = messageEl.className || '';
            const elementId = messageEl.id || '';
            const testId = messageEl.getAttribute('data-testid') || '';

            // Role detection logic
            if (testId.includes('user') || elementClass.includes('user') || elementClass.includes('human')) {
                role = 'user';
            } else if (testId.includes('assistant') || testId.includes('claude') || elementClass.includes('assistant') || elementClass.includes('claude')) {
                role = 'assistant';
            } else {
                // Fallback to alternating pattern (assuming first message is user)
                role = (index % 2 === 0) ? 'user' : 'assistant';
            }

            conversation.push({
                role: role,
                content: text,
                timestamp: new Date().toISOString(),
                index: index + 1
            });
        });

        return conversation;
    }

    // Export conversation to JSON (normal or compressed)
    function exportToJSON(compress = false) {
        try {
            console.log('📥 Starting JSON export...', compress ? '(Compressed)' : '(Normal)');

            const conversation = collectConversationFromClaude();

            if (conversation.length === 0) {
                alert('❌ No conversation found to export!');
                return;
            }

            const meta = {
                platform: 'Claude.ai',
                url: window.location.href,
                timestamp: new Date().toISOString(),
                compression: compress ? 'LZW' : 'none',
                messageCount: conversation.length,
                exportedBy: 'Claude.ai Advanced Exporter by Faizal Randy'
            };

            let payload;
            if (compress) {
                // Compress the JSON string of the conversation
                const convString = JSON.stringify(conversation);
                const compressed = lzwEncodeString(convString);
                payload = {
                    meta,
                    compressedContent: compressed,
                    note: 'LZW compressed numeric codes, join by comma. Use LZW decoder to restore original conversation.'
                };
            } else {
                payload = { meta, conversation };
            }

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const now = new Date();
            const timestamp = now.toISOString().slice(0,19).replace(/[:]/g,'-');
            const filename = compress ?
                  `claude-conversation-${timestamp}-compressed.json` :
            `claude-conversation-${timestamp}.json`;

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('✅ JSON export successful!', filename);
            alert(`✅ Successfully exported ${conversation.length} messages to ${filename}`);

        } catch (error) {
            console.error('❌ JSON export failed:', error);
            alert('❌ JSON export failed: ' + error.message);
        }
    }

    // Export conversation to HTML
    function exportToHTML() {
        try {
            console.log('📥 Starting HTML export...');

            const conversation = collectConversationFromClaude();

            if (conversation.length === 0) {
                alert('❌ No conversation found to export!');
                return;
            }

            const htmlContent = generateHTML(conversation);
            downloadHTML(htmlContent);

            console.log('✅ HTML export successful!');

        } catch (error) {
            console.error('❌ HTML export failed:', error);
            alert('❌ HTML export failed: ' + error.message);
        }
    }

    // Generate beautiful HTML from conversation
    function generateHTML(conversation) {
        let userMessages = 0;
        let assistantMessages = 0;

        conversation.forEach(msg => {
            if (msg.role === 'user') userMessages++;
            else if (msg.role === 'assistant') assistantMessages++;
        });

        let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude.ai Conversation Export</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/atom-one-dark.min.css">
    <style>
        :root {
            --primary-color: #DEDDDA;
            --user-color: #ff6b6b;
            --assistant-color: #4ecdc4;
            --claude-color: #ff7f50;
            --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            --font-size: 16px;
            --bg-dark: #1a1a1a;
            --bg-user: #2d1b1b;
            --bg-assistant: #1b2d2a;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--font-family);
            font-size: var(--font-size);
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: var(--primary-color);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            min-height: 100vh;
        }

        .export-container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
        }

        .control-panel {
            position: sticky;
            top: 20px;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
            z-index: 100;
            border: 1px solid #333;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .control-panel label {
            color: var(--primary-color);
            font-size: 14px;
            font-weight: 500;
            min-width: fit-content;
        }

        .control-panel select,
        .control-panel input[type="color"],
        .control-panel input[type="number"],
        .control-panel input[type="range"] {
            padding: 8px 12px;
            border: 1px solid #444;
            background: #2a2a2a;
            color: var(--primary-color);
            border-radius: 6px;
            font-size: 14px;
            min-width: 60px;
        }

        .control-panel input[type="color"] {
            width: 40px;
            height: 40px;
            padding: 0;
            border-radius: 8px;
            cursor: pointer;
        }

        .export-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
            border-radius: 16px;
            border: 1px solid #333;
        }

        .export-title {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 10px 0;
            background: linear-gradient(45deg, var(--user-color), var(--claude-color));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .export-subtitle {
            color: #888;
            font-size: 16px;
            margin: 0 0 20px 0;
        }

        .export-timestamp {
            color: var(--claude-color);
            font-size: 14px;
            font-family: 'Courier New', monospace;
            background: rgba(255, 127, 80, 0.1);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
        }

        .conversation {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .message {
            padding: 24px;
            border-radius: 16px;
            position: relative;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(5px);
        }

        .user-message {
            background: linear-gradient(135deg, var(--bg-user) 0%, #3d2323 100%);
            margin-left: 10%;
            border-left: 4px solid var(--user-color);
        }

        .assistant-message {
            background: linear-gradient(135deg, var(--bg-assistant) 0%, #234d47 100%);
            margin-right: 10%;
            border-left: 4px solid var(--claude-color);
        }

        .message-role {
            font-weight: 700;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .user-message .message-role {
            color: var(--user-color);
        }

        .assistant-message .message-role {
            color: var(--claude-color);
        }

        .message-role::before {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
        }

        .message-content {
            color: var(--primary-color);
            line-height: 1.7;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .message-content h1, .message-content h2, .message-content h3,
        .message-content h4, .message-content h5, .message-content h6 {
            margin: 24px 0 16px 0;
            line-height: 1.3;
        }

        .code-block {
            background: #282c34 !important;
            color: #abb2bf !important;
            padding: 20px !important;
            margin: 20px 0 !important;
            border-radius: 12px !important;
            border: 1px solid #3e4451 !important;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
            overflow-x: auto !important;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        .stats-bar {
            margin-top: 40px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            text-align: center;
            font-size: 14px;
            color: #888;
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }

            .control-panel {
                flex-direction: column;
                align-items: stretch;
            }

            .message {
                margin-left: 0 !important;
                margin-right: 0 !important;
                padding: 16px;
            }

            .export-title {
                font-size: 24px;
            }
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"></script>
</head>
<body>
    <div class="export-container">
        <div class="control-panel">
            <div class="control-group">
                <label>🎨 Theme:</label>
                <input type="color" value="#DEDDDA" onchange="updatePrimaryColor(this.value)">
            </div>
            <div class="control-group">
                <label>👤 User Color:</label>
                <input type="color" value="#ff6b6b" onchange="updateUserColor(this.value)">
            </div>
            <div class="control-group">
                <label>🤖 Claude Color:</label>
                <input type="color" value="#ff7f50" onchange="updateClaudeColor(this.value)">
            </div>
            <div class="control-group">
                <label>📝 Font:</label>
                <select onchange="updateFont(this.value)">
                    <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">System Default</option>
                    <option value="'Arial', sans-serif">Arial</option>
                    <option value="'Georgia', serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Courier New', monospace">Courier New</option>
                </select>
            </div>
            <div class="control-group">
                <label>📏 Size:</label>
                <input type="range" min="12" max="24" value="16" onchange="updateFontSize(this.value)">
                <span id="font-size-display">16px</span>
            </div>
        </div>

        <div class="export-header">
            <h1 class="export-title">🤖 Claude.ai Conversation</h1>
            <p class="export-subtitle">Exported with Advanced Conversation Exporter</p>
            <p class="export-subtitle">🌟 Created by Faizal Randy</p>
            <div class="export-timestamp">📅 ${new Date().toLocaleString()}</div>
        </div>

        <div class="conversation">`;

        // Add conversation messages
        conversation.forEach((message, index) => {
            const isUser = message.role === 'user';
            const roleDisplay = isUser ? '👤 User' : '🤖 Claude';
            const messageClass = isUser ? 'user-message' : 'assistant-message';

            // Clean and format content
            let content = message.content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

            htmlContent += `
            <div class="message ${messageClass}" data-message="${index + 1}">
                <div class="message-role">${roleDisplay}</div>
                <div class="message-content">${content}</div>
            </div>`;
        });

        htmlContent += `
        </div>

        <div class="stats-bar">
            📊 <strong>${conversation.length}</strong> messages total •
            👤 <strong>${userMessages}</strong> user messages •
            🤖 <strong>${assistantMessages}</strong> Claude responses •
            🌟 Exported by <em>Claude.ai Advanced Exporter</em>
        </div>
    </div>

    <script>
        function updatePrimaryColor(color) { document.documentElement.style.setProperty('--primary-color', color); }
        function updateUserColor(color) { document.documentElement.style.setProperty('--user-color', color); }
        function updateClaudeColor(color) { document.documentElement.style.setProperty('--claude-color', color); }
        function updateFont(font) { document.documentElement.style.setProperty('--font-family', font); }
        function updateFontSize(size) {
            document.documentElement.style.setProperty('--font-size', size + 'px');
            document.getElementById('font-size-display').textContent = size + 'px';
        }

        document.addEventListener('DOMContentLoaded', function() {
            if (typeof hljs !== 'undefined') {
                hljs.highlightAll();
            }
        });

        console.log('conversation exported successfully!');
        console.log('📝 Total messages: ${conversation.length}');
        console.log('👤 User messages: ${userMessages}');
        console.log('🤖 Claude messages: ${assistantMessages}');
        console.log('🚀 Created by Faizal Randy');
    </script>
</body>
</html>`;

        return htmlContent;
    }

    // Download HTML file
    function downloadHTML(htmlContent) {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[:]/g, '-');
        link.download = `claude-conversation-${timestamp}.html`;

        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        console.log('✅ HTML file downloaded successfully!');
        alert('✅ Conversation exported as beautiful HTML file!');
    }

    // Register Tampermonkey context menu commands
    function registerMenuCommands() {
        GM_registerMenuCommand('📄 Export as HTML', exportToHTML, 'h');
        GM_registerMenuCommand('📋 Export as JSON (Normal)', () => exportToJSON(false), 'j');
        GM_registerMenuCommand('🗜️ Export as JSON (Compressed)', () => exportToJSON(true), 'c');
        GM_registerMenuCommand('ℹ️ About Exporter', showAbout, 'a');
    }

    // Show about dialog
    function showAbout() {
        alert(`Advanced Conversation Exporter v3.0.0

🚀 Created by Faizal Randy

Features:
• 📄 Export conversations as beautiful HTML files
• 📋 Export as JSON (normal format)
• 🗜️ Export as JSON (LZW compressed)
• 🎨 Customizable themes and colors
• 📱 Mobile-friendly responsive design

Context Menu Commands:
• Right-click → Tampermonkey → Export options

🌟 Perfect for preserving your conversations with Claude!
💡 Great for content creators and researchers!

GitHub: The-Architect-dotcom/The-Architect-Letters`);
    }

    // Initialize the script
    function init() {
        console.log('🚀 Claude.ai Advanced Exporter initialized!');
        console.log('📋 Right-click and check Tampermonkey menu for export options!');
        registerMenuCommands();
    }

    // Start when page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();