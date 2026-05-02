// app/chat/page.tsx
'use client';

import { useState } from "react";
import { Send } from "lucide-react";

export default function ChatPage() {
    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
        { role: "assistant", content: "Hi! I'm Remember Brain. What would you like to talk about today?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: "user" as const, content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input }),
            });

            const data = await res.json();
            setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {/* Header */}
            <div className="border-b border-zinc-800 p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-600 rounded-2xl flex items-center justify-center text-xl">🧠</div>
                <div>
                    <h1 className="font-semibold">Remember Brain</h1>
                    <p className="text-xs text-zinc-500">Your personal second brain</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-3xl px-6 py-4 ${msg.role === "user"
                                ? "bg-violet-600 text-white"
                                : "bg-zinc-900 text-zinc-100"
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800">
                <div className="max-w-3xl mx-auto flex gap-3">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Ask me anything about your knowledge..."
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-3xl px-6 py-4 focus:outline-none focus:border-violet-500"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isLoading}
                        className="bg-violet-600 hover:bg-violet-500 px-8 rounded-3xl transition-all active:scale-95"
                    >
                        {isLoading ? "..." : <Send size={24} />}
                    </button>
                </div>
            </div>
        </div>
    );
}