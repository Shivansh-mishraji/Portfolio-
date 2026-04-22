# Fullstack Portfolio Website

This is a production-style fullstack portfolio app built with a custom animated frontend and a Node.js backend.
It combines two GitHub accounts and LinkedIn profile data into one professional showcase.

## What It Includes

- Animated, responsive UI with layered graphics and scroll reveal effects
- API-driven showcase sections loaded from backend JSON and GitHub APIs
- Dual-account GitHub aggregation:
	- Shivansh-mishraji
	- Shivanshmishra7275
- Curated capability, architecture, services, experience, and project storytelling
- Contact form submission API with local persistence in `data/messages.json`
- Backend cache for GitHub calls to keep API responses fast

## Run Locally

1. Open a terminal in this folder.
2. Start the server:

```bash
npm start
```

3. Open the app at:

```text
http://localhost:3000
```

For auto-restart in development mode:

```bash
npm run dev
```

Optional: to raise GitHub API rate limits, set an environment variable before running:

```powershell
$env:GITHUB_TOKEN="your_github_token"
```

## Project Structure

```text
Resume-Webpage/
  app.js
  data/
    messages.json
    portfolio.json
  index.html
  package.json
  server.js
  styles.css
```

## API Routes

- `GET /api/health` - health check
- `GET /api/showcase` - complete frontend payload with profile, projects, architecture, and GitHub insights
- `GET /api/github` - dual-account GitHub aggregation only
- `GET /api/portfolio` - full portfolio payload
- `GET /api/projects` - showcase projects list
- `POST /api/contact` - store a message

Example `POST /api/contact` body:

```json
{
	"name": "Your Name",
	"email": "you@example.com",
	"message": "Hello, I would like to collaborate."
}
```

## Customize Content

Edit `data/portfolio.json` to update profile, capabilities, featured projects, architecture pillars, services, education, and interests.

## Notes

- LinkedIn content itself is linked directly through profile URL in portfolio data.
- GitHub repositories are fetched live from public APIs and merged in backend responses.
- If GitHub is temporarily unavailable, the website still loads curated local content.

## Previous Static Deploy

The earlier static version was deployed at:
https://resume-webpage-ashy.vercel.app/