// Default rules for the free categorizer, keyed by category slug. Editable per user in Settings.
export const SEED_KEYWORDS: Record<string, string> = {
  "ai-and-llms":
    "ai, a.i., llm, llms, gpt*, chatgpt, openai, gemini, mistral, llama, deepseek, grok, perplexity, \"machine learning\", \"deep learning\", \"neural net*\", transformer*, embedding*, \"fine-tun*\", prompt*, \"prompt engineering\", agent, agents, agentic, \"ai agent*\", rag, inference, \"context window\", multimodal, diffusion, midjourney, \"stable diffusion\", sora, cursor, copilot, huggingface.co, openai.com, @openai, @sama, @karpathy, @huggingface, @googledeepmind",
  "claude-and-anthropic":
    "claude, \"claude code\", anthropic, opus, sonnet, haiku, mcp, \"model context protocol\", anthropic.com, claude.ai, @anthropicai, @claudeai, @alexalbert__, @bcherny",
  "dev-tools":
    "github, \"open source\", open-source, repo, cli, sdk, api, npm, pnpm, vscode, \"vs code\", neovim, vim, terminal, framework, library, react, next.js, nextjs, vue, svelte, typescript, javascript, python, rust, golang, tailwind, vercel, supabase, docker, \"dev tool*\", devtool*, ide, github.com, npmjs.com, @github, @vercel, @rauchg, @supabase",
  "coding-practices":
    "\"clean code\", refactor*, architecture, \"design pattern*\", testing, \"unit test*\", tdd, \"code review\", debugging, \"system design\", \"best practice*\", performance, scalab*, \"technical debt\", \"software engineer*\", programming, \"how to code\", algorithm*, \"data structure*\"",
  "cloud-and-infra":
    "aws, azure, gcp, \"google cloud\", cloudflare, kubernetes, k8s, terraform, serverless, database, postgres, postgresql, mysql, redis, sqlite, neon, devops, \"ci/cd\", infrastructure, hosting, cdn, \"edge function*\", lambda, s3, aws.amazon.com, cloudflare.com, @awscloud, @cloudflare",
  "cybersecurity":
    "security, cybersecurity, infosec, hacker*, hacking, vulnerab*, exploit*, cve, malware, ransomware, phishing, breach*, \"zero day\", 0day, pentest*, \"red team\", \"blue team\", encryption, privacy, \"bug bounty\", soc, siem, osint, \"threat intel*\", krebsonsecurity.com",
  "design-and-ui":
    "design, designer*, ui, ux, \"user interface\", \"user experience\", figma, framer, webflow, typography, font, fonts, typeface, \"color palette\", layout, animation*, \"motion design\", \"design system*\", landing page*, \"web design\", dribbble, mobbin, icons, illustration*, logo, logos, branding, dribbble.com, figma.com, framer.com, behance.net, mobbin.com, @figma, @framer",
  "interiors-and-spaces":
    "interior*, \"home office\", desk setup, \"desk setup\", workspace, apartment, furniture, decor, architecture, architect*, \"living room\", bedroom, kitchen, renovation, minimalist home, cozy, @archdigest",
  "startups-and-business":
    "startup*, founder*, \"y combinator\", yc, \"product market fit\", pmf, fundraising, \"raised \", seed round, \"series a\", vc, venture, investor*, saas, mrr, arr, revenue, bootstrapp*, \"indie hacker*\", \"solo founder\", \"side project\", business, ceo, entrepreneur*, acquisition, b2b, @paulg, @ycombinator, @levelsio",
  "marketing-and-growth":
    "marketing, growth, seo, \"content marketing\", copywriting, audience, followers, newsletter, \"cold email*\", outreach, sales, funnel, conversion*, \"go to market\", gtm, branding, \"personal brand\", viral, distribution, ads, \"paid ads\", tiktok, \"build in public\"",
  "money-and-investing":
    "invest*, stock*, \"stock market\", etf, \"index fund*\", portfolio, dividend*, crypto, bitcoin, btc, ethereum, trading, trader*, \"personal finance\", budget*, savings, retire*, 401k, \"net worth\", wealth, real estate, mortgage, tax*, inflation, \"interest rate*\", economy, economics",
  "productivity":
    "productivity, productive, habit*, routine*, \"deep work\", notion, obsidian, \"second brain\", \"note taking\", todo, \"to-do\", workflow*, automation, \"time management\", calendar, raycast, shortcut*, \"getting things done\", gtd, procrastinat*",
  "health-and-fitness":
    "health, healthy, fitness, gym, workout*, exercise, running, lifting, protein, diet, nutrition, fasting, sleep, longevity, \"mental health\", meditation, anxiety, supplement*, creatine, cardio, weight loss, @hubermanlab, @bryan_johnson",
  "islam-and-learning":
    "islam, islamic, muslim*, quran, qur'an, hadith, sunnah, allah, prophet, ramadan, salah, prayer, dua, deen, imam, masjid, mosque, jummah, \"alhamdulillah\", \"subhanallah\", \"inshallah\", tafsir, seerah",
  "travel":
    "travel*, trip, vacation, holiday, flight*, airport, airline*, hotel*, airbnb, visa, passport, \"digital nomad\", nomad, destination*, itinerary, backpack*, tourism, tourist, abroad, relocat*, \"move to\", city guide",
  "tech-hardware":
    "iphone, ipad, macbook, \"mac mini\", \"mac studio\", apple, android, pixel, samsung, gadget*, chip*, gpu*, cpu*, nvidia, amd, intel, \"vision pro\", headphones, airpods, keyboard*, monitor*, laptop*, \"desk setup\", raspberry pi, hardware, @mkbhd",
  "deals-and-freebies":
    "free, \"for free\", freebie*, giveaway, discount*, deal, deals, \"% off\", \"percent off\", coupon*, \"promo code\", \"limited time\", \"free trial\", credits, \"free credits\", \"black friday\", \"cyber monday\", students, \"student discount\", \"for students\", perks, \"claim it\", \"claim yours\", \"free year\", \"$0\", \"no cost\", lifetime deal, appsumo.com",
  "humor":
    "lol, lmao, lmfao, rofl, meme*, funny, joke*, hilarious, \"i'm dead\", \"im dead\", bruh, \"this is so\", satire, shitpost*",
  "other": "",
};
