export const site = {
  name: 'ASHKAN FARAA',
  tagline: 'MIGRATION · LIFE · STRATEGY',
}

export const nav = {
  links: [
    { label: 'خدمات', href: '#offers', highlight: false },
    { label: 'رزرو مشاوره', href: '/consultation', highlight: true },
  ],
}

export const hero = {
  headlineLines: [
    'قبل از مهاجرت،',
    'تصمیمی بگیر که پنج سال بعد',
    'از آن پشیمان نشوی.',
  ],
  subtext: 'در چند کشور زندگی کرده‌ام. با کسانی کار می‌کنم که واقعیت را می‌خواهند.',
  cta: 'مشاهده خدمات',
  ctaHref: '#offers',
}

export const offers = [
  {
    id: 'course',
    title: 'تله‌های پنهان مهاجرت',
    description: 'همه آنچه باید پیش از تصمیم‌گیری بدانی — و کسی صادقانه بهت نگفته.',
    price: '۵.۹ میلیون تومان',
    priceSub: null,
    action: 'خرید دوره',
    href: 'https://example.com/course-payment',
  },
  {
    id: 'consultation',
    title: 'مشاوره خصوصی',
    description: 'یک جلسه اختصاصی برای بررسی مسیر خاص تو. بدون وعده‌های توخالی.',
    price: '۶.۹ میلیون تومان',
    priceSub: '۴۰ دقیقه',
    action: 'رزرو مشاوره',
    href: '/consultation',
  },
] as const

export const offersMeta = {
  disclaimer: 'این دوره و مشاوره، مشاوره حقوقی نیست و هیچ نتیجه ویزایی را تضمین نمی‌کند.',
}

export const testimonials = {
  sectionLabel: 'تجربه‌های واقعی',
  headline: 'نتیجه واقعی، با صدای خودشان',
  subtext: 'از زبان کسانی که مسیرشان را با اطلاعات درست انتخاب کردند.',
  items: [
    {
      id: 'testimonial-1',
      name: 'یاشار ک.',
      label: 'مهاجرت به آلمان · ۱۴۰۲',
      src: '/audio/testimonial-1.mp3',
    },
    {
      id: 'testimonial-2',
      name: 'عسل ح.',
      label: 'اقامت دائم کانادا · ۱۴۰۳',
      src: '/audio/testimonial-2.mp3',
    },
    {
      id: 'testimonial-3',
      name: 'شادی م.',
      label: 'پذیرش تحصیلی اتریش · ۱۴۰۳',
      src: '/audio/testimonial-3.mp3',
    },
  ],
}

export const footer = {
  brand: {
    tagline: 'مهاجرت · آگاهی · تصمیم',
    description: 'راهنمای آگاهانه برای تصمیم‌های بزرگ.',
  },
  legal: '© ۱۴۰۴ اشکان فارا',
  partnerships: {
    label: 'همکاری برند',
    text: 'برای اسپانسرشیپ و همکاری تجاری در تماس باشید.',
    email: 'hello@ashkanfaraa.com',
  },
}
