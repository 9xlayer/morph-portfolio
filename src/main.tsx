import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./morph.css"
import App from "./App"

try {
  const t = localStorage.getItem("morph-theme")
  document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light")
  document.documentElement.setAttribute("data-anim", "on")
} catch {
  document.documentElement.setAttribute("data-theme", "light")
  document.documentElement.setAttribute("data-anim", "on")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
