import type { Metadata } from 'next'
import { HomeView } from '@/components/sections/HomeView'
export const metadata: Metadata = {
  title: 'Ashkan Faraa — Perspective Before Big Decisions',
  description: 'Private strategy sessions and The Hidden Traps of Migration. A clearer perspective before decisions about relocation, career, business and life abroad.',
}
export default function Home() { return <HomeView locale="en" /> }
