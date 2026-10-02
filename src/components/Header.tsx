import { Moon, Sun } from "lucide-react"

type HeaderProps = {
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function Header({ onToggleTheme }: HeaderProps) {
  return (
    <header className="mo-header" data-scrolled="false">
      <a className="mo-logo" aria-label="Morph, home" href="/">
        MORPH
      </a>
      <div className="mo-nav">
        <nav className="mo-nav" aria-label="Primary">
          <a className="mo-navlink" data-active="true" aria-current="page" href="/">
            Home
          </a>
          <a className="mo-navlink" data-active="false" href="#about">
            About
          </a>
          <a className="mo-navlink" data-active="false" href="#contact">
            Contact
          </a>
        </nav>
        <button
          type="button"
          className="th-toggle"
          aria-label="Toggle light and dark theme"
          onClick={onToggleTheme}
        >
          <Moon className="th-moon" aria-hidden size={14} strokeWidth={2} />
          <Sun className="th-sun" aria-hidden size={14} strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
