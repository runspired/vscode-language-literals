// @ts-check
'use strict';

const vscode = require('vscode');

const LANGUAGE_TAGS = [
  'html', 'xhtml', 'xml',
  'css', 'less', 'scss', 'sass',
  'yaml', 'json', 'jsonc',
  'js', 'jsx', 'ts', 'tsx',
  'md',
];

const TAG_REGEX = new RegExp(
  `(?<![\\w$])(?:${LANGUAGE_TAGS.join('|')})(?![\\w$])\``,
  'g'
);

/**
 * Find the ranges of all tagged template literals in a document.
 * Returns one range per literal, spanning from the tag name to the closing backtick.
 * @param {vscode.TextDocument} doc
 * @returns {vscode.Range[]}
 */
function findTaggedTemplateRanges(doc) {
  const text = doc.getText();
  const ranges = [];

  TAG_REGEX.lastIndex = 0;

  let match;
  while ((match = TAG_REGEX.exec(text)) !== null) {
    // The opening backtick is the last char of the match
    const openBacktickOffset = match.index + match[0].length - 1;
    let i = openBacktickOffset + 1;
    let depth = 1;

    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '\\') {
        i += 2; // skip escaped character
        continue;
      }
      if (ch === '`') {
        depth--;
      }
      i++;
    }

    if (depth === 0) {
      const start = doc.positionAt(match.index);
      const end = doc.positionAt(i);
      ranges.push(new vscode.Range(start, end));
    }
  }

  return ranges;
}

const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'javascriptreact',
  'typescript', 'typescriptreact',
]);

/** @type {vscode.TextEditorDecorationType | null} */
let decorationType = null;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('languageLiterals');
  return {
    enabled: cfg.get('region.background.enabled', true),
    color: cfg.get('region.background.color', 'rgba(128, 128, 128, 0.08)'),
  };
}

function createDecorationType() {
  if (decorationType) {
    decorationType.dispose();
    decorationType = null;
  }
  const { enabled, color } = getConfig();
  if (!enabled) return;

  const isWholeLine = vscode.workspace
    .getConfiguration('languageLiterals')
    .get('region.background.wholeLine', true);

  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: color,
    isWholeLine,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
}

/** @param {vscode.TextEditor | undefined} editor */
function updateDecorations(editor) {
  if (!editor || !decorationType) return;
  const doc = editor.document;
  if (!SUPPORTED_LANGUAGES.has(doc.languageId)) return;

  editor.setDecorations(decorationType, findTaggedTemplateRanges(doc));
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  createDecorationType();

  updateDecorations(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateDecorations(editor);
    }),

    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        updateDecorations(editor);
      }
    }),

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('languageLiterals')) {
        createDecorationType();
        updateDecorations(vscode.window.activeTextEditor);
      }
    })
  );
}

function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}

module.exports = { activate, deactivate };
