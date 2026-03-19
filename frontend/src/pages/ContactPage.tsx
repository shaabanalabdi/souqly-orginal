import { useState } from 'react';
import { Button, Input } from '../components/ui';
import { StaticPageLayout } from '../components/StaticPageLayout';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function ContactPage() {
  const { pick } = useLocaleSwitch();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <StaticPageLayout
      title={pick('اتصل بنا', 'Contact')}
      intro={pick(
        'للدعم العام، الشكاوى، أو الاستفسارات التجارية يمكنك استخدام النموذج التالي أو التواصل عبر البريد المباشر.',
        'Use the form below for general support, complaints, or business inquiries, or reach out through the direct support email.',
      )}
      sections={[
        {
          title: pick('قنوات التواصل', 'Contact Channels'),
          body: (
            <>
              <p>support@souqly.com</p>
              <p>{pick('أوقات الاستجابة المعتادة: خلال يوم عمل واحد.', 'Typical response time: within one business day.')}</p>
            </>
          ),
        },
        {
          title: pick('أرسل رسالة', 'Send a Message'),
          body: (
            <div className="grid gap-3">
              <Input label={pick('الاسم', 'Name')} value={name} onChange={(event) => setName(event.target.value)} />
              <Input label={pick('البريد الإلكتروني', 'Email')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-ink">{pick('الرسالة', 'Message')}</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary"
                />
              </label>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => {
                    if (name.trim() && email.trim() && message.trim()) {
                      setSubmitted(true);
                    }
                  }}
                >
                  {pick('إرسال', 'Send')}
                </Button>
                {submitted ? <span className="text-sm text-emerald-600">{pick('تم تسجيل رسالتك محليًا بانتظار ربط قناة دعم مباشرة.', 'Your message was recorded locally pending a direct support channel integration.')}</span> : null}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
