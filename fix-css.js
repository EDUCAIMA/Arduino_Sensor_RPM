const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'public', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Use \r\n line endings (Windows)
const btnSectionStart = css.indexOf('/* ============================================================\r\n   BUTTONS');
const formsStart = css.indexOf('/* ============================================================\r\n   FORMS');

console.log('btnSectionStart:', btnSectionStart);
console.log('formsStart:', formsStart);

if (btnSectionStart === -1 || formsStart === -1) {
  console.error('Markers not found');
  process.exit(1);
}

const buttonSection = `/* ============================================================\r\n   BUTTONS\r\n   ============================================================ */\r\n.btn {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  padding: 10px 20px;\r\n  border: 1px solid transparent;\r\n  border-radius: var(--radius-sm);\r\n  font-family: var(--font-sans);\r\n  font-size: 14px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  transition: all var(--transition-fast);\r\n  text-decoration: none;\r\n  white-space: nowrap;\r\n}\r\n\r\n.btn svg { width: 16px; height: 16px; }\r\n\r\n.btn-primary {\r\n  background: var(--corhuila-green);\r\n  color: white;\r\n  box-shadow: 0 4px 12px rgba(0,132,61,0.25);\r\n}\r\n.btn-primary:hover {\r\n  background: var(--accent-dark);\r\n  box-shadow: 0 6px 16px rgba(0,132,61,0.35);\r\n  transform: translateY(-1px);\r\n}\r\n\r\n.btn-danger {\r\n  background: var(--red);\r\n  color: white;\r\n  box-shadow: 0 4px 12px rgba(239,68,68,0.25);\r\n}\r\n.btn-danger:hover { background: #dc2626; transform: translateY(-1px); }\r\n\r\n.btn-warning {\r\n  background: linear-gradient(135deg, var(--orange), #d97706);\r\n  color: white;\r\n}\r\n.btn-warning:hover { opacity: 0.9; transform: translateY(-1px); }\r\n\r\n.btn-pdf {\r\n  background: linear-gradient(135deg, #c0392b, #e74c3c);\r\n  color: white;\r\n  box-shadow: 0 4px 12px rgba(192, 57, 43, 0.30);\r\n}\r\n.btn-pdf:hover {\r\n  background: linear-gradient(135deg, #a93226, #c0392b);\r\n  box-shadow: 0 6px 18px rgba(192, 57, 43, 0.40);\r\n  transform: translateY(-2px);\r\n}\r\n\r\n.btn-success {\r\n  background: var(--green);\r\n  color: white;\r\n  box-shadow: 0 4px 12px rgba(16,185,129,0.25);\r\n}\r\n.btn-success:hover { background: #059669; transform: translateY(-1px); }\r\n\r\n.btn-ghost {\r\n  background: transparent;\r\n  color: var(--text-secondary);\r\n  border: 1px solid var(--border-light);\r\n}\r\n.btn-ghost:hover {\r\n  background: var(--bg-elevated);\r\n  color: var(--text-primary);\r\n}\r\n\r\n.btn-sm { padding: 6px 12px; font-size: 12px; }\r\n\r\n.btn-icon {\r\n  padding: 6px;\r\n  border-radius: var(--radius-sm);\r\n  background: transparent;\r\n  border: none;\r\n  color: var(--text-secondary);\r\n  cursor: pointer;\r\n  transition: all var(--transition-fast);\r\n}\r\n\r\n.btn-icon:hover {\r\n  background: var(--bg-elevated);\r\n  color: var(--text-primary);\r\n}\r\n\r\n`;

const newCss = css.slice(0, btnSectionStart) + buttonSection + css.slice(formsStart);
fs.writeFileSync(cssPath, newCss, 'utf8');
console.log('Done! New CSS length:', newCss.length);
