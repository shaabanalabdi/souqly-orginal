const fs = require('fs');
const path = require('path');

const TRANSLATION_FILE = path.join(__dirname, 'frontend/public/locales/en/translation.json');
let translations = {};
try {
  translations = JSON.parse(fs.readFileSync(TRANSLATION_FILE, 'utf8'));
} catch (e) {
  console.error('Could not read translation file', e);
  process.exit(1);
}

// Function to escape regex characters in a string
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceInFile(fileName, ns) {
  const filePath = path.join(__dirname, 'frontend/src/pages', fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  const map = translations[ns] || {};

  for (const [key, val] of Object.entries(map)) {
    if (typeof val !== 'string' || !val) continue;

    const escapedVal = escapeRegExp(val);
    
    // Pattern 1: HTML Element Text >Value<
    const htmlRegex = new RegExp(`>\\s*${escapedVal}\\s*<`, 'g');
    if (htmlRegex.test(content)) {
      content = content.replace(htmlRegex, `>{t('${key}')}<`);
      changed = true;
    }

    // Pattern 2: Attributes like placeholder="Value" or label="Value"
    const attrRegex1 = new RegExp(`placeholder="${escapedVal}"`, 'g');
    if (attrRegex1.test(content)) {
      content = content.replace(attrRegex1, `placeholder={t('${key}')}`);
      changed = true;
    }
    
    const attrRegex2 = new RegExp(`label="${escapedVal}"`, 'g');
    if (attrRegex2.test(content)) {
      content = content.replace(attrRegex2, `label={t('${key}')}`);
      changed = true;
    }

    const attrRegex3 = new RegExp(`title="${escapedVal}"`, 'g');
    if (attrRegex3.test(content)) {
      content = content.replace(attrRegex3, `title={t('${key}')}`);
      changed = true;
    }

    // Pattern 3: Simple string assignment 'Value' or "Value" (Be careful with interpolating variables)
    // We only replace if not already wrapped in t()
    // It's safer to only do explicitly known JSX texts when possible to avoid replacing internal TS logic strings
    // But since the translation JSON contains very UI-specific strings, we can replace them if they are in quotes.
    const strRegexSingle = new RegExp(`'${escapedVal}'`, 'g');
    // Ensure we don't accidentally replace a hook arg or require string if it clashes
    // We can do a simple global replace for now since these are long UI sentences.
    if (strRegexSingle.test(content)) {
        // Skip if inside a hook call like `useTranslation('chats')`
        if (escapedVal !== ns) {
            content = content.replace(strRegexSingle, `t('${key}')`);
            changed = true;
        }
    }
    
    const strRegexDouble = new RegExp(`"${escapedVal}"`, 'g');
    if (strRegexDouble.test(content)) {
        if (escapedVal !== ns) {
            content = content.replace(strRegexDouble, `t('${key}')`);
            changed = true;
        }
    }
  }

  // Also replace some common ones directly for AdminPage and others that are tricky
  if (fileName === 'SubscriptionsPage.tsx') {
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Replaced translations in ${fileName}`);
  } else {
    console.log(`No translations replaced in ${fileName}`);
  }
}

replaceInFile('AdminPage.tsx', 'admin');
replaceInFile('ChatPage.tsx', 'chats');
replaceInFile('CraftsmanProfilePage.tsx', 'craftsmanProfile');
replaceInFile('PreferencesPage.tsx', 'preferences');
replaceInFile('SubscriptionsPage.tsx', 'subscriptions');
