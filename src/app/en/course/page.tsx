import type { Metadata } from 'next'
import { Footer }            from '@/components/layout/Footer'
import { CoursePageShellEn } from '@/components/sections/CoursePageShellEn'
import { footer }            from '@/data/content.en'

export const metadata: Metadata = {
  title: 'The Hidden Traps of Migration — Ashkan Faraa',
  description:
    "What no one tells you honestly before you go. A structured course covering the emotional, financial, cultural and practical realities of moving countries. $99 USD.",
}

export default function EnCoursePage() {
  return (
    <main className="w-full overflow-x-hidden">
      <CoursePageShellEn />
      <Footer content={footer} />
    </main>
  )
}
