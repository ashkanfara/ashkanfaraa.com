export const site = {
  name: 'ASHKAN FARAA',
  tagline: 'MIGRATION · LIFE · STRATEGY',
}

export const nav = {
  links: [
    { label: 'دوره',    href: '/course' },
    { label: 'مشاوره', href: '/consultation' },
  ],
}

export const hero = {
  headlineLines: [
    'قبل از تصمیم‌های بزرگ،',
    'تصمیمی بگیر که پنج سال بعد',
    'از آن پشیمان نشوی.',
  ],
  subtext: 'در چند کشور زندگی کرده‌ام. با کسانی کار می‌کنم که واقعیت را می‌خواهند.',
}

export const offers = [
  {
    id: 'course',
    title: 'تله‌های پنهان مهاجرت',
    description: 'همه آنچه باید پیش از تصمیم‌گیری بدانی — و کسی صادقانه بهت نگفته.',
    price: '۹.۹ میلیون تومان',
    priceSub: null,
    action: 'درخواست دسترسی',
    href: '/course',
  },
  {
    id: 'consultation',
    title: 'جلسه استراتژی خصوصی',
    description: 'یک جلسه برای تصمیم‌گیری بهتر قبل از اقدام مهم. بدون وعده‌های توخالی.',
    price: '',
    priceSub: null,
    action: 'درخواست جلسه',
    href: '/consultation',
  },
] as const

export const offersMeta = {
  disclaimer: 'این دوره و جلسه بر پایه تجربه شخصی است و جایگزین مشاوره حقوقی، مالی یا تخصصی نیست.',
}

export const testimonials = {
  sectionLabel: 'تجربه‌های واقعی',
  headline: 'نتیجه واقعی، با صدای خودشان',
  subtext: 'از زبان کسانی که قبل از تصمیم، تصویر کامل‌تری پیدا کردند.',
  items: [
    {
      id: 'testimonial-1',
      name: 'شادی م.',
      label: 'تصمیم مهاجرت',
      quote: 'قبل از این جلسه فکر می‌کردم جواب‌ها را دارم.',
      src: '/audio/testimonial-1.mp3',
    },
    {
      id: 'testimonial-2',
      name: 'عسل ج.',
      label: 'جلسه استراتژی',
      quote: 'اولین باری بود که کسی سوال‌های درست را می‌پرسید.',
      src: '/audio/testimonial-2.mp3',
    },
    {
      id: 'testimonial-3',
      name: 'بابک ک.',
      label: 'بررسی مسیر مهاجرت',
      quote: 'بعد از یک ساعت، چیزهایی دیدم که دو سال نادیده گرفته بودم.',
      src: '/audio/testimonial-3.mp3',
    },
  ],
}

export const footer = {
  brand: {
    tagline: 'استراتژی · آگاهی · تصمیم',
    description: 'راهنمای آگاهانه برای تصمیم‌های بزرگ.',
  },
  legal: '© ۱۴۰۴ اشکان فارا',
  partnerships: {
    label: 'همکاری برند',
    text: 'برای اسپانسرشیپ و همکاری تجاری در تماس باشید.',
    email: 'info@ashkanfaraa.com',
  },
}
