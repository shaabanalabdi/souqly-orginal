import { StaticPageLayout } from '../components/StaticPageLayout';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function AboutPage() {
  const { pick } = useLocaleSwitch();

  return (
    <StaticPageLayout
      title={pick('من نحن', 'About Souqly')}
      intro={pick(
        'سوقلي منصة إعلانات مبوبة وسوق مجتمعي موجهة لأسواق الشرق الأوسط، مع تركيز على الثقة، التحقق، والدردشة المباشرة بين البائع والمشتري.',
        'Souqly is a classifieds marketplace built for Middle Eastern markets with a strong focus on trust, verification, and direct buyer-seller communication.',
      )}
      sections={[
        {
          title: pick('رؤيتنا', 'Our Vision'),
          body: (
            <p>
              {pick(
                'نبني سوقًا رقميًا يسهّل بيع المنتجات والخدمات محليًا مع تقليل الاحتيال ورفع جودة التجربة للمستخدمين الأفراد والمتاجر والحرفيين.',
                'We are building a local digital market that makes it easier to sell products and services while reducing fraud and improving the experience for individuals, stores, and craftsmen.',
              )}
            </p>
          ),
        },
        {
          title: pick('ما الذي يميز سوقلي', 'What Makes Souqly Different'),
          body: (
            <>
              <p>{pick('نظام ثقة، تحقق هوية، محادثات مباشرة، عروض أسعار، وصفقات محمية.', 'Trust score, identity verification, direct chat, price offers, and protected deals.')}</p>
              <p>{pick('المنصة مصممة RTL أولًا وتدعم العربية كلغة أساسية مع واجهة إنجليزية بديلة.', 'The platform is designed RTL-first with Arabic as the primary language and English as a fallback interface.')}</p>
            </>
          ),
        },
        {
          title: pick('الأسواق المستهدفة', 'Target Markets'),
          body: <p>{pick('سوريا، الأردن، لبنان، فلسطين، والعراق مع مرونة للتوسع لاحقًا.', 'Syria, Jordan, Lebanon, Palestine, and Iraq, with room for future expansion.')}</p>,
        },
      ]}
    />
  );
}
