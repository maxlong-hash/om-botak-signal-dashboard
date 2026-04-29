export type TelegramTextPart = string | { text?: string };

export interface TelegramMessage {
  id: number;
  type: string;
  date?: string;
  from?: string;
  text?: string | TelegramTextPart[];
  reactions?: Array<{ count?: number; emoji?: string; type?: string }>;
}

export interface TelegramExport {
  name?: string;
  type?: string;
  id?: number;
  messages?: TelegramMessage[];
}

export interface SignalEvent {
  id: number;
  tradeDate: string;
  messageDate: string;
  messageTime: string;
  signalDateTime: string;
  signalTime: string;
  embeddedTime: boolean;
  signalName: string;
  rawSignalName: string;
  category: SignalCategory;
  tags: string[];
  ticker: string;
  price: number;
  hasPrice: boolean;
  score: number;
  total: number;
  starred: boolean;
  session: TradingSession;
  minutes: number;
  rawText: string;
  sourceFrom: string;
  reactionCount: number;
  duplicateKey: string;
  duplicateCount: number;
  rawMessageIds: number[];
}

export type SignalCategory =
  | "Smart Money"
  | "Momentum"
  | "Closing"
  | "Trend"
  | "Selection"
  | "TBSM"
  | "Aura"
  | "Other";

export type TradingSession =
  | "Opening"
  | "Sesi 1"
  | "Lunch"
  | "Sesi 2"
  | "Closing"
  | "After Market";

export interface DatasetSummary {
  chatName: string;
  messageCount: number;
  signalRawCount: number;
  signalUniqueCount: number;
  tickerCount: number;
  minDate: string;
  maxDate: string;
  lastMessageDateTime: string;
}

export interface ParsedDataset {
  rawSignals: SignalEvent[];
  uniqueSignals: SignalEvent[];
  summary: DatasetSummary;
}

export interface TickerStat {
  ticker: string;
  eventCount: number;
  rawCount: number;
  scoreSum: number;
  maxTotal: number;
  avgTotal: number;
  firstSignal: SignalEvent;
  lastSignal: SignalEvent;
  firstPrice: number;
  lastPrice: number;
  pricedEventCount: number;
  priceChangePct: number;
  signalNames: string[];
  categories: SignalCategory[];
  sessions: TradingSession[];
  starredCount: number;
  reactionCount: number;
  conviction: number;
}

export interface GroupStat {
  key: string;
  count: number;
  rawCount: number;
  scoreSum: number;
  maxTotal: number;
}

export interface SignalEdge {
  signalName: string;
  category: SignalCategory;
  sampleCount: number;
  rawCount: number;
  moveRate: number;
  upRate: number;
  downRate: number;
  avgForwardReturnPct: number;
  avgMaxRunupPct: number;
  avgMaxDrawdownPct: number;
  avgAbsMovePct: number;
  bestTicker: string;
  bestMovePct: number;
  edgeScore: number;
  samples: SignalEdgeSample[];
}

export interface SignalEdgeSample {
  signal: SignalEvent;
  latestSignal: SignalEvent;
  finalReturnPct: number;
  maxRunupPct: number;
  maxDrawdownPct: number;
  absMovePct: number;
}

const SIGNAL_START = /Signal\b/i;
const SIGNAL_TIME = /\[(\d{2}:\d{2}:\d{2})\]/;
const SIGNAL_ROW =
  /(?:^|[\r\n/])\s*([A-Z][A-Z0-9.-]{1,8})(?:\s*(\*))?\s*\|\s*(?:(\d[\d.,]*)\s*\|\s*)?([+-]?\d+(?:[.,]\d+)?)\s*\(Total:\s*([+-]?\d+(?:[.,]\d+)?)\)/gim;

export function parseTelegramExport(data: TelegramExport): ParsedDataset {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const rawSignals = messages
    .flatMap(parseSignalMessage)
    .sort(compareSignals);
  const uniqueSignals = dedupeSignals(rawSignals);
  const dates = rawSignals.map((signal) => signal.tradeDate).sort();
  const lastMessageDateTime =
    messages
      .map((message) => message.date || "")
      .filter(Boolean)
      .sort()
      .at(-1) || "";

  return {
    rawSignals,
    uniqueSignals,
    summary: {
      chatName: data.name || "Telegram Export",
      messageCount: messages.length,
      signalRawCount: rawSignals.length,
      signalUniqueCount: uniqueSignals.length,
      tickerCount: new Set(uniqueSignals.map((signal) => signal.ticker)).size,
      minDate: dates[0] || "",
      maxDate: dates.at(-1) || "",
      lastMessageDateTime,
    },
  };
}

function parseSignalMessage(message: TelegramMessage): SignalEvent[] {
  if (message.type !== "message" || !message.date) return [];
  const text = getMessageText(message).trim();
  const signalStart = text.search(SIGNAL_START);
  if (signalStart < 0) return [];

  const signalText = text.slice(signalStart).trim();
  const rowMatches = Array.from(signalText.matchAll(SIGNAL_ROW));
  if (!rowMatches.length) return [];

  const datePart = message.date.slice(0, 10);
  const messageTime = message.date.slice(11, 19) || "00:00:00";
  const messageDate = message.date;
  const header = signalText.slice(0, rowMatches[0].index).trim();
  const embeddedTime = header.match(SIGNAL_TIME)?.[1] || "";
  const rawSignalName = header.replace(/^Signal\s+/i, "").replace(SIGNAL_TIME, " ").trim();
  const signalTime = embeddedTime || messageTime;
  const signalName = cleanSignalName(rawSignalName);
  const category = classifyCategory(signalName);
  const minutes = timeToMinutes(signalTime);
  const signalDateTime = `${datePart}T${signalTime}`;

  return rowMatches.map((match) => {
    const ticker = (match[1] || "").toUpperCase();
    const starred = Boolean(match[2]);
    const hasPrice = Boolean(match[3]);
    const price = hasPrice ? parseNumber(match[3]) : 0;
    const score = parseNumber(match[4]);
    const total = parseNumber(match[5]);
    const tags = classifyTags(signalName, starred);
    const duplicateKey = [
      datePart,
      signalTime,
      ticker,
      signalName.toUpperCase(),
      hasPrice ? price : "NO_PRICE",
      score,
    ].join("|");

    return {
      id: message.id,
      tradeDate: datePart,
      messageDate,
      messageTime,
      signalDateTime,
      signalTime,
      embeddedTime: Boolean(embeddedTime),
      signalName,
      rawSignalName,
      category,
      tags,
      ticker,
      price,
      hasPrice,
      score,
      total,
      starred,
      session: classifySession(minutes),
      minutes,
      rawText: text,
      sourceFrom: message.from || "-",
      reactionCount: sumReactions(message),
      duplicateKey,
      duplicateCount: 1,
      rawMessageIds: [message.id],
    };
  });
}

export function dedupeSignals(signals: SignalEvent[]): SignalEvent[] {
  const map = new Map<string, SignalEvent>();

  for (const signal of signals) {
    const existing = map.get(signal.duplicateKey);
    if (!existing) {
      map.set(signal.duplicateKey, { ...signal, tags: [...signal.tags], rawMessageIds: [...signal.rawMessageIds] });
      continue;
    }

    existing.duplicateCount += 1;
    existing.rawMessageIds.push(signal.id);
    existing.reactionCount += signal.reactionCount;
    if (signal.messageDate < existing.messageDate) {
      existing.messageDate = signal.messageDate;
      existing.messageTime = signal.messageTime;
    }
    if (signal.total > existing.total) {
      existing.total = signal.total;
    }
  }

  return Array.from(map.values()).sort(compareSignals);
}

export function buildTickerStats(signals: SignalEvent[]): TickerStat[] {
  const map = new Map<string, SignalEvent[]>();
  signals.forEach((signal) => {
    const list = map.get(signal.ticker) || [];
    list.push(signal);
    map.set(signal.ticker, list);
  });

  return Array.from(map.entries())
    .map(([ticker, tickerSignals]) => {
      const sorted = [...tickerSignals].sort(compareSignals);
      const firstSignal = sorted[0];
      const lastSignal = sorted.at(-1) || firstSignal;
      const signalNames = unique(sorted.map((signal) => signal.signalName));
      const categories = unique(sorted.map((signal) => signal.category));
      const sessions = unique(sorted.map((signal) => signal.session));
      const scoreSum = sum(sorted.map((signal) => signal.score));
      const maxTotal = Math.max(...sorted.map((signal) => signal.total));
      const avgTotal = sum(sorted.map((signal) => signal.total)) / sorted.length;
      const rawCount = sum(sorted.map((signal) => signal.duplicateCount));
      const starredCount = sorted.filter((signal) => signal.starred).length;
      const reactionCount = sum(sorted.map((signal) => signal.reactionCount));
      const pricedSignals = sorted.filter(hasSignalPrice);
      const firstPriceSignal = pricedSignals[0];
      const lastPriceSignal = pricedSignals.at(-1);
      const firstPrice = firstPriceSignal?.price || 0;
      const lastPrice = lastPriceSignal?.price || 0;
      const priceChangePct = firstPrice && lastPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
      const hasEarly = sorted.some((signal) => signal.tags.includes("EARLY") || signal.minutes <= 570);
      const hasPro = sorted.some((signal) => signal.tags.includes("PRO"));
      const smartOrMomentum = categories.filter((category) =>
        ["Smart Money", "Momentum", "Closing"].includes(category),
      ).length;
      const conviction =
        scoreSum * 1.25 +
        maxTotal * 1.55 +
        signalNames.length * 2.2 +
        categories.length * 2.6 +
        Math.log(rawCount + 1) * 2.8 +
        smartOrMomentum * 2.4 +
        (hasEarly ? 3.5 : 0) +
        (hasPro ? 2.5 : 0) +
        starredCount * 0.4;

      return {
        ticker,
        eventCount: sorted.length,
        rawCount,
        scoreSum,
        maxTotal,
        avgTotal,
        firstSignal,
        lastSignal,
        firstPrice,
        lastPrice,
        pricedEventCount: pricedSignals.length,
        priceChangePct,
        signalNames,
        categories,
        sessions,
        starredCount,
        reactionCount,
        conviction: Number(conviction.toFixed(1)),
      };
    })
    .sort((a, b) => b.conviction - a.conviction || b.maxTotal - a.maxTotal || a.ticker.localeCompare(b.ticker));
}

export function groupSignals(signals: SignalEvent[], selector: (signal: SignalEvent) => string): GroupStat[] {
  const map = new Map<string, SignalEvent[]>();
  signals.forEach((signal) => {
    const key = selector(signal);
    const list = map.get(key) || [];
    list.push(signal);
    map.set(key, list);
  });

  return Array.from(map.entries())
    .map(([key, items]) => ({
      key,
      count: items.length,
      rawCount: sum(items.map((item) => item.duplicateCount)),
      scoreSum: sum(items.map((item) => item.score)),
      maxTotal: Math.max(...items.map((item) => item.total)),
    }))
    .sort((a, b) => b.count - a.count || b.scoreSum - a.scoreSum || a.key.localeCompare(b.key));
}

export function buildTimeBuckets(signals: SignalEvent[]): GroupStat[] {
  return groupSignals(signals, (signal) => {
    const hour = Math.floor(signal.minutes / 60);
    const minute = signal.minutes % 60 < 30 ? "00" : "30";
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }).sort((a, b) => a.key.localeCompare(b.key));
}

export function buildSignalEdges(
  entrySignals: SignalEvent[],
  movementThresholdPct = 2,
  priceUniverseSignals = entrySignals,
): SignalEdge[] {
  const byTicker = new Map<string, SignalEvent[]>();
  priceUniverseSignals
    .filter(hasSignalPrice)
    .forEach((signal) => {
      const list = byTicker.get(signal.ticker) || [];
      list.push(signal);
      byTicker.set(signal.ticker, list);
    });

  const samplesBySignal = new Map<string, SignalEdgeSample[]>();

  entrySignals.filter(hasSignalPrice).forEach((signal) => {
    const sorted = [...(byTicker.get(signal.ticker) || [])].sort(compareSignals);
    const future = sorted.filter((candidate) => compareSignals(candidate, signal) > 0);
    if (!future.length) return;

    const latest = future[future.length - 1];
    const futureReturns = future.map((candidate) => ((candidate.price - signal.price) / signal.price) * 100);
    const maxRunupPct = Math.max(...futureReturns);
    const maxDrawdownPct = Math.min(...futureReturns);
    const finalReturnPct = ((latest.price - signal.price) / signal.price) * 100;
    const absMovePct = Math.max(Math.abs(maxRunupPct), Math.abs(maxDrawdownPct), Math.abs(finalReturnPct));
    const list = samplesBySignal.get(signal.signalName) || [];
    list.push({ signal, latestSignal: latest, finalReturnPct, maxRunupPct, maxDrawdownPct, absMovePct });
    samplesBySignal.set(signal.signalName, list);
  });

  return Array.from(samplesBySignal.entries())
    .map(([signalName, samples]) => {
      const tickerSamples = collapseSamplesByTicker(samples);
      const sampleCount = tickerSamples.length;
      const rawCount = sum(samples.map((sample) => sample.signal.duplicateCount));
      const moveCount = tickerSamples.filter((sample) => sample.absMovePct >= movementThresholdPct).length;
      const upCount = tickerSamples.filter((sample) => sample.maxRunupPct >= movementThresholdPct).length;
      const downCount = tickerSamples.filter((sample) => sample.maxDrawdownPct <= -movementThresholdPct).length;
      const best = tickerSamples.reduce((top, sample) => (sample.maxRunupPct > top.maxRunupPct ? sample : top), tickerSamples[0]);
      const moveRate = (moveCount / sampleCount) * 100;
      const upRate = (upCount / sampleCount) * 100;
      const downRate = (downCount / sampleCount) * 100;
      const avgForwardReturnPct = average(tickerSamples.map((sample) => sample.finalReturnPct));
      const avgMaxRunupPct = average(tickerSamples.map((sample) => sample.maxRunupPct));
      const avgMaxDrawdownPct = average(tickerSamples.map((sample) => sample.maxDrawdownPct));
      const avgAbsMovePct = average(tickerSamples.map((sample) => sample.absMovePct));
      const sampleWeight = Math.min(1, Math.log(sampleCount + 1) / Math.log(28));
      const edgeScore =
        moveRate * 0.34 +
        upRate * 0.3 +
        Math.max(0, avgForwardReturnPct) * 2.1 +
        Math.max(0, avgMaxRunupPct) * 1.6 +
        avgAbsMovePct * 0.8 +
        sampleWeight * 12 -
        Math.max(0, -avgForwardReturnPct) * 1.2;

      return {
        signalName,
        category: tickerSamples[0].signal.category,
        sampleCount,
        rawCount,
        moveRate,
        upRate,
        downRate,
        avgForwardReturnPct,
        avgMaxRunupPct,
        avgMaxDrawdownPct,
        avgAbsMovePct,
        bestTicker: best.signal.ticker,
        bestMovePct: best.maxRunupPct,
        edgeScore,
        samples: tickerSamples.sort((a, b) => b.absMovePct - a.absMovePct || a.signal.signalDateTime.localeCompare(b.signal.signalDateTime)),
      };
    })
    .sort((a, b) => b.edgeScore - a.edgeScore || b.sampleCount - a.sampleCount || a.signalName.localeCompare(b.signalName));
}

function collapseSamplesByTicker(samples: SignalEdgeSample[]): SignalEdgeSample[] {
  const byTicker = new Map<string, SignalEdgeSample>();
  [...samples]
    .sort((a, b) => compareSignals(a.signal, b.signal))
    .forEach((sample) => {
      if (!byTicker.has(sample.signal.ticker)) {
        byTicker.set(sample.signal.ticker, sample);
      }
    });

  return Array.from(byTicker.values());
}

export function getMessageText(message: TelegramMessage): string {
  if (typeof message.text === "string") return message.text;
  if (!Array.isArray(message.text)) return "";
  return message.text
    .map((part) => (typeof part === "string" ? part : part.text || ""))
    .join("");
}

export function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ");
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

export function hasSignalPrice(signal: SignalEvent): boolean {
  return signal.hasPrice && Number.isFinite(signal.price) && signal.price > 0;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function allCategories(): SignalCategory[] {
  return ["Smart Money", "Momentum", "Closing", "Trend", "Selection", "TBSM", "Aura", "Other"];
}

export function allSessions(): TradingSession[] {
  return ["Opening", "Sesi 1", "Lunch", "Sesi 2", "Closing", "After Market"];
}

function cleanSignalName(raw: string): string {
  const withoutEmojiArtifacts = raw
    .replace(/ðŸ\S*/g, " ")
    .replace(/â\S*/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .replace(/[^\p{L}\p{N}\s&/+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutEmojiArtifacts || raw.replace(/\s+/g, " ").trim() || "UNKNOWN SIGNAL";
}

function classifyCategory(signalName: string): SignalCategory {
  const name = signalName.toUpperCase();
  if (name.includes("SMART MONEY")) return "Smart Money";
  if (name.includes("MOMENTUM") || name.includes("BURST") || name.includes("SWING")) return "Momentum";
  if (name.includes("CLOSING")) return "Closing";
  if (name.includes("TREND")) return "Trend";
  if (name.includes("SSE") || name.includes("SELECTION")) return "Selection";
  if (name.includes("TBSM")) return "TBSM";
  if (name.includes("AURA")) return "Aura";
  return "Other";
}

function classifyTags(signalName: string, starred: boolean): string[] {
  const name = signalName.toUpperCase();
  const tags: string[] = [];
  ["PRO", "EARLY", "BREAKOUT", "SWING", "LIQUID", "FRESH", "KING", "FLOW"].forEach((tag) => {
    if (name.includes(tag)) tags.push(tag);
  });
  if (starred) tags.push("STAR");
  return tags;
}

function classifySession(minutes: number): TradingSession {
  if (minutes < 570) return "Opening";
  if (minutes < 720) return "Sesi 1";
  if (minutes < 810) return "Lunch";
  if (minutes < 900) return "Sesi 2";
  if (minutes < 970) return "Closing";
  return "After Market";
}

function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function parseNumber(value = "0"): number {
  return Number(value.replace(",", ".").replace(/[^\d.+-]/g, "")) || 0;
}

function sumReactions(message: TelegramMessage): number {
  if (!Array.isArray(message.reactions)) return 0;
  return sum(message.reactions.map((reaction) => Number(reaction.count || 0)));
}

function compareSignals(a: SignalEvent, b: SignalEvent): number {
  return a.signalDateTime.localeCompare(b.signalDateTime) || a.ticker.localeCompare(b.ticker) || a.id - b.id;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function sum(items: number[]): number {
  return items.reduce((total, value) => total + value, 0);
}

function average(items: number[]): number {
  return items.length ? sum(items) / items.length : 0;
}
