"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { dayanim, Dayan, soferim, tierLabels } from "./data/sanhedrin";

import SheelahPanel, { SageResult } from "./components/SheelahPanel";

type PositionedDayan = Dayan & {
  x: number;
  y: number;
  delayMs: number;
};

const tierOrder: Array<Exclude<Dayan["tier"], "leadership">> = [
  "tier7",
  "tier6",
  "tier5",
  "tier4",
  "tier3",
  "tier2",
  "tier1",
];

const tierRadii: Record<Exclude<Dayan["tier"], "leadership">, number> = {
  tier7: 46,
  tier6: 41,
  tier5: 36,
  tier4: 31,
  tier3: 26,
  tier2: 21,
  tier1: 16,
};

function pointsForTier(members: Dayan[], radius: number): PositionedDayan[] {
  const minAngle = 205;
  const maxAngle = -25;
  const n = members.length;

  return members.map((m, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const angle = minAngle + (maxAngle - minAngle) * t;
    const radians = (angle * Math.PI) / 180;
    const x = 50 + radius * Math.cos(radians);
    const y = 88 - radius * Math.sin(radians);

    const distFromCenterIndex = Math.abs(i - (n - 1) / 2);
    const maxDist = (n - 1) / 2;
    const delayMs = Math.max(0, (maxDist - distFromCenterIndex) * 50);

    return { ...m, x, y, delayMs };
  });
}

type SeatState = "default" | "active" | "voted" | "majority" | "minority";

export default function Home() {
  const [selected, setSelected] = useState<Dayan | null>(null);
  const [seatStates, setSeatStates] = useState<Record<number, SeatState>>({});
  const [activeSeat, setActiveSeat] = useState<number | null>(null);

  const leadership = useMemo(
    () => dayanim.filter((d) => d.tier === "leadership"),
    []
  );

  const semicircleMembers = useMemo(() => {
    const list: PositionedDayan[] = [];
    for (const tier of tierOrder) {
      const members = dayanim.filter((d) => d.tier === tier);
      list.push(...pointsForTier(members, tierRadii[tier]));
    }
    return list;
  }, []);

  const nasi = leadership.find((d) => d.specialRole === "Nasi");
  const avBeitDin = leadership.find((d) => d.specialRole === "Av Beit Din");

  // Store each sage's actual position so we can reveal at the end — use ref for latest value
  const sagePositionsRef = useRef<Record<number, "majority" | "minority">>({});

  const handleSageUpdate = useCallback((sage: SageResult) => {
    if (sage.isUpdate) {
      // Final position update from tally — store position for reveal
      sagePositionsRef.current = {
        ...sagePositionsRef.current,
        [sage.seatNumber]: sage.position as "majority" | "minority",
      };
    } else {
      // Sage just spoke — store their position, set circle to active then "voted" (neutral)
      sagePositionsRef.current = {
        ...sagePositionsRef.current,
        [sage.seatNumber]: sage.position as "majority" | "minority",
      };
      setSeatStates((prev) => ({
        ...prev,
        [sage.seatNumber]: "active",
      }));

      // After 1.5 seconds, transition to "voted" (neutral amber) — NOT green/red yet
      setTimeout(() => {
        setSeatStates((prev) => {
          if (prev[sage.seatNumber] === "active") {
            return { ...prev, [sage.seatNumber]: "voted" };
          }
          return prev;
        });
      }, 1500);
    }
  }, []);

  const handleActiveSage = useCallback((seatNumber: number | null) => {
    setActiveSeat(seatNumber);
    if (seatNumber !== null) {
      setSeatStates((prev) => ({
        ...prev,
        [seatNumber]: "active",
      }));
    }
  }, []);

  const handleDeliberationStart = useCallback(() => {
    setSeatStates({});
    sagePositionsRef.current = {};
    setActiveSeat(null);
  }, []);

  const handleDeliberationEnd = useCallback(() => {
    setActiveSeat(null);
    // THE BIG REVEAL — flip all circles to green/red simultaneously
    const positions = sagePositionsRef.current;
    setSeatStates(() => {
      const newStates: Record<number, SeatState> = {};
      for (const [seat, position] of Object.entries(positions)) {
        newStates[Number(seat)] = position === "majority" ? "majority" : "minority";
      }
      return newStates;
    });
  }, []);

  function getSeatClassName(seat: number, isLeadership = false): string {
    const state = seatStates[seat] || "default";
    const base = "seat-node";
    const leadershipClass = isLeadership ? " seat-leadership" : "";

    switch (state) {
      case "active":
        return `${base}${leadershipClass} seat-active`;
      case "voted":
        return `${base}${leadershipClass} seat-voted`;
      case "majority":
        return `${base}${leadershipClass} seat-majority`;
      case "minority":
        return `${base}${leadershipClass} seat-minority`;
      default:
        return `${base}${leadershipClass}`;
    }
  }

  return (
      <main className="min-h-screen bg-[#1a1a2e] text-[#f5f0e1] px-4 py-8 md:px-8">
        
        <div className="mx-auto max-w-7xl">
          <header className="text-center mb-8 md:mb-10">
            <h1 className="text-3xl md:text-5xl font-bold tracking-wide text-[#d4af37] leading-tight">
              סנהדרין דיגיטלית — The Digital Sanhedrin
            </h1>
            <p className="mt-3 text-sm md:text-base text-[#f5f0e1]/80">
              חצי גורן עגולה — seventy-one voices of halachic greatness
            </p>
          </header>

          <section className="relative mx-auto w-full max-w-6xl aspect-[16/10] md:aspect-[16/9] rounded-3xl border border-[#d4af37]/40 bg-gradient-to-b from-[#1f1f39] to-[#141425] overflow-hidden shadow-[0_0_80px_rgba(212,175,55,0.08)]">
            <div className="absolute inset-x-[7%] top-[8%] h-[82%] rounded-t-full border-[2px] border-b-0 border-[#d4af37]/70" />

            {semicircleMembers.map((dayan) => (
              <button
                key={dayan.seat}
                onClick={() => setSelected(dayan)}
                className={getSeatClassName(dayan.seat)}
                style={{
                  left: `${dayan.x}%`,
                  top: `${dayan.y}%`,
                  animationDelay: `${dayan.delayMs}ms`,
                }}
                aria-label={`${dayan.englishName} seat ${dayan.seat}`}
              >
                <span className="seat-text">{dayan.rosheiTeivot}</span>
              </button>
            ))}

            {avBeitDin && (
              <button
                onClick={() => setSelected(avBeitDin)}
                className={getSeatClassName(avBeitDin.seat, true)}
                style={{ left: "56%", top: "80%", animationDelay: "360ms" }}
              >
                <span className="seat-text">{avBeitDin.rosheiTeivot}</span>
              </button>
            )}

            {nasi && (
              <button
                onClick={() => setSelected(nasi)}
                className={getSeatClassName(nasi.seat, true)}
                style={{ left: "50%", top: "85%", animationDelay: "450ms" }}
              >
                <span className="seat-text">{nasi.rosheiTeivot}</span>
              </button>
            )}

            <div className="absolute top-[7%] left-1/2 -translate-x-1/2 flex items-start gap-8 text-center">
              {soferim.map((sofer) => (
                <div
                  key={sofer.title}
                  className="text-[#c0c0c0] text-xs md:text-sm"
                >
                  <div className="text-2xl md:text-3xl">📜</div>
                  <div className="font-semibold">{sofer.title}</div>
                  <div className="opacity-80">{sofer.subtitle}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="mx-auto max-w-4xl mt-10 p-4 rounded-xl border border-[#d4af37]/30 bg-[#1f1f39]/60">
            <p className="text-sm text-[#f5f0e1]/80 leading-relaxed text-center">
              <span className="text-[#d4af37] font-semibold">&#x26A0;&#xFE0F; Disclaimer:</span>{" "}
              This is an educational and entertainment tool only. The Digital Sanhedrin is an AI simulation and does not constitute actual halachic (Jewish legal) guidance. For real halachic questions, please consult a qualified rabbi or posek.
            </p>
          </div>

          <SheelahPanel
            onSageUpdate={handleSageUpdate}
            onActiveSage={handleActiveSage}
            onDeliberationStart={handleDeliberationStart}
            onDeliberationEnd={handleDeliberationEnd}
          />
        </div>

        {selected && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-6"
            onClick={() => setSelected(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#d4af37]/60 bg-[#1b1b33] p-5 md:p-7 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-[#d4af37] text-sm font-semibold">
                    Seat {selected.seat}
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold mt-1">
                    {selected.rosheiTeivot}
                  </h2>
                  <p className="mt-1 text-[#f5f0e1]">{selected.hebrewName}</p>
                  <p className="text-[#f5f0e1]/80">{selected.englishName}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-2xl leading-none text-[#f5f0e1]/70 hover:text-[#ffd700]"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 grid gap-3 text-sm md:text-base">
                <p>
                  <span className="text-[#d4af37] font-semibold">Tier:</span>{" "}
                  {tierLabels[selected.tier]}
                </p>
                <p>
                  <span className="text-[#d4af37] font-semibold">Era:</span>{" "}
                  {selected.era}
                </p>
                <p>
                  <span className="text-[#d4af37] font-semibold">Eidah:</span>{" "}
                  {selected.eidah}
                </p>
                <p className="leading-relaxed">
                  <span className="text-[#d4af37] font-semibold">Method:</span>{" "}
                  {selected.method}
                </p>

                <div>
                  <p className="text-[#d4af37] font-semibold">Sefarim:</p>
                  <ul className="list-disc ps-5 mt-1 space-y-1 text-[#f5f0e1]/90">
                    {selected.sefarim.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>

                {selected.sefaria && (
                  <a
                    href={selected.sefaria}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-[#48cae4] hover:underline"
                  >
                    Open on Sefaria ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
