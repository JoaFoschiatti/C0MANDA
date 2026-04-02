import { useEffect, useState } from 'react'

function readIsMobile(breakpoint) {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth < breakpoint
}

export default function useMobileViewport(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => readIsMobile(breakpoint))

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(readIsMobile(breakpoint))
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [breakpoint])

  return isMobile
}
