'use client'

import Image from 'next/image'
import { useState } from 'react'

interface PortraitImageProps {
  objectPosition?: string
}

export function PortraitImage({ objectPosition = '50% 20%' }: PortraitImageProps) {
  const [errored, setErrored] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (errored) return null

  return (
    <Image
      src="/images/portrait.jpg"
      alt="اشکان فارا"
      fill
      priority
      className="object-cover transition-opacity duration-700"
      style={{ opacity: loaded ? 1 : 0, objectPosition }}
      sizes="(max-width: 768px) 100vw, 58vw"
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
    />
  )
}
