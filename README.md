# סנהדרין דיגיטלית — The Digital Sanhedrin

> _71 of the greatest Jewish legal scholars in history deliberate your halachic question._

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Y2JCPA/digital-sanhedrin-public)

---

## What Is This?

The Digital Sanhedrin is an AI-powered educational tool that simulates the ancient Sanhedrin — the supreme Jewish court of 71 sages. You submit a *she'elah* (halachic/Jewish legal question), and each of the 71 digitally-simulated sages deliberates in their own distinct voice, cites their own sefarim, and votes on a ruling.

Each sage has a unique persona:
- **The Rambam** — terse, systematic, first-principles
- **R. Akiva Eiger** — opens with a devastating *kushya*, then resolves it
- **The Rema** — always brings the lived communal practice
- **R. Ovadia Yosef** — encyclopedic, cites 10+ sources
- **Rashi** — crystal clear, says in 5 words what others say in 500
- …and 66 more

After all 71 sages vote, two *soferim* (scribes) summarize the majority and minority opinions, the *Av Beit Din* synthesizes, and the *Nasi* (Rambam) delivers the final ruling.

> ⚠️ **Disclaimer:** This is an educational and entertainment tool only. The Digital Sanhedrin is an AI simulation and does **not** constitute actual halachic guidance. For real halachic questions, please consult a qualified rabbi or *posek*.

---

## Free to Use — No Key Needed

By default, the Digital Sanhedrin runs on **Google Gemini 2.0 Flash** — completely free. Just deploy with your own `GOOGLE_AI_API_KEY` and share it with anyone.

### Optional: Claude Sonnet (Bring Your Own Key)

Users who want higher-quality deliberations can toggle on **Claude Sonnet** in the Advanced Settings panel and enter their own Anthropic API key. The key is stored in their browser's `localStorage` only — it is never sent to or stored on the server.

---

## Deploying on Vercel

### 1. Clone or fork this repo

```bash
git clone https://github.com/Y2JCPA/digital-sanhedrin-public.git
cd digital-sanhedrin-public
npm install
```

### 2. Set up environment variables

Copy the example file:
```bash
cp .env.local.example .env.local
```

Add your Google AI API key (free at [aistudio.google.com](https://aistudio.google.com)):
```
GOOGLE_AI_API_KEY=your-google-ai-key-here
```

### 3. Deploy to Vercel

```bash
npx vercel --prod
```

Or connect your GitHub repo to [vercel.com](https://vercel.com) and add `GOOGLE_AI_API_KEY` in the project's Environment Variables settings.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

- **Next.js 15** (App Router, Edge Runtime)
- **TypeScript**
- **Tailwind CSS**
- **Google Gemini 2.0 Flash** (default, free)
- **Anthropic Claude Sonnet** (optional, BYOK)
- **Sefaria API** for source verification

---

## Private Edition

This is the **public edition** of the Digital Sanhedrin. A private version with additional features (authentication, enhanced UI, extended functionality) is maintained separately.

---

## License

MIT — feel free to fork, deploy, and extend.
