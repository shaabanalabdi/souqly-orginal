const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/SubscriptionsPage.tsx', 'utf8');
content = content.replace(/const BILLING_CYCLES[\s\S]*?\];\n/, '');
content = content.replace("export function SubscriptionsPage() {\n  const { t } = useTranslation('subscriptions');", "export function SubscriptionsPage() {\n  const { t } = useTranslation('subscriptions');\n  const BILLING_CYCLES = [\n    { months: 1 as const, label: 'Monthly' },\n    { months: 3 as const, label: 'Quarterly (−5%)' },\n    { months: 12 as const, label: 'Yearly (−15%)' },\n  ];");
fs.writeFileSync('frontend/src/pages/SubscriptionsPage.tsx', content);
console.log("Fixed SubscriptionsPage");
