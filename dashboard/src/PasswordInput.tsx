import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function PasswordInput({ className = '', ...props }: Props) {
  const [shown, setShown] = useState(false)
  // La marge doit s'appliquer au conteneur, sinon l'œil se décale par rapport au champ.
  const hasMt = /(^|\s)mt-1(\s|$)/.test(className)
  const inputClass = className.replace(/(^|\s)mt-1(?=\s|$)/g, '')
  return (
    <div className={`relative ${hasMt ? 'mt-1' : ''}`}>
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        className={`${inputClass} w-full pr-11`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-primary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {shown ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-3 3.8M6.5 7.5C4.4 8.9 3 11 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </>
          ) : (
            <>
              <path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  )
}