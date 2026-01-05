# CompetitorPulse

A full-stack competitive intelligence platform that automatically monitors competitors' public-facing marketing activities and surfaces actionable intelligence for Product Marketing teams.

## Features

### Competitor Management
- Add competitors by entering company name and primary URL
- Organize competitors with custom descriptions and logos
- Track multiple URLs per competitor (landing pages, pricing, blog, careers, etc.)
- Configurable monitoring frequency (hourly, daily, weekly)

### Monitoring Capabilities
- **Landing Page Monitoring**: Scheduled snapshots of specified URLs
- **Screenshot Capture**: Visual screenshots using Puppeteer
- **Content Extraction**: Full HTML/text content extraction
- **Intelligent Diff Detection**: Text content changes, meta tag changes
- **AI-Powered Classification**: Automatic categorization of changes:
  - Messaging shift
  - New feature announcement
  - Pricing change
  - Social proof update
  - Partnership announcement
  - Hiring signal
  - Minor/cosmetic change

### Intelligence Processing
Every detected change is analyzed using Claude AI to generate:
- Change type classification
- One-sentence summary
- Strategic analysis (2-3 sentences)
- Confidence score
- Affected areas

### Alerts & Notifications
- Email digest (daily or weekly)
- Slack integration (webhook-based)
- In-app notification center
- Configurable alert thresholds

### Dashboard & Reporting
- Timeline view: Chronological feed of all competitor activity
- Competitor-specific views: Deep dive on single competitor
- Change detail view: Before/after comparisons with AI analysis
- Full-text search across all captured content

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: Supabase Auth
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Scraping**: Puppeteer for screenshots, Cheerio for HTML parsing
- **Email**: Resend
- **Notifications**: Slack webhooks

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project (for authentication)
- Anthropic API key
- Resend API key (optional, for email notifications)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/competitorpulse.git
cd competitorpulse
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example and fill in your values:
```bash
cp .env.example .env
```

4. Set up your environment variables in `.env`:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/competitorpulse"
DIRECT_URL="postgresql://user:password@localhost:5432/competitorpulse"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI - Anthropic Claude API
ANTHROPIC_API_KEY="sk-ant-..."

# Email - Resend (optional)
RESEND_API_KEY="re_..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

5. Generate Prisma client and run migrations:
```bash
npx prisma generate
npx prisma db push
```

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

The application uses PostgreSQL with Prisma ORM. The schema includes:

- **Workspaces**: Multi-tenant organization support
- **Competitors**: Companies being monitored
- **MonitoredUrls**: URLs being tracked for each competitor
- **Snapshots**: Point-in-time captures of monitored URLs
- **Changes**: Detected changes between snapshots with AI analysis
- **Announcements**: RSS feed items, app store updates, etc.
- **AlertPreferences**: User notification settings

## Project Structure

```
src/
├── app/
│   ├── (auth)/                 # Authentication pages
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/            # Main app pages (protected)
│   │   ├── dashboard/
│   │   ├── competitors/
│   │   ├── timeline/
│   │   ├── changes/
│   │   └── settings/
│   └── api/                    # API routes
│       ├── competitors/
│       ├── changes/
│       ├── timeline/
│       ├── snapshots/
│       ├── settings/
│       └── jobs/
├── components/
│   ├── ui/                     # Reusable UI components
│   └── layout/                 # Layout components
├── lib/
│   ├── ai/                     # Claude AI integration
│   ├── email/                  # Email notifications
│   ├── scraping/               # Puppeteer & RSS utilities
│   ├── supabase/               # Supabase client
│   ├── prisma.ts               # Prisma client
│   ├── types.ts                # TypeScript types & Zod schemas
│   └── utils.ts                # Utility functions
└── middleware.ts               # Auth middleware
```

## API Routes

### Competitors
- `GET /api/competitors` - List all competitors
- `POST /api/competitors` - Add a new competitor
- `GET /api/competitors/:id` - Get competitor details
- `PUT /api/competitors/:id` - Update competitor
- `DELETE /api/competitors/:id` - Archive competitor

### Monitored URLs
- `GET /api/competitors/:id/urls` - List monitored URLs
- `POST /api/competitors/:id/urls` - Add monitored URL
- `PUT /api/urls/:id` - Update monitored URL
- `DELETE /api/urls/:id` - Remove monitored URL

### Changes & Timeline
- `GET /api/changes` - List all changes (paginated, filterable)
- `GET /api/changes/:id` - Get change details
- `PUT /api/changes/:id` - Mark as read
- `GET /api/timeline` - Unified timeline of changes + announcements

### Snapshots
- `POST /api/snapshots/trigger/:urlId` - Manually trigger snapshot

### Settings
- `GET /api/settings/alerts` - Get alert preferences
- `POST /api/settings/alerts` - Update alert preferences
- `POST /api/integrations/slack` - Test Slack webhook

## Background Jobs

The application includes a job processing endpoint at `/api/jobs` that handles:

- **capture_snapshots**: Captures snapshots of monitored URLs based on their check frequency
- **fetch_rss**: Fetches and processes RSS feeds for new announcements
- **check_app_stores**: Monitors iOS App Store for app updates

To run jobs, set up a cron service to call the jobs endpoint:

```bash
# Example: Run snapshot jobs every hour
curl -X POST https://your-app.com/api/jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobType": "capture_snapshots"}'
```

## Deployment

### Vercel (Frontend + API)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

### Background Workers

For background job processing, you can:

1. Use Vercel Cron Jobs (limited)
2. Deploy to Railway/Render with a cron service
3. Use a job queue service like Inngest or Trigger.dev

## Change Types

The AI classifies changes into the following types:

| Type | Color | Description |
|------|-------|-------------|
| `messaging_shift` | Green | Changes to value proposition, taglines, or messaging |
| `feature_launch` | Blue | New feature announcements or capability updates |
| `pricing_change` | Yellow | Changes to pricing, plans, or packaging |
| `social_proof` | Purple | New logos, testimonials, or case studies |
| `positioning` | Green | Changes to market positioning or differentiation |
| `partnership` | Purple | New integrations or partnership announcements |
| `hiring_signal` | Blue | Career page updates indicating growth areas |
| `minor` | Gray | Cosmetic changes, typo fixes (filtered by default) |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please open a GitHub issue.
