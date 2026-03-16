import { useTranslation } from 'react-i18next';

export function TermsPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.resolvedLanguage?.startsWith('ar') ?? i18n.language === 'ar';

  return (
    <section className="card stack">
      <h1 className="page-title">{isArabic ? 'شروط الاستخدام' : 'Terms of Use'}</h1>
      <p className="page-subtitle">
        {isArabic
          ? 'سوقلي منصة وسيطة للإعلانات المبوبة ولا تتدخل كطرف في الدفع أو التسليم بين المستخدمين.'
          : 'Souqly is a classifieds intermediary and is not a direct party to payments or deliveries.'}
      </p>

      <h2>{isArabic ? '1) طبيعة الخدمة' : '1) Service Scope'}</h2>
      <p>
        {isArabic
          ? 'المنصة توفّر نشر الإعلانات والتواصل بين البائعين والمشترين فقط. أي اتفاق يتم بين الأطراف على مسؤوليتهم.'
          : 'The platform enables ad publishing and buyer-seller communication only. Any deal is between users.'}
      </p>

      <h2>{isArabic ? '2) المحتوى الممنوع' : '2) Prohibited Content'}</h2>
      <p>
        {isArabic
          ? 'يُمنع نشر أسلحة، مخدرات، أدوية بوصفة، منتجات مقلدة، محتوى إباحي، أو أي محتوى مخالف للقانون.'
          : 'Posting weapons, drugs, prescription medicines, counterfeit items, explicit content, or illegal items is forbidden.'}
      </p>

      <h2>{isArabic ? '3) البلاغات والإشراف' : '3) Reporting and Moderation'}</h2>
      <p>
        {isArabic
          ? 'لإدارة المنصة حق تعليق/حذف الإعلانات أو تقييد الحسابات عند وجود مخالفات أو نشاط احتيالي.'
          : 'Platform moderators may suspend/delete listings and restrict accounts for policy violations or fraud signals.'}
      </p>

      <h2>{isArabic ? '4) المسؤولية' : '4) Liability'}</h2>
      <p>
        {isArabic
          ? 'سوقلي لا يضمن دقة جميع الإعلانات ولا يتحمل مسؤولية الخسائر الناتجة عن التعامل المباشر بين المستخدمين.'
          : 'Souqly does not guarantee complete listing accuracy and is not liable for losses from direct user transactions.'}
      </p>

      <h2>{isArabic ? '5) التعديلات' : '5) Changes'}</h2>
      <p>
        {isArabic
          ? 'قد يتم تحديث هذه الشروط دوريًا. استمرارك باستخدام المنصة يعني موافقتك على النسخة الأحدث.'
          : 'These terms may be updated periodically. Continuing to use the platform means acceptance of the latest version.'}
      </p>
    </section>
  );
}
