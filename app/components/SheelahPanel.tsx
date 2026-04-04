"use client";

import { useState, useRef, useEffect } from "react";
import { dayanim } from "../data/sanhedrin";

export type SageResult = {
  seatNumber: number;
  position: "majority" | "minority" | "pending";
  ruling: string;
  statement: string;
  source: string;
  sefariaLink?: string;
  isUpdate?: boolean;
};

export type SourceCheckResult = {
  seatNumber: number;
  status: 'verified' | 'unverified' | 'invalid';
  reason: string;
};

export type DeliberationEvent =
  | { type: "topic"; topic: string; topicHebrew: string }
  | ({ type: "sage" } & SageResult)
  | { type: "sourceCheck"; seatNumber: number; status: 'verified' | 'unverified' | 'invalid'; reason: string }
  | { type: "sofer"; side: "majority" | "minority"; summary: string }
  | { type: "avBeitDin"; statement: string; position: string }
  | { type: "nasi"; statement: string; position: string }
  | {
      type: "final";
      ruling: string;
      majorityCount: number;
      minorityCount: number;
      majorityPosition: string;
      minorityPosition: string;
    }
  | { type: "error"; message: string };

type Props = {
  onSageUpdate?: (sage: SageResult) => void;
  onActiveSage?: (seatNumber: number | null) => void;
  onDeliberationStart?: () => void;
  onDeliberationEnd?: () => void;
};

const LS_API_KEY = "sanhedrin-anthropic-key";

function getSageInfo(seatNumber: number) {
  const sage = dayanim.find((d) => d.seat === seatNumber);
  return sage
    ? { hebrewName: sage.hebrewName, englishName: sage.englishName }
    : { hebrewName: `Seat ${seatNumber}`, englishName: `Seat ${seatNumber}` };
}

export default function SheelahPanel({
  onSageUpdate,
  onActiveSage,
  onDeliberationStart,
  onDeliberationEnd,
}: Props) {
  const [question, setQuestion] = useState("");
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [topic, setTopic] = useState<{
    topic: string;
    topicHebrew: string;
  } | null>(null);
  const [sageLog, setSageLog] = useState<SageResult[]>([]);
  const [soferSummaries, setSoferSummaries] = useState<{
    majority?: string;
    minority?: string;
  }>({});
  const [avBeitDin, setAvBeitDin] = useState<{
    statement: string;
    position: string;
  } | null>(null);
  const [nasiRuling, setNasiRuling] = useState<{
    statement: string;
    position: string;
  } | null>(null);
  const [finalResult, setFinalResult] = useState<{
    ruling: string;
    majorityCount: number;
    minorityCount: number;
    majorityPosition: string;
    minorityPosition: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSage, setActiveSageLocal] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sourceStatuses, setSourceStatuses] = useState<Record<number, SourceCheckResult>>({});
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarification, setClarification] = useState<{
    clarifiedQuestion: string;
    topic: string;
    topicHebrew: string;
    assumptions: string | null;
  } | null>(null);

  // Model settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useClaudeSonnet, setUseClaudeSonnet] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");

  // Load saved API key from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_API_KEY);
      if (saved) {
        setAnthropicKey(saved);
        setUseClaudeSonnet(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Persist API key to localStorage when it changes
  function handleAnthropicKeyChange(val: string) {
    setAnthropicKey(val);
    try {
      if (val) {
        localStorage.setItem(LS_API_KEY, val);
      } else {
        localStorage.removeItem(LS_API_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  }

  function handleToggleClaude(checked: boolean) {
    setUseClaudeSonnet(checked);
    if (!checked) {
      // Clear key from memory when toggled off (but keep in LS so they don't have to re-enter)
    }
  }

  // The effective API key to pass in requests
  const effectiveApiKey = useClaudeSonnet && anthropicKey ? anthropicKey : undefined;

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [sageLog, soferSummaries, avBeitDin, nasiRuling, finalResult]);

  function buildExportText(): string {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const majorityNames = sageLog
      .filter((s) => s.position === "majority")
      .map((s) => {
        const info = getSageInfo(s.seatNumber);
        return `  ${info.hebrewName} (${info.englishName})`;
      })
      .join("\n");

    const minorityNames = sageLog
      .filter((s) => s.position === "minority")
      .map((s) => {
        const info = getSageInfo(s.seatNumber);
        return `  ${info.hebrewName} (${info.englishName})`;
      })
      .join("\n");

    const sageDetails = sageLog
      .map((s) => {
        const info = getSageInfo(s.seatNumber);
        return `[Seat ${s.seatNumber}] ${info.hebrewName} (${info.englishName})
Rules: ${s.ruling}
${s.statement}
Source: ${s.source}
---`;
      })
      .join("\n\n");

    return `⚠️ DISCLAIMER: This is an educational and entertainment tool only. The Digital Sanhedrin is an AI simulation and does not constitute actual halachic (Jewish legal) guidance. For real halachic questions, please consult a qualified rabbi or posek.

═══════════════════════════════════════════
   PSAK OF THE DIGITAL SANHEDRIN
   She'elah: ${question}
   Topic: ${topic?.topic || "N/A"}
   Date: ${date}
═══════════════════════════════════════════

📜 FINAL RULING
${finalResult?.majorityPosition || "N/A"} — Vote: ${finalResult?.majorityCount || 0}-${finalResult?.minorityCount || 0}

📋 MAJORITY SUMMARY
${soferSummaries.majority || "N/A"}

⚖️ MINORITY OPINION
${soferSummaries.minority || "N/A"}

🏛️ AV BEIT DIN — מרן (R. Yosef Karo)
${avBeitDin?.statement || "N/A"}

👑 NASI — רמב"ם (Rambam)
${nasiRuling?.statement || "N/A"}

📖 FULL DELIBERATION

${sageDetails}

🗳️ VOTE TALLY
MAJORITY (${finalResult?.majorityPosition || "N/A"}): ${finalResult?.majorityCount || 0} votes
${majorityNames}

MINORITY (${finalResult?.minorityPosition || "N/A"}): ${finalResult?.minorityCount || 0} votes
${minorityNames}
`;
  }

  async function handleCopyRuling() {
    const text = buildExportText();
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  function handleDownloadRuling() {
    const text = buildExportText();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sanhedrin-ruling-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleClarify(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || isClarifying || isDeliberating) return;

    setIsClarifying(true);
    setError(null);
    setClarification(null);

    try {
      const basePath = window.location.pathname.includes("/digital-sanhedrin")
        ? "/digital-sanhedrin"
        : "";
      const response = await fetch(`${basePath}/api/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          ...(effectiveApiKey ? { apiKey: effectiveApiKey } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setClarification(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Clarification failed";
      setError(msg);
    } finally {
      setIsClarifying(false);
    }
  }

  async function handleConfirmAndDeliberate() {
    if (!question.trim() || isDeliberating) return;

    setIsDeliberating(true);
    setError(null);
    if (clarification) {
      setTopic({ topic: clarification.topic, topicHebrew: clarification.topicHebrew });
    } else {
      setTopic(null);
    }
    setSageLog([]);
    setSoferSummaries({});
    setAvBeitDin(null);
    setNasiRuling(null);
    setFinalResult(null);
    setProgress(0);
    setCopySuccess(false);
    setSourceStatuses({});
    onDeliberationStart?.();

    try {
      const basePath = window.location.pathname.includes("/digital-sanhedrin")
        ? "/digital-sanhedrin"
        : "";
      const response = await fetch(`${basePath}/api/deliberate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          ...(effectiveApiKey ? { apiKey: effectiveApiKey } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error || `Server error: ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let sageCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;

          try {
            const event: DeliberationEvent = JSON.parse(
              dataLine.slice(6)
            );

            switch (event.type) {
              case "topic":
                setTopic({ topic: event.topic, topicHebrew: event.topicHebrew });
                break;

              case "sage":
                if (event.isUpdate) {
                  onSageUpdate?.({
                    seatNumber: event.seatNumber,
                    position: event.position,
                    ruling: event.ruling,
                    statement: event.statement,
                    source: event.source,
                    sefariaLink: event.sefariaLink,
                    isUpdate: true,
                  });
                  setSageLog((prev) =>
                    prev.map((s) =>
                      s.seatNumber === event.seatNumber
                        ? { ...s, position: event.position }
                        : s
                    )
                  );
                } else {
                  sageCount++;
                  setProgress(Math.min(95, Math.round((sageCount / 71) * 85)));

                  setActiveSageLocal(event.seatNumber);
                  onActiveSage?.(event.seatNumber);

                  const sageResult: SageResult = {
                    seatNumber: event.seatNumber,
                    position: event.position,
                    ruling: event.ruling,
                    statement: event.statement,
                    source: event.source,
                    sefariaLink: event.sefariaLink,
                  };

                  setSageLog((prev) => [...prev, sageResult]);
                  onSageUpdate?.(sageResult);

                  await new Promise((r) => setTimeout(r, 150));
                }
                break;

              case "sourceCheck":
                setSourceStatuses((prev) => ({
                  ...prev,
                  [event.seatNumber]: {
                    seatNumber: event.seatNumber,
                    status: event.status,
                    reason: event.reason,
                  },
                }));
                break;

              case "sofer":
                setProgress(90);
                setSoferSummaries((prev) => ({
                  ...prev,
                  [event.side]: event.summary,
                }));
                break;

              case "avBeitDin":
                setProgress(93);
                setAvBeitDin({
                  statement: event.statement,
                  position: event.position,
                });
                onActiveSage?.(2);
                break;

              case "nasi":
                setProgress(97);
                setNasiRuling({
                  statement: event.statement,
                  position: event.position,
                });
                onActiveSage?.(1);
                break;

              case "final":
                setProgress(100);
                setFinalResult({
                  ruling: event.ruling,
                  majorityCount: event.majorityCount,
                  minorityCount: event.minorityCount,
                  majorityPosition: event.majorityPosition,
                  minorityPosition: event.minorityPosition,
                });
                setActiveSageLocal(null);
                onActiveSage?.(null);
                break;

              case "error":
                setError(event.message);
                break;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
    } finally {
      setIsDeliberating(false);
      onActiveSage?.(null);
      // Delay the end callback slightly to ensure all isUpdate state changes have been processed
      setTimeout(() => {
        onDeliberationEnd?.();
      }, 500);
    }
  }

  function handleReset() {
    setQuestion("");
    setIsDeliberating(false);
    setIsClarifying(false);
    setClarification(null);
    setTopic(null);
    setSageLog([]);
    setSoferSummaries({});
    setAvBeitDin(null);
    setNasiRuling(null);
    setFinalResult(null);
    setError(null);
    setActiveSageLocal(null);
    setProgress(0);
    setCopySuccess(false);
    setSourceStatuses({});
    onActiveSage?.(null);
  }

  const hasResults = sageLog.length > 0 || finalResult;

  const majorityCount = sageLog.filter((s) => s.position === "majority").length;
  const minorityCount = sageLog.filter((s) => s.position === "minority").length;

  return (
    <section className="mx-auto max-w-4xl mt-12 md:mt-16 pb-12">
      <h2 className="text-2xl md:text-3xl font-bold text-[#d4af37] text-center mb-8" dir="rtl">
        הצג שאלה — Submit a She&apos;elah
      </h2>

      {/* Model indicator badge */}
      <div className="flex justify-center mb-4">
        {useClaudeSonnet && anthropicKey ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-900/40 border border-purple-500/40 text-purple-300">
            🟣 Claude Sonnet (BYOK)
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300">
            🟢 Gemini Flash (Free)
          </span>
        )}
      </div>

      {/* Question input + clarification flow */}
      {!hasResults && !isDeliberating && (
        <>
          {/* Step 1: Enter question */}
          {!clarification && (
            <form onSubmit={handleClarify} className="space-y-6">
              <div>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Type your halachic question here..."
                  rows={5}
                  disabled={isClarifying}
                  dir="ltr"
                  className="w-full rounded-xl border border-[#d4af37]/30 bg-[#1f1f39] text-[#f5f0e1] px-5 py-4 text-base text-left placeholder:text-[#f5f0e1]/30 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/40 transition-colors resize-vertical disabled:opacity-50"
                />
              </div>

              {/* Advanced / Settings collapsible */}
              <div className="rounded-xl border border-[#d4af37]/20 bg-[#1f1f39]/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#f5f0e1]/60 hover:text-[#d4af37] transition-colors cursor-pointer"
                >
                  <span>⚙️ Advanced Settings</span>
                  <span className="text-xs">{settingsOpen ? "▲" : "▼"}</span>
                </button>

                {settingsOpen && (
                  <div className="px-4 pb-4 space-y-4 border-t border-[#d4af37]/20 pt-4">
                    {/* Toggle */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#f5f0e1]">Use Claude Sonnet (bring your own key)</p>
                        <p className="text-xs text-[#f5f0e1]/50 mt-0.5">Higher quality — requires your own Anthropic API key</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={useClaudeSonnet}
                        onClick={() => handleToggleClaude(!useClaudeSonnet)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          useClaudeSonnet ? "bg-purple-600" : "bg-[#3a3a5c]"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useClaudeSonnet ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* API key input */}
                    {useClaudeSonnet && (
                      <div>
                        <label className="block text-xs text-[#f5f0e1]/60 mb-1">
                          Anthropic API Key
                        </label>
                        <input
                          type="password"
                          value={anthropicKey}
                          onChange={(e) => handleAnthropicKeyChange(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full rounded-lg border border-[#d4af37]/20 bg-[#141425] text-[#f5f0e1] px-4 py-2 text-sm placeholder:text-[#f5f0e1]/25 focus:outline-none focus:border-[#d4af37]/60 transition-colors"
                        />
                        <p className="mt-1 text-[10px] text-[#f5f0e1]/40">
                          Stored in your browser only. Never sent to our servers.
                          Get a key at{" "}
                          <a
                            href="https://console.anthropic.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#48cae4] hover:underline"
                          >
                            console.anthropic.com
                          </a>
                        </p>
                      </div>
                    )}

                    {!useClaudeSonnet && (
                      <p className="text-xs text-[#f5f0e1]/40">
                        Currently using <strong className="text-emerald-400">Gemini 2.0 Flash</strong> — free, fast, and capable. No key needed.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!question.trim() || isClarifying}
                className="w-full py-4 rounded-xl font-bold text-lg text-[#1a1a2e] bg-[#d4af37] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-[#e6c455] enabled:hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
              >
                {isClarifying
                  ? "⏳ The Sanhedrin is reviewing your question..."
                  : "הפעל את הסנהדרין — Convene the Sanhedrin"}
              </button>
            </form>
          )}

          {/* Step 2: Confirm clarified question */}
          {clarification && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-[#d4af37]/40 bg-[#1f1f39]/80">
                <p className="text-sm text-[#d4af37] font-semibold mb-3">📜 The Sanhedrin understands your she&apos;elah as:</p>
                <p className="text-[#f5f0e1] text-lg leading-relaxed" dir="ltr" style={{ textAlign: "left" }}>
                  &ldquo;{clarification.clarifiedQuestion}&rdquo;
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <span className="px-3 py-1 rounded-full bg-[#d4af37]/20 text-[#d4af37] font-semibold">
                    {clarification.topicHebrew} — {clarification.topic}
                  </span>
                </div>
                {clarification.assumptions && (
                  <p className="mt-3 text-sm text-[#f5f0e1]/60" dir="ltr" style={{ textAlign: "left" }}>
                    ⚠️ Assumptions: {clarification.assumptions}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmAndDeliberate}
                  className="flex-1 py-4 rounded-xl font-bold text-lg text-[#1a1a2e] bg-[#d4af37] transition-all cursor-pointer hover:bg-[#e6c455] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
                >
                  ✅ Yes, proceed with deliberation
                </button>
                <button
                  onClick={() => setClarification(null)}
                  className="px-6 py-4 rounded-xl font-bold text-[#d4af37] border border-[#d4af37]/40 transition-all cursor-pointer hover:bg-[#d4af37]/10"
                >
                  ✏️ Rephrase
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Deliberating state */}
      {isDeliberating && !hasResults && (
        <div className="text-center py-4">
          <p className="text-[#d4af37] font-semibold text-lg">⏳ The Sanhedrin is deliberating...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 rounded-xl border border-red-500/40 bg-red-900/20 text-red-300" dir="ltr">
          <p className="font-semibold">⚠️ Error</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={handleReset}
            className="mt-3 text-sm text-red-300/70 hover:text-red-300 transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* Progress bar */}
      {isDeliberating && (
        <div className="mt-6" dir="ltr">
          <div className="flex justify-between text-xs text-[#f5f0e1]/60 mb-1">
            <span>
              {topic
                ? `Topic: ${topic.topicHebrew} — ${topic.topic}`
                : "Classifying she'elah..."}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-[#1f1f39] rounded-full overflow-hidden border border-[#d4af37]/20">
            <div
              className="h-full bg-gradient-to-r from-[#d4af37] to-[#ffd700] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#f5f0e1]/40 mt-2 text-center">
            {sageLog.length} of 71 sages have spoken • Deliberation may take 1–2
            minutes
          </p>
        </div>
      )}

      {/* Vote Tally — only shown after final ruling */}
      {sageLog.length > 0 && finalResult && (
        <div className="mt-6 flex justify-center gap-8 text-lg font-bold">
          <span className="text-[#2d6a4f]">
            ✅ {finalResult?.majorityPosition || "Majority"}:{" "}
            {finalResult?.majorityCount || majorityCount}
          </span>
          <span className="text-[#f5f0e1]/30">|</span>
          <span className="text-[#9b2226]">
            ❌ {finalResult?.minorityPosition || "Minority"}:{" "}
            {finalResult?.minorityCount || minorityCount}
          </span>
        </div>
      )}

      {/* Deliberation Log */}
      {sageLog.length > 0 && (
        <div
          ref={logRef}
          className="mt-6 max-h-[60vh] overflow-y-auto rounded-2xl border border-[#d4af37]/20 bg-[#1f1f39]/60 p-4 space-y-4"
        >
          {/* Active speaker highlight */}
          {activeSage && isDeliberating && (
            <div className="sticky top-0 z-10 bg-[#1f1f39] border border-[#ffd700]/40 rounded-xl p-3 mb-4 shadow-[0_0_20px_rgba(255,215,0,0.15)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ffd700] animate-pulse" />
                <span className="text-[#ffd700] font-semibold text-sm">
                  Now speaking: Seat {activeSage}
                </span>
              </div>
            </div>
          )}

          {sageLog.map((sage, i) => {
            const info = getSageInfo(sage.seatNumber);
            return (
              <div
                key={`${sage.seatNumber}-${i}`}
                className={`p-3 rounded-xl border transition-all duration-500 ${
                  finalResult
                    ? sage.position === "majority"
                      ? "border-[#2d6a4f]/40 bg-[#2d6a4f]/10"
                      : sage.position === "minority"
                      ? "border-[#9b2226]/40 bg-[#9b2226]/10"
                      : "border-[#d4af37]/20 bg-[#d4af37]/5"
                    : "border-[#d4af37]/20 bg-[#d4af37]/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-[#d4af37]/70">
                      Seat {sage.seatNumber}
                    </span>
                    <span className="ml-2 text-xs text-[#f5f0e1]/60" dir="rtl">
                      {info.hebrewName}
                    </span>
                    <span className="ml-2 text-xs text-[#f5f0e1]/50">
                      ({info.englishName})
                    </span>
                    <span
                      className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        finalResult
                          ? sage.position === "majority"
                            ? "bg-[#2d6a4f]/30 text-[#4ade80]"
                            : "bg-[#9b2226]/30 text-[#f87171]"
                          : "bg-[#d4af37]/20 text-[#d4af37]"
                      }`}
                    >
                      {sage.ruling}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#f5f0e1]/90 leading-relaxed" dir="ltr" style={{ textAlign: "left" }}>
                  {sage.statement}
                </p>
                <p className="mt-1 text-xs text-[#f5f0e1]/50 italic flex items-center flex-wrap gap-1" dir="ltr" style={{ textAlign: "left" }}>
                  <span>📖 {sage.source}</span>
                  {sourceStatuses[sage.seatNumber] && (
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold not-italic ${
                        sourceStatuses[sage.seatNumber].status === 'verified'
                          ? 'bg-[#2d6a4f]/30 text-[#4ade80]'
                          : sourceStatuses[sage.seatNumber].status === 'unverified'
                          ? 'bg-[#92400e]/30 text-[#fbbf24]'
                          : 'bg-[#9b2226]/30 text-[#f87171]'
                      }`}
                      title={sourceStatuses[sage.seatNumber].reason}
                    >
                      {sourceStatuses[sage.seatNumber].status === 'verified'
                        ? '✅ Verified'
                        : sourceStatuses[sage.seatNumber].status === 'unverified'
                        ? '⚠️ Unverified'
                        : '❌ Invalid'}
                    </span>
                  )}
                  {sage.sefariaLink && (
                    <a
                      href={sage.sefariaLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#48cae4] hover:underline not-italic"
                    >
                      Sefaria ↗
                    </a>
                  )}
                </p>
                {sourceStatuses[sage.seatNumber]?.status === 'invalid' && (
                  <p className="mt-0.5 text-[10px] text-[#f87171]/70" dir="ltr" style={{ textAlign: "left" }}>
                    {sourceStatuses[sage.seatNumber].reason}
                  </p>
                )}
              </div>
            );
          })}

          {/* Sofer Summaries */}
          {soferSummaries.majority && (
            <div className="p-4 rounded-xl border border-[#2d6a4f]/40 bg-[#2d6a4f]/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📜</span>
                <span className="font-semibold text-[#2d6a4f] text-sm">
                  סופר א — Majority Scribe
                </span>
              </div>
              <p className="text-sm text-[#f5f0e1]/85 leading-relaxed" dir="ltr" style={{ textAlign: "left" }}>
                {soferSummaries.majority}
              </p>
            </div>
          )}

          {soferSummaries.minority && (
            <div className="p-4 rounded-xl border border-[#9b2226]/40 bg-[#9b2226]/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📜</span>
                <span className="font-semibold text-[#9b2226] text-sm">
                  סופר ב — Minority Scribe
                </span>
              </div>
              <p className="text-sm text-[#f5f0e1]/85 leading-relaxed" dir="ltr" style={{ textAlign: "left" }}>
                {soferSummaries.minority}
              </p>
            </div>
          )}

          {/* Av Beit Din */}
          {avBeitDin && (
            <div className="p-4 rounded-xl border border-[#d4af37]/50 bg-[#56440f]/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚖️</span>
                <span className="font-semibold text-[#d4af37] text-sm">
                  Av Beit Din — מרן (R. Yosef Karo)
                </span>
              </div>
              <p className="text-sm text-[#f5f0e1]/90 leading-relaxed" dir="ltr" style={{ textAlign: "left" }}>
                {avBeitDin.statement}
              </p>
            </div>
          )}

          {/* Nasi */}
          {nasiRuling && (
            <div className="p-4 rounded-xl border border-[#d4af37] bg-[#56440f]/40 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">👑</span>
                <span className="font-semibold text-[#d4af37]">
                  Nasi — רמב&quot;ם (Rambam)
                </span>
              </div>
              <p className="text-[#f5f0e1] leading-relaxed" dir="ltr" style={{ textAlign: "left" }}>
                {nasiRuling.statement}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Final Ruling */}
      {finalResult && (
        <div className="mt-8 p-6 rounded-2xl border-2 border-[#d4af37] bg-gradient-to-b from-[#1f1f39] to-[#141425] text-center shadow-[0_0_40px_rgba(212,175,55,0.15)]">
          <h3 className="text-2xl md:text-3xl font-bold text-[#d4af37] mb-4" dir="rtl">
            פסק הסנהדרין — The Sanhedrin&apos;s Ruling
          </h3>
          <p className="text-3xl md:text-4xl font-bold mb-4 uppercase tracking-wider" dir="ltr">
            <span className="text-[#d4af37]">{finalResult.majorityPosition}</span>
          </p>
          <p className="text-[#f5f0e1]/70" dir="ltr">
            {finalResult.majorityCount} in favor •{" "}
            {finalResult.minorityCount} dissenting
          </p>

          {/* Export Buttons */}
          <div className="mt-6 flex justify-center gap-4 flex-wrap">
            <button
              onClick={handleCopyRuling}
              className="px-6 py-3 rounded-xl font-bold text-sm text-[#1a1a2e] bg-[#48cae4] hover:bg-[#76d6ec] transition-all cursor-pointer hover:shadow-[0_0_20px_rgba(72,202,228,0.3)]"
            >
              {copySuccess ? "✅ Copied!" : "📋 Copy Full Ruling"}
            </button>
            <button
              onClick={handleDownloadRuling}
              className="px-6 py-3 rounded-xl font-bold text-sm text-[#1a1a2e] bg-[#d4af37] hover:bg-[#e6c455] transition-all cursor-pointer hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              📥 Download as Text
            </button>
          </div>

          <button
            onClick={handleReset}
            className="mt-6 px-8 py-3 rounded-xl font-bold text-[#1a1a2e] bg-[#d4af37] hover:bg-[#e6c455] transition-all cursor-pointer hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
          >
            Submit Another She&apos;elah
          </button>
        </div>
      )}
    </section>
  );
}
