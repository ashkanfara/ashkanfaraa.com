import Image from 'next/image'
import { Offers } from './OfferCards'
import { Testimonials } from './Testimonials'
import { Footer } from '@/components/layout/Footer'
import * as enContent from '@/data/content.en'
import * as faContent from '@/data/content'

export function HomeView({ locale }: { locale: 'en' | 'fa' }) {
  const en = locale === 'en'
  const c = en ? enContent : faContent
  return <main id="main-content" className="home-page" lang={locale} dir={en ? 'ltr' : 'rtl'}>
    <div className="home-shell">
      <section className="hero-frame" id="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span />{en ? 'Perspective before commitment' : 'نگاه روشن‌تر، قبل از تصمیم'}</p>
          <h1 id="hero-title">{c.hero.headlineLines.map((line, i) => <span key={line} className={i === c.hero.headlineLines.length - 1 ? 'hero-accent' : ''}>{line}</span>)}</h1>
          <p className="hero-intro">{c.hero.subtext}</p>
          <div className="hero-actions"><a className="button-primary" href={en ? '/en/consultation' : '/consultation'}>{en ? 'Explore a private session' : 'آشنایی با جلسه خصوصی'}<span aria-hidden>{en ? '↗' : '↖'}</span></a><a className="button-text" href={en ? '/en/course' : '/course'}>{en ? 'Discover the course' : 'دیدن دوره مهاجرت'}<span aria-hidden>→</span></a></div>
          <p className="hero-note">{en ? 'Relocation · Career · Business · Life abroad' : 'مهاجرت · مسیر شغلی · کسب‌وکار · زندگی در خارج'}</p>
        </div>
        <div className="hero-portrait"><Image src="/images/portrait.jpg" alt={en ? 'Ashkan Faraa' : 'اشکان فارا'} fill priority sizes="(max-width: 700px) 100vw, (max-width: 1200px) 45vw, 520px" style={{ objectFit: 'cover', objectPosition: '50% 17%' }} /><div className="portrait-shade" aria-hidden /><div className="portrait-caption"><span>{en ? 'Ashkan Faraa' : 'اشکان فارا'}</span><small>{en ? 'Experience. Perspective. Conversation.' : 'تجربه. نگاه. گفت‌وگو.'}</small></div></div>
      </section>
      <div className="intro-strip"><span>{en ? 'Lived experience across countries' : 'تجربه زندگی در چند کشور'}</span><span>{en ? 'Independent perspective' : 'نگاه مستقل'}</span><span>{en ? 'A conversation before commitment' : 'گفت‌وگو، قبل از تعهد'}</span></div>
      <section className="approach-section" id="approach" aria-labelledby="approach-title">
        <div><p className="eyebrow">{en ? 'The approach' : 'نگاه من'}</p><h2 id="approach-title">{en ? <>Some decisions deserve<br /><em>a wider view.</em></> : <>بعضی تصمیم‌ها،<br /><em>نگاه بازتری می‌خواهند.</em></>}</h2></div>
        <div className="approach-copy"><p>{en ? 'Living across countries changes how you see a decision. The practical details matter. So do the emotional, financial and personal realities that rarely fit on a checklist.' : 'زندگی در چند کشور، نگاه آدم را به تصمیم‌گیری عوض می‌کند. جزئیات عملی مهم‌اند؛ واقعیت‌های عاطفی، مالی و شخصی هم مهم‌اند؛ همان چیزهایی که معمولاً در چک‌لیست‌ها جا نمی‌شوند.'}</p><p>{en ? 'My work starts with a conversation: what you are deciding, what you may be overlooking, and what matters before you commit.' : 'کار من با یک گفت‌وگو شروع می‌شود: درباره تصمیمی که پیش رو داری، چیزهایی که شاید از نگاهت دور مانده، و آنچه قبل از هر تعهدی مهم است.'}</p></div>
      </section>
      <section className="ways-section" aria-labelledby="ways-title"><div className="section-heading"><div><p className="eyebrow">{en ? 'Two ways to begin' : 'دو راه برای شروع'}</p><h2 id="ways-title">{en ? 'Choose the right starting point.' : 'از جای مناسب خودت شروع کن.'}</h2></div><p>{en ? 'A focused conversation, or a course to explore at your own pace.' : 'یک گفت‌وگوی متمرکز، یا دوره‌ای برای یادگیری با ریتم خودت.'}</p></div><Offers offers={c.offers} meta={c.offersMeta} /></section>
      <div className="voices-section"><Testimonials content={c.testimonials} locale={locale} /></div>
      <section className="closing-section"><p className="eyebrow">{en ? 'Before your next chapter' : 'قبل از فصل بعدی زندگی'}</p><h2>{en ? 'Make space for a better question.' : 'برای یک سؤال بهتر، جا باز کن.'}</h2><a className="button-primary" href={en ? '/en/consultation' : '/consultation'}>{en ? 'Explore a private session' : 'آشنایی با جلسه خصوصی'} <span aria-hidden>↗</span></a></section>
    </div>
    <Footer content={c.footer} />
  </main>
}
