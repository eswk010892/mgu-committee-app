import React from 'react'
import crest from '../assets/mgu-crest.webp'

/**
 * The committee's own crest. Imported through Vite rather than referenced by a
 * literal path, so the URL is rewritten for whatever `base` the build uses and
 * nothing hard-codes an absolute asset path.
 *
 * The source is already cropped to the circle with a transparent surround, so it
 * sits correctly on the dark board and on the light sponsor page alike.
 */
export default function Crest({ size = 72, className = '', alt = 'Montreal Ganesh Utsav' }) {
  return (
    <img className={['mgu-crest', className].filter(Boolean).join(' ')}
      src={crest} width={size} height={size} alt={alt}
      decoding="async" draggable="false" />
  )
}
