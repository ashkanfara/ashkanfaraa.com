import type { Metadata } from 'next'
import { HomeView } from '@/components/sections/HomeView'
export const metadata: Metadata = {
  title: 'اشکان فارا — نگاه روشن‌تر قبل از تصمیم‌های بزرگ',
  description: 'جلسه استراتژی خصوصی و دوره تله‌های پنهان مهاجرت؛ برای تصمیم‌گیری آگاهانه‌تر درباره مهاجرت، مسیر شغلی و زندگی در خارج.',
}
export default function PersianHome() { return <HomeView locale="fa" /> }
