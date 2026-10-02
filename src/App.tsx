import { useEffect, useState } from "react"
import { Header } from "./components/Header"
import { MorphGallery } from "./components/MorphGallery"
import { FRAMES } from "./lib/frames"

const CAPTION =
  "Landscape and aerial work from coastlines, ice and open ground. Eleven prints, hung on one line running away from you."

function readTheme(): "light" | "dark" {
  try {
    return localStorage.getItem("morph-theme") === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme)

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    document.documentElement.setAttribute("data-anim", "on")
    try {
      localStorage.setItem("morph-theme", theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return (
    <div className="h-full font-sans">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
      <main>
        <MorphGallery frames={FRAMES} caption={CAPTION} />
      </main>
    </div>
  )
}
