import { useTranslation } from 'react-i18next';

export function PrivacyPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.resolvedLanguage?.startsWith('ar') ?? i18n.language === 'ar';

  return (
    <section className="card stack">
      <h1 className="page-title">{isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
      <p className="page-subtitle">
        {isArabic
          ? 'توضح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها داخل منصة سوقلي.'
          : 'This policy explains how your data is collected, used, and protected on Souqly.'}
      </p>

      <h2>{isArabic ? '1) البيانات التي نجمعها' : '1) Data We Collect'}</h2>
      <p>
        {isArabic
          ? 'قد نجمع بيانات الحساب (البريد/الهاتف)، بيانات الإعلانات، الرسائل داخل المنصة، وبيانات تقنية مثل عنوان IP.'
          : 'We may collect account data (email/phone), listing data, in-platform messages, and technical data like IP.'}
      </p>

      <h2>{isArabic ? '2) كيفية الاستخدام' : '2) How We Use Data'}</h2>
      <p>
        {isArabic
          ? 'تُستخدم البيانات لتشغيل المنصة، تحسين البحث، مكافحة الاحتيال، وإرسال التنبيهات والإشعارات.'
          : 'Data is used to operate the platform, improve search, prevent fraud, and deliver alerts/notifications.'}
      </p>

      <h2>{isArabic ? '3) مشاركة البيانات' : '3) Data Sharing'}</h2>
      <p>
        {isArabic
          ? 'لا نبيع بياناتك. قد نشارك بيانات محدودة مع مزودي خدمات تقنيين أو عند وجود التزام قانوني.'
          : 'We do not sell your data. Limited data may be shared with technical providers or legal authorities when required.'}
      </p>

      <h2>{isArabic ? '4) حقوق المستخدم' : '4) User Rights'}</h2>
      <p>
        {isArabic
          ? 'يمكنك طلب الوصول إلى بياناتك أو تصديرها أو حذفها وفق السياسات المعمول بها.'
          : 'You can request access, export, or deletion of your data according to applicable policies.'}
      </p>

      <h2>{isArabic ? '5) الأمان والإبلاغ عن الخروقات' : '5) Security and Breach Reporting'}</h2>
      <p>
        {isArabic
          ? 'نطبق ضوابط أمنية تقنية وإجرائية، ومع أي خرق أمني يتم الإبلاغ خلال 72 ساعة وفق المتطلبات.'
          : 'We apply technical and procedural safeguards and report security breaches within 72 hours when required.'}
      </p>
    </section>
  );
}
