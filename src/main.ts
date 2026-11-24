import * as monaco from "monaco-editor"; // imports
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { HTML, CSS, Document, CodeSymbol } from "./parser";
import { initMonacoWorkers, registerCustomTheme, applyFileColorCoding } from "./color";

initMonacoWorkers();
registerCustomTheme();

// consts
const openFolderBtn = document.getElementById("open-folder-btn") as HTMLButtonElement;
const saveFileBtn = document.getElementById("save-file-btn") as HTMLButtonElement;
const fileTreeEl = document.getElementById("file-tree") as HTMLDivElement;
const activeFileEl = document.getElementById("active-file") as HTMLSpanElement;
const editorContainer = document.getElementById("editor") as HTMLDivElement;
const previewEl = document.getElementById("preview") as HTMLIFrameElement;
const statsEl = document.getElementById("inspector-stats") as HTMLDivElement;
const symbolListEl = document.getElementById("symbol-list") as HTMLDivElement;

const editor = monaco.editor.create(editorContainer, {
  value: "<!-- Open a folder -->",
  language: "html",
  theme: "ide-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 14,
});

let currentFolder = "";
let currentFilePath = "";
let activeHtmlPath = ""; // Remembers the project's main HTML file

// Open Folder
openFolderBtn.addEventListener("click", async () => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Project Folder",
  });

  if (typeof selected === "string") {
    currentFolder = selected;
    activeHtmlPath = "";
    await renderFileTree(currentFolder);
  }
});

// Render Left Directory Explorer
async function renderFileTree(folderPath: string): Promise<void> {
  const entries = await readDir(folderPath);
  fileTreeEl.innerHTML = "";

  entries.sort(
    (a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)
  );

  // Auto-detect index.html for main html doc
  const defaultHtml =
    entries.find((e) => !e.isDirectory && e.name.toLowerCase() === "index.html") ??
    entries.find((e) => !e.isDirectory && e.name.toLowerCase().endsWith(".html"));
  if (defaultHtml) {
    activeHtmlPath = `${folderPath}\\${defaultHtml.name}`;
  }

  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "file-item";
    item.textContent = `${entry.isDirectory ? ">" : "|"} ${entry.name}`;

    if (!entry.isDirectory) {
      item.addEventListener("click", () => {
        document.querySelectorAll(".file-item").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        openFile(`${folderPath}\\${entry.name}`, entry.name);
      });
    }

    fileTreeEl.appendChild(item);
  }
}

// Open File
async function openFile(fullPath: string, fileName: string): Promise<void> {
  currentFilePath = fullPath;
  if (fileName.toLowerCase().endsWith(".html") || fileName.toLowerCase().endsWith(".htm")) {
    activeHtmlPath = fullPath;
  }

  activeFileEl.textContent = fileName;
  const content = await readTextFile(fullPath);
  applyFileColorCoding(editor, fileName);
  editor.setValue(content);

  await updateInspectorAndPreview();
}

// Bundle Linked local CSS & JS files into the preview iframe
async function buildLivePreview(): Promise<void> {
  if (!activeHtmlPath || !currentFolder) return;

  // Use unsaved editor text if currently editing the HTML file, otherwise read from disk
  let htmlCode =
    currentFilePath === activeHtmlPath ? editor.getValue() : await readTextFile(activeHtmlPath);

  // Replace the link with inline CSS
  const linkMatches = [...htmlCode.matchAll(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi)];
  for (const match of linkMatches) {
    const fullTag = match[0];
    const relPath = match[1] ?? "";
    if (/^https?:\/\//i.test(relPath)) continue; // Leave external CDN links intact

    const cleanRel = relPath.replace(/^\.?\//, "").replace(/\//g, "\\");
    const targetCssPath = `${currentFolder}\\${cleanRel}`;

    try {
      const cssContent =
        currentFilePath === targetCssPath ? editor.getValue() : await readTextFile(targetCssPath);
      htmlCode = htmlCode.replace(fullTag, `<style>\n${cssContent}\n</style>`);
    } catch {
      // Ignore if file doesn't exist yet
    }
  }

  // Replace external JS with inline JS
  const scriptMatches = [...htmlCode.matchAll(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi)];
  for (const match of scriptMatches) {
    const fullTag = match[0];
    const relPath = match[1] ?? "";
    if (/^https?:\/\//i.test(relPath)) continue;

    const cleanRel = relPath.replace(/^\.?\//, "").replace(/\//g, "\\");
    const targetJsPath = `${currentFolder}\\${cleanRel}`;

    try {
      const jsContent =
        currentFilePath === targetJsPath ? editor.getValue() : await readTextFile(targetJsPath);
      htmlCode = htmlCode.replace(fullTag, `<script>\n${jsContent}\n<\/script>`);
    } catch {
      // Ignore if file doesn't exist yet
    }
  }

  previewEl.srcdoc = htmlCode;
}

// Update Right Inspector + Live Preview
async function updateInspectorAndPreview(): Promise<void> {
  const code = editor.getValue();
  const lower = currentFilePath.toLowerCase();

  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    const doc = new HTML(code);
    statsEl.innerHTML = `Lines: ${doc.lines}<br/>Classes: ${doc.countClasses()}<br/>IDs: ${doc.countIds()}`;
    renderSymbols(doc.findSymbols());
  } else if (lower.endsWith(".css")) {
    const doc = new CSS(code);
    statsEl.innerHTML = `Lines: ${doc.lines}<br/>Classes: ${doc.countClasses()}<br/>IDs: ${doc.countIds()}`;
    renderSymbols(doc.findSymbols());
  } else {
    const doc = new Document(code);
    statsEl.innerHTML = `Lines: ${doc.lines}<br/>Classes: —<br/>IDs: —`;
    symbolListEl.innerHTML = "";
  }

  await buildLivePreview();
}

function renderSymbols(symbols: CodeSymbol[]): void {
  symbolListEl.innerHTML = "";
  for (const s of symbols) {
    const row = document.createElement("div");
    row.className = "symbol-item";
    row.innerHTML = `<span class="badge">${s.type === "class" ? "." : "#"}${s.name}</span><span>L${s.line}</span>`;
    row.addEventListener("click", () => {
      editor.revealLineInCenter(s.line);
      editor.setPosition({ lineNumber: s.line, column: s.column });
      editor.focus();
    });
    symbolListEl.appendChild(row);
  }
}

let previewTimer: number;
editor.onDidChangeModelContent(() => {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(updateInspectorAndPreview, 250);
});

// Save File
async function saveCurrentFile(): Promise<void> {
  if (!currentFilePath) return;
  await writeTextFile(currentFilePath, editor.getValue());
  const fileName = currentFilePath.split("\\").pop() ?? "";
  activeFileEl.textContent = `${fileName} (Saved)`;
}

saveFileBtn.addEventListener("click", saveCurrentFile);
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrentFile();
  }
});

// Resizer Bars
function setupResizers(): void {
  const workspace = document.getElementById("workspace") as HTMLElement;
  const middlePane = document.getElementById("middle-pane") as HTMLElement;
  const leftResizer = document.getElementById("resizer-left") as HTMLElement;
  const rightResizer = document.getElementById("resizer-right") as HTMLElement;
  const midResizer = document.getElementById("resizer-mid") as HTMLElement;

  let leftWidth = 220;
  let rightWidth = 260;
  let activeResizer: "left" | "right" | "mid" | null = null;

  const startDrag = (type: "left" | "right" | "mid", el: HTMLElement) => {
    activeResizer = type;
    el.classList.add("resizing");
    previewEl.style.pointerEvents = "none"; // Prevents iframe from being too small
    document.body.style.userSelect = "none";
  };

  leftResizer.addEventListener("mousedown", () => startDrag("left", leftResizer));
  rightResizer.addEventListener("mousedown", () => startDrag("right", rightResizer));
  midResizer.addEventListener("mousedown", () => startDrag("mid", midResizer));

  window.addEventListener("mousemove", (e) => {
    if (!activeResizer) return;

    if (activeResizer === "left") {
      leftWidth = Math.max(120, Math.min(e.clientX, window.innerWidth - rightWidth - 200));
      workspace.style.gridTemplateColumns = `${leftWidth}px 5px 1fr 5px ${rightWidth}px`;
    } else if (activeResizer === "right") {
      rightWidth = Math.max(140, Math.min(window.innerWidth - e.clientX, window.innerWidth - leftWidth - 200));
      workspace.style.gridTemplateColumns = `${leftWidth}px 5px 1fr 5px ${rightWidth}px`;
    } else if (activeResizer === "mid") {
      const rect = middlePane.getBoundingClientRect();
      const topHeight = Math.max(80, Math.min(e.clientY - rect.top, rect.height - 80));
      middlePane.style.gridTemplateRows = `${topHeight}px 5px 1fr`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (!activeResizer) return;
    activeResizer = null;
    leftResizer.classList.remove("resizing");
    rightResizer.classList.remove("resizing");
    midResizer.classList.remove("resizing");
    previewEl.style.pointerEvents = "auto";
    document.body.style.userSelect = "";
  });
}

setupResizers();