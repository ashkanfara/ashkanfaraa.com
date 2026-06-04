import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { CoursePageShell } from '@/components/sections/CoursePageShell'

export const metadata: Metadata = {
  title: 'تله‌های پنهان مهاجرت — اشکان فارا',
  description: 'قبل از مهاجرت، تصویر کامل‌تری از مسیر پیش رو داشته باش.',
}

export default function CoursePage() {
  return (
    <main className="w-full overflow-x-hidden">
      <CoursePageShell />
      <Footer />
    </main>
  )
}
