// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl">🧠</div>
            <span className="text-3xl font-bold tracking-tighter">Remember.</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-violet-400 transition-colors">Features</a>
            <a href="#how" className="hover:text-violet-400 transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-violet-400 transition-colors">Pricing</a>
          </div>
          <Link href="/chat" className="bg-white text-black px-6 py-3 rounded-2xl font-semibold hover:bg-violet-500 hover:text-white transition-all">
            Start for Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-2 text-sm mb-8">
          <span className="text-emerald-400">●</span>
          Now in public beta
        </div>

        <h1 className="text-7xl md:text-8xl font-bold tracking-tighter leading-none mb-6">
          Your Personal<br />
          <span className="text-violet-500">Second Brain</span>
        </h1>

        <p className="text-2xl text-zinc-400 max-w-2xl mx-auto mb-12">
          I remember everything you've ever read, written, or thought about.<br />
          Ask me anything — I know your knowledge better than you do.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/chat" className="bg-white text-black px-10 py-6 rounded-3xl text-2xl font-semibold hover:bg-violet-500 hover:text-white transition-all">
            Start Chatting →
          </Link>
          <a href="#features" className="border border-zinc-700 hover:border-violet-400 px-10 py-6 rounded-3xl text-2xl font-semibold transition-all">
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-5xl font-bold text-center mb-16">Everything your brain needs</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="feature-card bg-zinc-950 rounded-3xl p-8 border border-zinc-800">
              <div className="text-5xl mb-6">📚</div>
              <h3 className="text-2xl font-semibold mb-3">Long-term Memory</h3>
              <p className="text-zinc-400">Upload PDFs, notes, articles, books, Notion pages — I remember everything forever.</p>
            </div>
            <div className="feature-card bg-zinc-950 rounded-3xl p-8 border border-zinc-800">
              <div className="text-5xl mb-6">🔍</div>
              <h3 className="text-2xl font-semibold mb-3">Instant Recall</h3>
              <p className="text-zinc-400">Ask anything about your knowledge base. I find the exact information in seconds.</p>
            </div>
            <div className="feature-card bg-zinc-950 rounded-3xl p-8 border border-zinc-800">
              <div className="text-5xl mb-6">🧠</div>
              <h3 className="text-2xl font-semibold mb-3">Intelligent Agent</h3>
              <p className="text-zinc-400">Not just search. I think, connect ideas, summarize, and help you create new knowledge.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-5xl font-bold text-center mb-4">Simple pricing</h2>
          <p className="text-zinc-400 text-center mb-16">Choose what fits you best</p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-700">
              <h3 className="text-2xl font-semibold mb-2">Free</h3>
              <p className="text-5xl font-bold mb-6">$0<span className="text-base font-normal text-zinc-400">/month</span></p>
              <ul className="space-y-4 mb-10 text-zinc-400">
                <li>✓ Up to 50 documents</li>
                <li>✓ Basic memory search</li>
                <li>✓ Gemini Flash</li>
                <li>✓ Chat history</li>
              </ul>
              <Link href="/chat" className="block text-center bg-zinc-800 hover:bg-zinc-700 py-5 rounded-2xl font-medium">
                Start for Free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-violet-600 rounded-3xl p-8 relative border-2 border-violet-400">
              <div className="absolute -top-3 right-8 bg-white text-violet-600 text-xs font-bold px-5 py-1 rounded-3xl">RECOMMENDED</div>
              <h3 className="text-2xl font-semibold mb-2 text-white">Pro</h3>
              <p className="text-5xl font-bold mb-6 text-white">$12<span className="text-base font-normal opacity-70">/month</span></p>
              <ul className="space-y-4 mb-10 text-white/90">
                <li>✓ Unlimited documents &amp; memory</li>
                <li>✓ Advanced RAG</li>
                <li>✓ Faster model (Gemini 2.5 Pro)</li>
                <li>✓ Smart auto-tagging</li>
                <li>✓ Priority support</li>
              </ul>
              <button className="block w-full bg-white text-violet-600 py-5 rounded-2xl font-semibold hover:bg-zinc-100 transition-all">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center py-12 text-zinc-500 text-sm">
        Made for people who want to remember more and think better.
      </div>
    </main>
  );
}