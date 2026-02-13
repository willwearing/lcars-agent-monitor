import { useState, useEffect, useRef } from 'react'

interface TypewriterTextProps {
  text: string
  speed?: number
  style?: React.CSSProperties
}

export function TypewriterText({ text, speed = 30, style }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('')
  const prevTextRef = useRef(text)

  useEffect(() => {
    // Only animate when text changes
    if (text === prevTextRef.current && displayed === text) return
    prevTextRef.current = text

    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return <span style={style}>{displayed}<span style={{ opacity: 0.5 }}>_</span></span>
}
