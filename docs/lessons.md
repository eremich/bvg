# Lessons

- Vite dev: CSS imported from JS is injected after the module runs → flash of unstyled HTML on reload. For pages with a preloader/critical first paint, link the stylesheet in `<head>` (render-blocking), never only via `import "./style.css"`.
- Keep proposals lean. User rejected "auto day/night by Berlin time + toggle" as overkill — offer the simplest version that matches the request; extras only as an optional one-liner.
- Don't replace a working, approved section with a reference-inspired redesign without showing a mock first. User shared a photo of the new U-Bahn display as inspiration; I rebuilt the Ausbildung route around it and it was rejected → reverted. Next time: propose where the reference fits + small preview, and keep the original intact until approved.
