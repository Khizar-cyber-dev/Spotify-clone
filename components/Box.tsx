import React, { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const Box = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <div className={twMerge(`bg-neutral-900 rounded-lg h-fit w-full`, className)}>
        {children}
    </div>
  )
}

export default Box