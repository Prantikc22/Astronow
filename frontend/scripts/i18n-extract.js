#!/usr/bin/env node
// Lists user-visible English strings in app/ and src/ that are missing from
// src/i18n/translations.json. Usage: node scripts/i18n-extract.js [--json]
//
// Keys follow the catalog's convention: plain text is stored as-is, and
// template literals keep their `${expression}` source so the runtime matcher
// can interpolate values into the translated sentence.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const DIRS = ["app", "src"];
const SKIP = [/src[\\/]api[\\/]preview\.ts$/, /src[\\/]i18n[\\/]/, /error-boundary\.tsx$/];
// Props whose string values are shown to people (not ids or styles).
const TEXT_PROPS = new Set(["label", "title", "subtitle", "placeholder", "eyebrow", "action", "kicker", "note", "detail",
  "sub", "body", "cta", "copy", "text", "message", "caption", "question", "reason", "fallbackTitle", "colorName", "tone", "q", "planet"]);

// Sentences the API generates in English; the app translates them on render.
const SERVER_TEMPLATES = [
  "${nak} nakshatra is traditionally favourable for this", "${nak} nakshatra is neutral for this activity",
  "Amavasya (new moon) is usually avoided for new beginnings", "${tithi} is a Rikta tithi, traditionally avoided for starts",
  "${tithi} tithi supports new beginnings", "${weekday} is a supportive weekday", "Waxing moon (Shukla paksha) favours growth",
  "Purnima · Full moon", "Amavasya · New moon", "Ekadashi · fasting day", "Pradosh", "Sankashti Chaturthi", "Vinayaka Chaturthi",
  "Travel", "Sign a deal or start a business", "Buy property or a vehicle", "Join a new job", "Griha pravesh (housewarming)", "Engagement or marriage talks",
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
  "Low", "Reflective", "Moderate", "Strong", "Excellent", "Steady", "${planet} period",
];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(tsx|ts)$/.test(e.name) && !SKIP.some((re) => re.test(p)) ? [p] : [];
  });
}

function looksLikeCopy(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 2 || !/[A-Za-z]/.test(t)) return false;
  if (/^(https?:|\/|\.\/|@\/|#|rgba?\(|[a-z]+-[a-z0-9-]+$|[a-z_]+$|[A-Za-z]+-[A-Z][A-Za-z]+$)/.test(t)) return false; // urls, paths, ids, font names
  if (/^[a-z0-9_.:-]+$/.test(t) && !t.includes(" ")) return false;
  return true;
}

function templateKey(node, sf) {
  // Rebuild `a ${expr} b` from source so keys match the runtime matcher.
  let out = node.head.text;
  for (const span of node.templateSpans) out += "${" + span.expression.getText(sf) + "}" + span.literal.text;
  return out;
}

const found = new Map();
// Collects copy from an expression, following ternaries and `a || b` fallbacks.
function addExpr(e, sf, rel) {
  if (!e) return;
  if (ts.isParenthesizedExpression(e)) return addExpr(e.expression, sf, rel);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return add(e.text, rel);
  if (ts.isTemplateExpression(e)) return add(templateKey(e, sf), rel);
  if (ts.isConditionalExpression(e)) { addExpr(e.whenTrue, sf, rel); addExpr(e.whenFalse, sf, rel); return; }
  if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) { addExpr(e.left, sf, rel); addExpr(e.right, sf, rel); }
}
function add(text, where) {
  const key = text.replace(/\s+/g, " ").trim();
  if (!looksLikeCopy(key.replace(/\$\{[^}]+\}/g, ""))) return;
  if (!found.has(key)) found.set(key, where);
}

for (const dir of DIRS) {
  for (const file of files(path.join(ROOT, dir))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = path.relative(ROOT, file);
    const visit = (node) => {
      if (ts.isJsxText(node)) add(node.getText(sf).replace(/&apos;/g, "'").replace(/&quot;/g, '"'), rel);
      if (ts.isJsxAttribute(node) && node.initializer) {
        const name = node.name.getText(sf);
        const init = node.initializer;
        const expr = ts.isJsxExpression(init) ? init.expression : init;
        if (TEXT_PROPS.has(name) && expr) addExpr(expr, sf, rel);
      }
      // Strings rendered as JSX children: {"text"} and {`text ${x}`}
      if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
        const e = node.expression;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text, rel);
        if (ts.isTemplateExpression(e)) add(templateKey(e, sf), rel);
        if (ts.isConditionalExpression(e)) {
          for (const branch of [e.whenTrue, e.whenFalse]) {
            if (ts.isStringLiteral(branch) || ts.isNoSubstitutionTemplateLiteral(branch)) add(branch.text, rel);
            if (ts.isTemplateExpression(branch)) add(templateKey(branch, sf), rel);
          }
        }
      }
      // Content tables: { label: "...", title: "..." } and arrays of sentences.
      if (ts.isPropertyAssignment(node) && TEXT_PROPS.has(node.name.getText(sf).replace(/["']/g, ""))) {
        addExpr(node.initializer, sf, rel);
      }
      // Lookup tables: const ZONE_MEANING = { N: "...", ... } and helpers that return copy.
      if (ts.isObjectLiteralExpression(node) && ts.isVariableDeclaration(node.parent) && /^[A-Z_]+$/.test(node.parent.name.getText(sf))) {
        for (const prop of node.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer) && prop.initializer.text.includes(" ")) add(prop.initializer.text, rel);
        }
      }
      if (ts.isReturnStatement(node) && node.expression && ts.isStringLiteral(node.expression) && /^[A-Z]/.test(node.expression.text) && node.expression.text.includes(" ")) add(node.expression.text, rel);
      // [icon, text] pairs used for feature lists.
      if (ts.isArrayLiteralExpression(node) && node.elements.length === 2 && node.elements.every((el) => ts.isStringLiteral(el) || ts.isTemplateExpression(el))
          && ts.isStringLiteral(node.elements[0]) && /^[a-z][a-z0-9-]*$/.test(node.elements[0].text)) addExpr(node.elements[1], sf, rel);
      if (ts.isArrayLiteralExpression(node) && ts.isVariableDeclaration(node.parent) && /^[A-Z_]+$/.test(node.parent.name.getText(sf))) {
        for (const el of node.elements) {
          if (ts.isStringLiteral(el) && el.text.includes(" ")) add(el.text, rel);
          if (ts.isArrayLiteralExpression(el)) for (const inner of el.elements) if (ts.isStringLiteral(inner) && /[A-Z]/.test(inner.text[0])) add(inner.text, rel);
        }
      }
      // Explicit calls: t("...") / translateText(`...`, language) / tr(`...`)
      if (ts.isCallExpression(node) && ["t", "tr", "translateText"].includes(node.expression.getText(sf)) && node.arguments[0]) {
        const a = node.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) add(a.text, rel);
        if (ts.isTemplateExpression(a)) add(templateKey(a, sf), rel);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

for (const t of SERVER_TEMPLATES) if (!found.has(t)) found.set(t, "server");

const catalog = require(path.join(ROOT, "src/i18n/translations.json"));
const known = new Set(Object.keys(catalog.hi || {}).map((k) => k.replace(/\s+/g, " ").trim()));
const missing = [...found.entries()].filter(([k]) => !known.has(k));
if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(missing.map(([k]) => k), null, 2));
} else {
  for (const [k, where] of missing) console.log(`${where}\t${k}`);
  console.error(`\n${found.size} strings found, ${missing.length} missing from the catalog`);
}
