# Pirata

A free, all-in-one toolkit for students: PDFs, images, writing and media tools that run entirely in the browser. Files never leave the user's device.

**Features:** a command palette (`Ctrl/⌘ K`), `/` to search, paste images with `Ctrl/⌘ V`, drag-to-reorder file lists, before/after comparison sliders, recently used tools, toast notifications, and light and dark themes. Fonts are self-hosted, so the app makes no third-party requests.

## Tools

| Category | Tools |
|---|---|
| Study | GWA Calculator, Citation Generator (APA/MLA/Chicago), Pomodoro Timer, Flashcards, Class Schedule Maker |
| PDF | Merge, Split, Compress, Images to PDF, Organize (rotate/delete/reorder), Page Numbers & Watermark, PDF to Images, Sign PDF |
| Image | Background Remover, Compressor, Resizer, Converter, ID Photo Maker (2×2 / passport + print sheet), Scan Cleaner, Collage Maker |
| Writing & Code | QR Code, Color Palette, JSON Formatter, Base64, Word Counter, Read Aloud, Compare Drafts, Text Cleaner |
| Media | Video to GIF, Audio Trimmer, Screen Recorder, Voice Recorder, Video Compressor |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Project structure

```
src/
  tools/registry.js     # every tool: id, name, category, icon, lazy component
  tools/image|pdf|text|media/   # one component per tool
  components/           # layout, home grid, tool page, shared UI (dropzone, file list…)
  lib/files.js          # download, zip, canvas helpers
  lib/pdf.js            # pdf.js + pdf-lib helpers
```

### Adding a tool

1. Create a component in `src/tools/<category>/MyTool.jsx`.
2. Add an entry to `tools` in `src/tools/registry.js`.

It then shows up on the home page, in search, and at `/tools/<id>` automatically.

## Libraries

- `@imgly/background-removal`: the on-device background removal model. It downloads model files from IMG.LY's CDN on the first run.
- `pdf-lib` builds PDFs, and `pdfjs-dist` renders them
- `gifenc` for GIF encoding, `qrcode` for QR codes, and `jszip` for bulk downloads
- `lucide-react` for icons
- `@fontsource` for self-hosted fonts: Inter Tight, Inter, Instrument Serif and JetBrains Mono

## Deploying

This is a static site. `vercel.json` (Vercel) and `public/_redirects` (Netlify/Cloudflare Pages) route every path to `index.html` so deep links work.
