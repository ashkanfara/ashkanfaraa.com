// English content — separate positioning from Persian site.
// Primary objective: sell private strategy consultations.
// Course is an authority asset and intellectual property.

export const site = {
  name: 'ASHKAN FARAA',
  tagline: 'STRATEGY · PERSPECTIVE · CLARITY',
}

export const nav = {
  links: [
    { label: 'Session', href: '/en/consultation' },
    { label: 'Course',  href: '/en/course' },
  ],
}

export const hero = {
  headlineLines: [
    'Before the big decisions,',
    'see the full picture.',
  ],
  subtext:
    "The decisions that matter most are usually made with the least amount of real perspective. I work with people who want to see clearly before they commit.",
}

// ── Credibility section ────────────────────────────────────────
export const credibilitySection = {
  eyebrow: 'The Perspective',
  points: [
    'Most costly decisions don\'t fail because of bad luck. They fail because of incomplete perspective.',
    'Years of living across countries, and watching how people navigate major commitments, reveals patterns most people only see in hindsight.',
    'The questions you don\'t know to ask are consistently the most expensive ones.',
    'The right conversation, before the wrong commitment, changes outcomes.',
  ],
}

// ── Offers — consultation FIRST ───────────────────────────────
export const offers = [
  {
    id: 'consultation',
    title: 'Private Strategy Session',
    description:
      'A focused one-on-one conversation for people facing a high-stakes decision — relocation, business, education, career, property, or any major life commitment. One hour. Clear thinking before you act.',
    price: 'AUD 499',
    priceSub: '60 minutes',
    action: 'Request a Session',
    href: '/en/consultation',
    ctaVariant: 'primary' as const,
  },
  {
    id: 'course',
    title: 'The Hidden Traps of Migration',
    description:
      'A structured course covering the emotional, financial, cultural and practical realities of moving countries. For people who want to understand what the process actually looks like before they commit.',
    price: '$99 USD',
    priceSub: null,
    action: 'Get the Course',
    href: '/en/course',
    ctaVariant: 'ghost' as const,
  },
] as const

export const offersMeta = {
  disclaimer:
    'This course and session are based on personal experience and are not a substitute for legal, financial, or professional advice.',
}

// ── Testimonials ───────────────────────────────────────────────
export const testimonials = {
  sectionLabel: 'Real Experiences',
  subtext: 'From people who made clearer decisions before committing.',
  items: [
    {
      id: 'testimonial-1',
      name: 'Shadi M.',
      label: 'Life Decision',
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
      label: 'Strategy Session',
      quote: "In one hour I saw things I'd ignored for two years.",
      src: '/audio/testimonial-3.mp3',
    },
  ],
}

// ── Footer ─────────────────────────────────────────────────────
export const footer = {
  brand: {
    tagline: 'Strategy · Perspective · Decision',
    description: 'Clarity before commitment.',
  },
  legal: '© 2025 Ashkan Faraa',
  partnerships: {
    label: 'Partnerships',
    text: 'For brand collaboration and sponsorship.',
    email: 'info@ashkanfaraa.com',
  },
}

// ── Course page ────────────────────────────────────────────────
export const courseContent = {
  eyebrow: 'The Course',
  title: 'The Hidden Traps of Migration',
  subtitle: 'What no one tells you honestly before you go.',
  price: '$99 USD',
  priceNote: 'Immediate access after payment.',
  ctaLabel: 'Get the Course',
  coreStatement: [
    "Most migration mistakes don't happen before you move.",
    'They happen after.',
  ],
  // Outcomes — shown BEFORE curriculum
  outcomes: [
    'Why most migration mistakes happen after arrival',
    'The emotional realities nobody discusses',
    'Financial traps that destroy long-term plans',
    'Career expectations versus reality',
    'Relationships, loneliness, and social reinvention abroad',
    'Cultural adaptation and what it actually costs',
    'What successful migrants do differently',
  ],
  credibilityLine:
    'This course comes from years of living, studying, working, and talking with migrants across multiple countries.',
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

// ── Consultation page ──────────────────────────────────────────
export const consultationContent = {
  eyebrow: 'Private Strategy Session',
  titleLines: ['Before the big decisions,', 'see the full picture.'],
  body: [
    "This session is for people facing a significant decision — one where the wrong call costs real time, money, or years. Relocation, education, career change, business, investment, or any high-stakes commitment.",
    "The goal is clarity. Not a ready-made answer — a sharper understanding of what you are actually deciding, what the consequences look like, and what most people miss before they commit.",
  ],
  ctaLabel: 'Apply for a Session',
  price: 'AUD 499',
  duration: '60 Minutes',
  formHeading: 'Tell me about the decision you are facing.',
  formSubtext:
    'Not every application leads to a session. The goal is to ensure the conversation is worth the hour for both sides.',
  disclaimer:
    'This session is based on personal experience, observation, and years of conversation. It is not a substitute for legal, financial, or professional advice.',
}
