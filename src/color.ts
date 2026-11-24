import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/language/json/json.worker?worker";
import cssWorker from "monaco-editor/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/language/html/html.worker?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker?worker";

// 1. Register Monaco Web Workers
export function initMonacoWorkers(): void {
    self.MonacoEnvironment = {
        getWorker(_, label) {
            if (label === "json") return new jsonWorker();
            if (label === "css") return new cssWorker();
            if (label === "html") return new htmlWorker();
            if (label === "typescript" || label === "javascript") return new tsWorker();
            return new editorWorker();
        },
    };
}

// 2. Define the IDE Color Theme
export function registerCustomTheme(): void {
    monaco.editor.defineTheme("web-ide-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "tag", foreground: "569CD6" },           // HTML tag color
            { token: "attribute.name", foreground: "9CDCFE" }, // Atribute color
            { token: "attribute.value", foreground: "CE9178" },// Atribute value color
            { token: "keyword", foreground: "C586C0" },        // Keyword colors, JS
            { token: "string", foreground: "CE9178" },         // String colors
            { token: "number", foreground: "B5CEA8" },         // Value colors
            { token: "comment", foreground: "6A9955", fontStyle: "italic" }, // Comment color
        ],
        colors: {
            "editor.background": "#1e1e1e",
            "editor.lineHighlightBackground": "#2a2d2e",
            "editorLineNumber.foreground": "#858585",
            "editorCursor.foreground": "#aeafad",
        },
    });
    monaco.css.cssDefaults.setOptions({
        validate: false,
    });
}

// Detect Language from File Extension
export function getLanguageForFile(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "html": // HTML
        case "htm":
            return "html";
        case "css": // CSS
            return "css";
        case "js": // Javascript
        case "mjs":
            return "javascript";
        case "ts": // Typescript
            return "typescript";
        case "json": // JSON
            return "json";
        default: // Just return plain text if not those
            return "plaintext";
    }
}

// Switch syntax color coding
export function applyFileColorCoding(
    editor: monaco.editor.IStandaloneCodeEditor,
    fileName: string
): void {
    const model = editor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, getLanguageForFile(fileName));
    }
}