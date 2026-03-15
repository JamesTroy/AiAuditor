# Claudit

AI-powered code audit platform. Paste your code and get instant, detailed analysis across 50+ audit categories including security, performance, accessibility, SEO, architecture, and more — powered by Claude.

## Features

- **50+ Built-in Audit Agents** — Security, performance, accessibility, SEO, DevOps, architecture, and more
- **Custom Agents** — Create your own audit agent with a custom system prompt
- **Site Audit** — Enter a URL to run multiple agents against your live site
- **Streaming Results** — Real-time markdown output as the audit runs
- **Dashboard** — Track audit history, scores, and trends
- **Authentication** — Email/password, OAuth (GitHub, Google), 2FA (TOTP)
- **Dark Mode** — Full light/dark theme support

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **AI**: Anthropic Claude API
- **Auth**: Better Auth with Drizzle adapter
- **Database**: PostgreSQL (Supabase) via Drizzle ORM
- **Styling**: Tailwind CSS 3
- **Animation**: Motion (Framer Motion)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 20.x
- PostgreSQL database (Supabase recommended)
- Anthropic API key

### Setup

```bash
# Clone the repository
git clone https://github.com/claudit/claudit.git
cd claudit

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See [.env.example](.env.example) for all available configuration options. Required:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random 32+ char secret |
| `BETTER_AUTH_URL` | App URL (e.g. `http://localhost:3000`) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Rate Limiting

- **Per IP**: 10 audits/min (30/min for site audit batches)
- **Per User**: 50 audits/day
- **Global**: 500 audits/day total

## License

[MIT](LICENSE)
