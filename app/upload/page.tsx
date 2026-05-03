'use client';

import { useState } from "react";

export default function UploadPage() {
  const [status, setStatus] = useState("Готов к загрузке");

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">Remember Brain</h1>
        <p className="text-violet-400 text-xl mb-8">Загрузи документы — я их запомню</p>

        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-12 text-center">
          <p className="text-2xl mb-6">📤 Перетащи файлы сюда или нажми кнопку</p>
          <button className="bg-violet-600 hover:bg-violet-500 px-10 py-4 rounded-2xl text-lg font-medium">
            Выбрать файлы
          </button>
          <p className="text-zinc-500 mt-8 text-sm">{status}</p>
        </div>

        <p className="text-center text-zinc-500 mt-12 text-sm">
          Пока что RAG отключён — но страница работает
        </p>
      </div>
    </div>
  );
}
