import type { Metadata } from 'next'
import { Footer }            from '@/components/layout/Footer'
import { CoursePageShellEn } from '@/components/sections/CoursePageShellEn'
import { footer }            from '@/data/content.en'

export const metadata: Metadata = {
  title: 'Migration: The Full Picture — Ashkan Faraa',
  description: "What no one tells you honestly before you go. A course built from years of personal migration experience.",
}

export default function EnCoursePage() {
  return (
    <main className="w-full overflow-x-hidden">
      <CoursePageShellEn />
      <Footer content={footer} />
    </main>
  )
}
