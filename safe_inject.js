const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'frontend/src/pages');

function fixMissingDependency(fileName) {
  const filePath = path.join(BASE_DIR, fileName);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  // Just replacing some common missing dependencies safely
  content = content.replace(/\]\); \/\/ eslint-disable-next-line/g, ", t]); // eslint-disable-next-line");
  // specific targeted fixes for ChatPage and ListingDetailsPage if needed
  content = content.replace(/}, \[\]\);/g, "}, [t]);");
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed missing dependencies in ${fileName}`);
}

// Inject t hook safely right after export function [Name]() {
function injectUseTranslation(fileName, namespace) {
  const filePath = path.join(BASE_DIR, fileName);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add import if missing
  if (!content.includes("import { useTranslation }")) {
    const importMatch = content.match(/import .*?;/);
    if (importMatch) {
      content = content.replace(importMatch[0], `import { useTranslation } from 'react-i18next';\n${importMatch[0]}`);
    } else {
      content = `import { useTranslation } from 'react-i18next';\n${content}`;
    }
  }

  // Inject hook
  const componentName = fileName.replace('.tsx', '');
  const signature = `export function ${componentName}() {`;
  if (content.includes(signature) && !content.includes(`useTranslation('${namespace}')`)) {
    content = content.replace(signature, `${signature}\n  const { t } = useTranslation('${namespace}');`);
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Injected useTranslation in ${fileName}`);
}

// Specific fixes
injectUseTranslation('AdminPage.tsx', 'admin');
injectUseTranslation('CraftsmanProfilePage.tsx', 'craftsmanProfile');
injectUseTranslation('PreferencesPage.tsx', 'preferences');
injectUseTranslation('SubscriptionsPage.tsx', 'subscriptions');

fixMissingDependency('ChatPage.tsx');
fixMissingDependency('ListingDetailsPage.tsx');
