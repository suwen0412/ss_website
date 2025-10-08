# Research Website Template

A clean, single-page research website for GitHub Pages with sections:
**Home • Research • Publications • Teaching • News • Contact**. Smooth scrolling and a simple carousel included.

## Quick start (GitHub Pages)

1. Create a new GitHub repository, e.g., `research-site`.
2. Upload all files from this folder to the repo root (or drag/drop via the web UI).
3. In the repository settings → **Pages**, set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or `master`) and folder `/root`
4. Wait for Pages to build. Your site will be live at `https://<your-username>.github.io/<repo>/`.

## Customize

- Edit `index.html`:
  - Replace "Your Name" and text throughout.
  - Update the hero images (they currently hotlink Unsplash placeholders).
  - Swap the Formspree action URL in the Contact form with your own endpoint.
- Update publications in `data/publications.json` (the page loads them dynamically).
- Tweak colors/spacing in `assets/css/style.css`.
- Add internal project pages or PDFs and link them from the Research cards.

## Local preview

You can open `index.html` directly in your browser. For best results, run a local server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## License

MIT © 2025 Your Name
