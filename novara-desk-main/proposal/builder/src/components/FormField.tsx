import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  children: ReactNode
}

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 mb-4 last:mb-0">
      <label htmlFor={htmlFor} className="text-[12px] font-general-sans font-medium text-novara-light/70">
        {label}
      </label>
      {children}
    </div>
  )
}

export const inputClass =
  'w-full bg-white/5 border border-novara-border rounded-lg px-3 py-2.5 text-sm text-white font-general-sans placeholder:text-novara-light/30 focus:outline-none focus:border-novara-teal/50 transition-colors'
