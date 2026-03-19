import { StaticPageLayout } from '../components/StaticPageLayout';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function ProhibitedContentPage() {
  const { pick } = useLocaleSwitch();

  return (
    <StaticPageLayout
      title={pick('المحتوى المحظور', 'Prohibited Content')}
      intro={pick(
        'تمنع سوقلي نشر أو ترويج محتوى أو منتجات أو خدمات مخالفة للقانون أو لسياسات المنصة. قد يؤدي ذلك إلى حذف الإعلان أو تقييد الحساب.',
        'Souqly prohibits content, products, or services that violate the law or platform policy. Violations can lead to listing removal or account restrictions.',
      )}
      sections={[
        {
          title: pick('سلع وخدمات محظورة', 'Prohibited Goods and Services'),
          body: (
            <>
              <p>{pick('الأسلحة، المخدرات، الأدوية الممنوعة، الوثائق المزورة، والمنتجات المقلدة.', 'Weapons, drugs, restricted medicines, forged documents, and counterfeit goods.')}</p>
              <p>{pick('أي خدمة أو منتج يتطلب ترخيصًا قانونيًا غير متوفر أو لا يلتزم بالقوانين المحلية.', 'Any service or product that requires legal licensing but does not comply with local regulations.')}</p>
            </>
          ),
        },
        {
          title: pick('محتوى محظور', 'Prohibited Content'),
          body: <p>{pick('المحتوى الإباحي، خطاب الكراهية، الاحتيال، الانتحال، والبيانات المضللة.', 'Explicit content, hate speech, fraud, impersonation, and misleading claims.')}</p>,
        },
        {
          title: pick('العواقب', 'Enforcement'),
          body: <p>{pick('يجوز للإدارة حذف الإعلان فورًا، تعليق الحساب، أو الإحالة للمراجعة اليدوية.', 'The platform may remove a listing immediately, suspend the account, or escalate it to manual review.')}</p>,
        },
      ]}
    />
  );
}
