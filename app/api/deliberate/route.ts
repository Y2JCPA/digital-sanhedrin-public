export const runtime = 'edge';
export const maxDuration = 300;

import { dayanim, Dayan, TierKey } from "../../data/sanhedrin";
import { callLLM, Message } from "../../lib/llm";

// Tier voting order: tier7 (junior/contemporary) → tier1 (senior/geonim)
const tierVotingOrder: TierKey[] = [
  "tier7",
  "tier6",
  "tier5",
  "tier4",
  "tier3",
  "tier2",
  "tier1",
];

function getSagesByTier(): Map<TierKey, Dayan[]> {
  const map = new Map<TierKey, Dayan[]>();
  for (const tier of tierVotingOrder) {
    const members = dayanim.filter(
      (d) => d.tier === tier && d.specialRole === undefined
    );
    if (members.length > 0) map.set(tier, members);
  }
  return map;
}

function getLeadership() {
  const avBeitDin = dayanim.find((d) => d.specialRole === "Av Beit Din");
  const nasi = dayanim.find((d) => d.specialRole === "Nasi");
  return { avBeitDin, nasi };
}

function buildSageProfile(d: Dayan): string {
  return `- Seat ${d.seat}: ${d.englishName} (${d.hebrewName}, ${d.rosheiTeivot})
  Era: ${d.era} | Eidah: ${d.eidah}
  Method: ${d.method}
  Sefarim: ${d.sefarim.join(", ")}`;
}

function buildIndividualSagePrompt(
  sage: Dayan,
  question: string,
  topic: string
): string {
  const profile = buildSageProfile(sage);

  return `You are simulating a deliberation of the Digital Sanhedrin — a council of 71 of the greatest Jewish legal scholars in history.

You are embodying the following sage. Generate their response to the she'elah below. You must:
1. EMBODY their unique voice and reasoning style — not just cite their sources, but THINK and SPEAK the way they do:
   - The Rambam: terse, systematic, first-principles. Cuts straight to the din.
   - R. Akiva Eiger: opens with a devastating kushya (difficulty/contradiction), then resolves it.
   - The Rema: "And the minhag in our lands is..." Always brings the lived communal practice.
   - R. Ovadia Yosef: encyclopedic, cites 10+ sources, aims for leniency when possible. "Uv'prat..."
   - The Chazon Ish: redefines the sugya from scratch, builds from conceptual foundations.
   - The Ben Ish Chai: weaves kabbalah and halacha warmly, gives the din AND the deeper reason.
   - R. Chaim Soloveitchik: "There are two dinim here..." Creates chakirot and conceptual distinctions.
   - Rashi: crystal clear, says in 5 words what others say in 500. The peshat.
   - The Shakh: cross-references obsessively, catches contradictions, razor-sharp analysis.
   Each sage's statement should be UNMISTAKABLY theirs in tone, structure, and approach.
2. Cite at least one source from their own sefarim
3. Give a clear ruling
4. Keep their statement to 2-5 sentences

Sage profile:

${profile}

The she'elah: ${question}
${topic ? `Topic area: ${topic}` : ""}

CRITICAL RULES:
- The "ruling" field must be a SHORT position label (2-5 words). Examples: "mutar", "assur", "27 grams minimum", "mutar with conditions". NOT a full sentence.
- Sources should be real and accurate — cite actual sefarim and sections where possible
- Write all statements in clear English (left-to-right). No mixed RTL/LTR text in statements.

Respond with a JSON object:
{
  "seatNumber": ${sage.seat},
  "name": "${sage.englishName}",
  "hebrewName": "${sage.hebrewName}",
  "ruling": "<short 2-5 word position>",
  "statement": "<2-5 sentences in their distinctive voice and style>",
  "source": "<specific citation>",
  "sefariaLink": "<url if known, otherwise omit>"
}

Return ONLY the JSON. No markdown fences, no commentary.`;
}

function buildSummaryPrompt(
  side: "majority" | "minority",
  position: string,
  sageStatements: Array<{ name: string; statement: string; source: string }>,
  question: string
): string {
  const stmts = sageStatements
    .map((s) => `- ${s.name}: "${s.statement}" (Source: ${s.source})`)
    .join("\n");

  return `You are the ${side === "majority" ? "סופר א (Majority Scribe)" : "סופר ב (Minority Scribe)"} of the Digital Sanhedrin.

Summarize the ${side} opinion (${position}) on the following she'elah:
${question}

The following sages held this position:
${stmts}

Write a 3-5 sentence summary that captures the key reasoning threads and sources. Write in a dignified, formal tone befitting a court document.

Return ONLY the summary text, no JSON, no markdown.`;
}

function buildLeadershipPrompt(
  role: "Av Beit Din" | "Nasi",
  sage: Dayan,
  question: string,
  topic: string,
  allRulings: Array<{ name: string; ruling: string; statement: string }>,
  majorityPosition: string,
  minorityPosition: string,
  majorityCount: number,
  minorityCount: number,
  majoritySummary: string,
  minoritySummary: string
): string {
  const rulingsSummary = allRulings
    .map((r) => `- ${r.name}: ${r.ruling}`)
    .join("\n");

  return `You are ${sage.englishName} (${sage.hebrewName}), serving as ${role} of the Digital Sanhedrin.

The Sanhedrin has deliberated on the following she'elah:
${question}

Topic: ${topic}

Vote tally: ${majorityPosition}: ${majorityCount} | ${minorityPosition}: ${minorityCount}

Majority summary (${majorityPosition}):
${majoritySummary}

Minority summary (${minorityPosition}):
${minoritySummary}

Individual rulings:
${rulingsSummary}

${
  role === "Av Beit Din"
    ? "As Av Beit Din, synthesize the deliberation. Acknowledge both sides, then state your own position clearly. 3-5 sentences, in character."
    : "As Nasi, deliver the final ruling. You speak last and with greatest authority. Acknowledge the weight of the deliberation, then pronounce the Sanhedrin's ruling. 3-5 sentences, in character."
}

Respond with a JSON object:
{
  "statement": "<your statement>",
  "position": "<majority position or minority position>"
}

Return ONLY the JSON. No markdown fences.`;
}

function parseJSON<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

// Source validation helpers

// Use Sefaria's name resolution API — handles fuzzy matching, transliteration
// differences (Shabbat→Sabbath), and returns canonical refs
async function resolveSefariaRef(source: string): Promise<{ found: boolean; canonicalRef?: string }> {
  // Clean up the source citation for the name API
  let query = source.trim();
  // Remove common prefixes
  query = query.replace(/^(see |cf\. |based on |as stated in |in |quoted in )/i, '');
  // Remove vol./volume references that confuse the API
  query = query.replace(/,?\s*vol\.?\s*\d+/gi, '');
  // Trim trailing punctuation
  query = query.replace(/[.;,]+$/, '').trim();

  try {
    const resp = await fetch(
      `https://www.sefaria.org/api/name/${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (data.is_ref && data.ref) {
      return { found: true, canonicalRef: data.ref };
    }
    // Sometimes the API returns completions but not a direct ref —
    // try stripping "Hilchot"/"Hilkhot" which Sefaria doesn't use
    if (!data.is_ref && /hilch?ot/i.test(query)) {
      const retryQuery = query.replace(/hilch?ot\s+/gi, '');
      const resp2 = await fetch(
        `https://www.sefaria.org/api/name/${encodeURIComponent(retryQuery)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (resp2.ok) {
        const data2 = await resp2.json();
        if (data2.is_ref && data2.ref) {
          return { found: true, canonicalRef: data2.ref };
        }
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

async function validateSageSource(
  sageResult: { seatNumber: number; source: string },
  sageData: Dayan
): Promise<{ seatNumber: number; status: 'verified' | 'unverified' | 'invalid'; reason: string }> {
  const source = sageResult.source;

  // Bibliography check: is the cited sefer in this sage's sefarim list?
  const inBibliography = sageData.sefarim.some((sefer) => {
    const seferLower = sefer.toLowerCase();
    const sourceLower = source.toLowerCase();
    // Direct substring match
    if (sourceLower.includes(seferLower)) return true;
    // Check if all significant words of the sefer name appear in the source
    const words = seferLower.split(/[\s,()]+/).filter((w) => w.length > 2);
    return words.length > 0 && words.every((w) => sourceLower.includes(w));
  });

  if (!inBibliography) {
    return {
      seatNumber: sageResult.seatNumber,
      status: 'invalid',
      reason: `Cited source not found in ${sageData.englishName}'s known sefarim`,
    };
  }

  // Sefaria check: use the name resolution API for fuzzy matching
  const resolved = await resolveSefariaRef(source);
  if (resolved.found) {
    return {
      seatNumber: sageResult.seatNumber,
      status: 'verified',
      reason: `Verified via Sefaria: ${resolved.canonicalRef}`,
    };
  }

  // In bibliography but not verifiable via Sefaria
  return {
    seatNumber: sageResult.seatNumber,
    status: 'unverified',
    reason: 'Source is in bibliography but could not be verified via Sefaria',
  };
}

export async function POST(request: Request) {
  let body: { question?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = body.question?.trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "Question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Dual-provider: use Anthropic if user provides their own key, else Gemini Flash (free)
  const userApiKey = body.apiKey?.trim();
  let provider: "anthropic" | "gemini";
  let apiKey: string;

  if (userApiKey) {
    provider = "anthropic";
    apiKey = userApiKey;
  } else {
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    if (!googleKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_AI_API_KEY not configured on server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    provider = "gemini";
    apiKey = googleKey;
  }

  // Helper: call LLM with the resolved provider/key
  async function llm(messages: Message[], maxTokens: number = 4096): Promise<string> {
    return callLLM(apiKey, provider, messages, maxTokens);
  }

  const tiers = getSagesByTier();
  const { avBeitDin, nasi } = getLeadership();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        // Step 1: Topic classification (dedicated pre-call)
        let topic = "";
        let topicHebrew = "";

        const topicPrompt = `Classify this Jewish legal (halachic) she'elah into one of:
- Orach Chayim (אורח חיים) - daily life, Shabbat, holidays, prayer
- Yoreh De'ah (יורה דעה) - kashrut, niddah, mourning, conversion
- Even HaEzer (אבן העזר) - marriage, divorce
- Choshen Mishpat (חושן משפט) - damages, property, courts
- Hashkafa (השקפה) - philosophy, cross-cutting

She'elah: ${question}

Respond with JSON only:
{"topic": "<english name>", "topicHebrew": "<hebrew name>"}`;

        try {
          const topicText = await llm([{ role: "user", content: topicPrompt }], 256);
          const topicData = parseJSON<{ topic: string; topicHebrew: string }>(topicText);
          topic = topicData.topic || "";
          topicHebrew = topicData.topicHebrew || "";
          send({ type: "topic", topic, topicHebrew });
        } catch {
          // Topic classification failed, continue without it
        }

        // Step 2: Blind parallel deliberation — leadership first, then by tier
        const allRulings: Array<{
          seatNumber: number;
          name: string;
          hebrewName: string;
          ruling: string;
          statement: string;
          source: string;
          sefariaLink?: string;
          position?: "majority" | "minority";
        }> = [];

        // 2a: Rambam (Nasi) and Maran (Av Beit Din) blind votes — same as any sage
        const leadershipBlindSages = [nasi, avBeitDin].filter((s): s is Dayan => !!s);
        const leadershipBlindPromises = leadershipBlindSages.map(async (sage) => {
          const prompt = buildIndividualSagePrompt(sage, question, topic);
          const responseText = await llm([{ role: "user", content: prompt }], 512);

          let sageResponse: {
            seatNumber: number;
            name: string;
            hebrewName: string;
            ruling: string;
            statement: string;
            source: string;
            sefariaLink?: string;
          };

          try {
            sageResponse = parseJSON(responseText);
          } catch {
            const objMatch = responseText.match(/\{[\s\S]*\}/);
            if (objMatch) {
              sageResponse = JSON.parse(objMatch[0]);
            } else {
              throw new Error(`Failed to parse sage response for seat ${sage.seat}`);
            }
          }

          sageResponse.seatNumber = sage.seat;
          sageResponse.name = sageResponse.name || sage.englishName;
          sageResponse.hebrewName = sageResponse.hebrewName || sage.hebrewName;

          send({
            type: "sage",
            seatNumber: sageResponse.seatNumber,
            position: "pending" as string,
            ruling: sageResponse.ruling,
            statement: sageResponse.statement,
            source: sageResponse.source,
            ...(sageResponse.sefariaLink ? { sefariaLink: sageResponse.sefariaLink } : {}),
          });

          return sageResponse;
        });

        const leadershipBlindResults = await Promise.allSettled(leadershipBlindPromises);
        for (const result of leadershipBlindResults) {
          if (result.status === "fulfilled") {
            allRulings.push(result.value);
          } else {
            console.error("Leadership blind vote failed:", result.reason);
          }
        }

        // 2b: Tier-by-tier blind deliberation (tier7 → tier1)
        for (const [, sages] of tiers) {
          // Fire all sage calls in parallel within this tier — each sage is BLIND to others
          const tierPromises = sages.map(async (sage) => {
            const prompt = buildIndividualSagePrompt(sage, question, topic);
            const responseText = await llm([{ role: "user", content: prompt }], 512);

            let sageResponse: {
              seatNumber: number;
              name: string;
              hebrewName: string;
              ruling: string;
              statement: string;
              source: string;
              sefariaLink?: string;
            };

            try {
              sageResponse = parseJSON(responseText);
            } catch {
              // Try to extract JSON object from response
              const objMatch = responseText.match(/\{[\s\S]*\}/);
              if (objMatch) {
                sageResponse = JSON.parse(objMatch[0]);
              } else {
                throw new Error(`Failed to parse sage response for seat ${sage.seat}`);
              }
            }

            // Ensure seat number matches
            sageResponse.seatNumber = sage.seat;
            sageResponse.name = sageResponse.name || sage.englishName;
            sageResponse.hebrewName = sageResponse.hebrewName || sage.hebrewName;

            // Stream this sage's result immediately as it completes
            send({
              type: "sage",
              seatNumber: sageResponse.seatNumber,
              position: "pending" as string,
              ruling: sageResponse.ruling,
              statement: sageResponse.statement,
              source: sageResponse.source,
              ...(sageResponse.sefariaLink ? { sefariaLink: sageResponse.sefariaLink } : {}),
            });

            return sageResponse;
          });

          // Wait for all sages in this tier to complete before moving to next tier
          const tierResults = await Promise.allSettled(tierPromises);
          for (const result of tierResults) {
            if (result.status === "fulfilled") {
              allRulings.push(result.value);
            } else {
              console.error("Sage call failed:", result.reason);
            }
          }
        }

        // Step 3: Source validation (after all 69 sages, before leadership)
        const SEFARIA_BATCH_SIZE = 10;
        for (let i = 0; i < allRulings.length; i += SEFARIA_BATCH_SIZE) {
          const batch = allRulings.slice(i, i + SEFARIA_BATCH_SIZE);
          const validationPromises = batch.map((ruling) => {
            const sageData = dayanim.find((d) => d.seat === ruling.seatNumber);
            if (!sageData) {
              return Promise.resolve({
                seatNumber: ruling.seatNumber,
                status: 'unverified' as const,
                reason: 'Sage data not found',
              });
            }
            return validateSageSource(ruling, sageData);
          });

          const validationResults = await Promise.all(validationPromises);
          for (const result of validationResults) {
            send({
              type: "sourceCheck",
              seatNumber: result.seatNumber,
              status: result.status,
              reason: result.reason,
            });
          }
        }

        // Step 4: Tally votes using LLM-based semantic grouping
        const rulingsList = allRulings
          .map((r) => `Seat ${r.seatNumber}: "${r.ruling}"`)
          .join("\n");

        const classificationPrompt = `The following ${allRulings.length} sages voted on a halachic question. Their rulings are listed below.
Group them into exactly TWO positions (the two main camps of opinion).
For each sage, classify them as "position_a" or "position_b".

${rulingsList}

Respond with JSON:
{
  "position_a_label": "<short description of position A>",
  "position_b_label": "<short description of position B>",
  "position_a_seats": [list of seat numbers],
  "position_b_seats": [list of seat numbers]
}

The position with MORE seats should be position_a. Every seat number must appear in exactly one list.
Return ONLY the JSON. No markdown fences.`;

        let majorityPosition: string;
        let minorityPosition: string;
        let positionASeats: Set<number>;

        try {
          const classificationText = await llm([{ role: "user", content: classificationPrompt }], 2048);
          const classification = parseJSON<{
            position_a_label: string;
            position_b_label: string;
            position_a_seats: number[];
            position_b_seats: number[];
          }>(classificationText);

          majorityPosition = classification.position_a_label;
          minorityPosition = classification.position_b_label;
          positionASeats = new Set(classification.position_a_seats);

          // Ensure position_a is actually the majority
          if (classification.position_b_seats.length > classification.position_a_seats.length) {
            majorityPosition = classification.position_b_label;
            minorityPosition = classification.position_a_label;
            positionASeats = new Set(classification.position_b_seats);
          }
        } catch (classErr) {
          console.error("Classification LLM call failed, falling back to simple tallying:", classErr);
          // Fallback: simple keyword matching
          const rulingCounts = new Map<string, number>();
          for (const r of allRulings) {
            const normalized = r.ruling.toLowerCase().trim();
            const key =
              normalized.includes("mutar") || normalized.includes("permit")
                ? "mutar"
                : normalized.includes("assur") || normalized.includes("prohibit") || normalized.includes("forbid")
                ? "assur"
                : normalized;
            rulingCounts.set(key, (rulingCounts.get(key) || 0) + 1);
          }
          const sorted = [...rulingCounts.entries()].sort((a, b) => b[1] - a[1]);
          majorityPosition = sorted[0]?.[0] || "mutar";
          minorityPosition = sorted[1]?.[0] || "assur";
          positionASeats = new Set(
            allRulings
              .filter((r) => {
                const normalized = r.ruling.toLowerCase().trim();
                const key =
                  normalized.includes("mutar") || normalized.includes("permit")
                    ? "mutar"
                    : normalized.includes("assur") || normalized.includes("prohibit") || normalized.includes("forbid")
                    ? "assur"
                    : normalized;
                return key === majorityPosition;
              })
              .map((r) => r.seatNumber)
          );
        }

        for (const r of allRulings) {
          r.position = positionASeats.has(r.seatNumber) ? "majority" : "minority";
        }

        // Send position updates
        for (const r of allRulings) {
          send({
            type: "sage",
            seatNumber: r.seatNumber,
            position: r.position!,
            ruling: r.ruling,
            statement: r.statement,
            source: r.source,
            ...(r.sefariaLink ? { sefariaLink: r.sefariaLink } : {}),
            isUpdate: true,
          });
        }

        const majorityCount = allRulings.filter(
          (r) => r.position === "majority"
        ).length;
        const minorityCount = allRulings.filter(
          (r) => r.position === "minority"
        ).length;

        const majoritySages = allRulings
          .filter((r) => r.position === "majority")
          .map((r) => ({
            name: r.name,
            statement: r.statement,
            source: r.source,
          }));
        const minoritySages = allRulings
          .filter((r) => r.position === "minority")
          .map((r) => ({
            name: r.name,
            statement: r.statement,
            source: r.source,
          }));

        // Step 5: Sofer summaries (parallel)
        const [majoritySummary, minoritySummary] = await Promise.all([
          llm(
            [{ role: "user", content: buildSummaryPrompt("majority", majorityPosition, majoritySages, question) }],
            1024
          ),
          llm(
            [{ role: "user", content: buildSummaryPrompt("minority", minorityPosition, minoritySages, question) }],
            1024
          ),
        ]);

        send({ type: "sofer", side: "majority", summary: majoritySummary });
        send({ type: "sofer", side: "minority", summary: minoritySummary });

        // Step 6: Leadership synthesis (Av Beit Din and Nasi see full tally — their historical role)

        // Av Beit Din
        if (avBeitDin) {
          const avText = await llm(
            [{
              role: "user",
              content: buildLeadershipPrompt(
                "Av Beit Din",
                avBeitDin,
                question,
                topic,
                allRulings.map((r) => ({
                  name: r.name,
                  ruling: r.ruling,
                  statement: r.statement,
                })),
                majorityPosition,
                minorityPosition,
                majorityCount,
                minorityCount,
                majoritySummary,
                minoritySummary
              ),
            }],
            1024
          );

          let avStatement = "";
          let avPosition = majorityPosition;

          try {
            const avData = parseJSON<{ statement: string; position: string }>(avText);
            avStatement = avData.statement || avText;
            avPosition = avData.position || majorityPosition;
          } catch {
            console.error("Failed to parse Av Beit Din JSON, using raw text:", avText.slice(0, 200));
            avStatement = avText;
          }

          send({
            type: "avBeitDin",
            statement: avStatement,
            position: avPosition,
          });
        }

        // Nasi
        if (nasi) {
          const nasiText = await llm(
            [{
              role: "user",
              content: buildLeadershipPrompt(
                "Nasi",
                nasi,
                question,
                topic,
                allRulings.map((r) => ({
                  name: r.name,
                  ruling: r.ruling,
                  statement: r.statement,
                })),
                majorityPosition,
                minorityPosition,
                majorityCount,
                minorityCount,
                majoritySummary,
                minoritySummary
              ),
            }],
            2048
          );

          let nasiStatement = "";
          let nasiPositionStr = majorityPosition;

          try {
            const nasiData = parseJSON<{ statement: string; position: string }>(nasiText);
            nasiStatement = nasiData.statement || nasiText;
            nasiPositionStr = nasiData.position || majorityPosition;
          } catch {
            console.error("Failed to parse Nasi JSON, using raw text:", nasiText.slice(0, 200));
            nasiStatement = nasiText;
          }

          if (!nasiStatement || nasiStatement.trim().length === 0) {
            nasiStatement = "The Nasi affirms the ruling of the Sanhedrin.";
          }

          send({
            type: "nasi",
            statement: nasiStatement,
            position: nasiPositionStr,
          });
        }

        // Step 7: Final tally (leadership blind votes already in allRulings — total is 71)
        send({
          type: "final",
          ruling: majorityPosition,
          majorityCount,
          minorityCount,
          majorityPosition,
          minorityPosition,
        });

        controller.close();
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message: errorMessage });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
