// English content — same visual system, translated tone not literal text

export const site = {
  name: 'ASHKAN FARAA',
  tagline: 'MIGRATION · LIFE · STRATEGY',
}

export const nav = {
  links: [
    { label: 'Course',  href: '/en/course' },
    { label: 'Consult', href: '/en/consultation' },
  ],
}

export const hero = {
  headlineLines: [
    'Before the big decisions,',
    'see the picture',
    'most people miss.',
  ],
  subtext: "I've lived across multiple countries. I work with people who want the real picture — not the curated version.",
}

export const credentials = [
  'Personal migration experience',
  'Lived in multiple countries',
  'Years working with Iranians abroad',
  "The decisions that don't show up in checklists",
]

export const offers = [
  {
    id: 'course',
    title: 'Migration: The Full Picture',
    description: 'Everything you should know before you decide — honest, direct, no filter.',
    price: '$99 USD',
    priceSub: null,
    action: 'Request Access',
    href: '/en/course',
  },
  {
    id: 'consultation',
    title: 'Private Strategy Session',
    description: 'One session to make a better decision before you act. No empty promises.',
    price: '',
    priceSub: null,
    action: 'Request a Session',
    href: '/en/consultation',
  },
] as const

export const offersMeta = {
  disclaimer:
    'This course and session are based on personal experience and are not a substitute for legal, financial, or professional advice.',
}

export const testimonials = {
  sectionLabel: 'Real Experiences',
  headline: 'Real results, in their own voice',
  subtext: 'From people who found a clearer picture before committing.',
  items: [
    {
      id: 'testimonial-1',
      name: 'Shadi M.',
      label: 'Migration Decision',
      quote: 'I thought I already had the answers.',
      src: '/audio/testimonial-1.mp3',
    },
    {
      id: 'testimonial-2',
      name: 'Asal J.',
      label: 'Strategy Session',
      quote: 'It was the first time someone asked the right questions.',
      src: '/audio/testimonial-2.mp3',
    },
    {
      id: 'testimonial-3',
      name: 'Babak K.',
      label: 'Migration Path Review',
      quote: "In one hour, I saw things I'd been ignoring for two years.",
      src: '/audio/testimonial-3.mp3',
    },
  ],
}

export const footer = {
  brand: {
    tagline: 'Strategy · Awareness · Decision',
    description: 'Informed guidance for high-stakes decisions.',
  },
  legal: '© 2025 Ashkan Faraa',
  partnerships: {
    label: 'Partnerships',
    text: 'For sponsorship and business collaboration.',
    email: 'hello@ashkanfaraa.com',
  },
}

export const courseContent = {
  eyebrow: 'Course',
  title: 'Migration:\nThe Full Picture',
  subtitle: 'What no one tells you honestly before you go.',
  price: '$99 USD',
  priceNote: 'Early access price for the first cohort.',
  ctaLabel: 'Request Access',
  coreStatement: [
    "Most migration mistakes don't happen before you move.",
    'They happen after.',
  ],
  credibilityLine:
    'This course comes from years of living, studying, working, and talking with migrants across multiple countries.',
  framingLine: 'What no one tells you before you leave.',
  modules: [
    { title: 'Why I Built This Course' },
    { title: 'The Path I Took' },
    { title: 'The Real Reason People Migrate' },
    { title: 'Migration Is Not What You Think' },
    { title: 'Emotional Traps' },
    { title: 'Financial Traps' },
    { title: 'Career and Education Traps' },
    { title: 'Friendships and Relationships Abroad' },
    { title: 'The Distance Iranians Keep from Each Other' },
    { title: 'Local vs. Iranian Partners' },
    { title: 'Cultural and Legal Differences at Destination' },
    { title: 'Before You Leave' },
  ],
  highlightedModules: new Set([2, 4, 5, 7]),
}

export const consultationContent = {
  eyebrow: 'Private Strategy Session',
  titleLines: ['Before the big decisions,', 'see the full picture.'],
  body: [
    "If you're facing an important decision, this session is designed to help you see it more clearly. From migration and education to business, investment, property in Australia, or choosing your next path.",
    "The goal isn't a ready-made answer. It's to help you make a more informed decision before you commit time, money, and energy.",
  ],
  ctaLabel: 'Request a Session',
  price: 'Sessions start from AUD 250.',
  formHeading: 'Before you apply, tell me a little about your situation.',
  formSubtext:
    "Not all requests are accepted. If your situation is a fit, we'll reach out to coordinate next steps.",
  disclaimer:
    'This session is based on personal experience, observation, research, and extensive conversation. It is not a substitute for legal, financial, or professional advice.',
}
