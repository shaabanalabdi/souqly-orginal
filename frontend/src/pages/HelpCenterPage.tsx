import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { StaticPageLayout } from '../components/StaticPageLayout';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function HelpCenterPage() {
  const { pick } = useLocaleSwitch();

  return (
    <StaticPageLayout
      title={pick('مركز المساعدة', 'Help Center')}
      intro={pick(
        'هذا المركز يغطي الأسئلة المتكررة حول إنشاء الإعلانات، التواصل مع البائعين، الصفقات، والإبلاغ عن المخالفات.',
        'This hub covers common questions about posting listings, contacting sellers, deals, and reporting violations.',
      )}
      sections={[
        {
          title: pick('كيف أنشر إعلانًا؟', 'How do I create a listing?'),
          body: (
            <>
              <p>{pick('سجّل الدخول ثم انتقل إلى صفحة إنشاء إعلان، اختر التصنيف، أضف التفاصيل والصور والموقع، ثم احفظ الإعلان.', 'Sign in, open the create listing flow, choose a category, add details, images, and location, then save the listing.')}</p>
              <div>
                <Link to="/listings/create">
                  <Button>{pick('إنشاء إعلان', 'Create Listing')}</Button>
                </Link>
              </div>
            </>
          ),
        },
        {
          title: pick('كيف أتواصل بأمان؟', 'How do I communicate safely?'),
          body: <p>{pick('استخدم المحادثة داخل المنصة، وشارك رقم الهاتف فقط عند الحاجة، وفضّل توثيق الاتفاقات عبر العروض والصفقات.', 'Use in-app chat, share your phone only when needed, and prefer documenting agreements through offers and deals.')}</p>,
        },
        {
          title: pick('متى أبلغ عن إعلان أو مستخدم؟', 'When should I report a listing or user?'),
          body: (
            <>
              <p>{pick('أبلغ عند الاشتباه بالاحتيال أو التكرار أو المحتوى غير المناسب أو أي نشاط يخالف السياسات.', 'Report when you suspect fraud, duplication, inappropriate content, or any activity that violates platform policies.')}</p>
              <div>
                <Link to="/contact">
                  <Button variant="secondary">{pick('التواصل مع الدعم', 'Contact Support')}</Button>
                </Link>
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
