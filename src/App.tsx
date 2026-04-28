import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  Flame,
  Layers3,
  LineChart,
  Maximize2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  SignalCategory,
  SignalEdge,
  SignalEdgeSample,
  SignalEvent,
  TickerStat,
  TradingSession,
  allCategories,
  allSessions,
  buildSignalEdges,
  buildTickerStats,
  buildTimeBuckets,
  formatCompact,
  formatDateTime,
  formatPct,
  formatPrice,
  groupSignals,
  hasSignalPrice,
  parseTelegramExport,
  TelegramExport,
} from "./signals";

type SortMode = "conviction" | "signals" | "total" | "first";
type EdgeSortMode = "edge" | "samples" | "move" | "up" | "return" | "runup" | "drawdown";

const DATA_URL = `${import.meta.env.BASE_URL}data/result.json`;

export default function App() {
  const [dataset, setDataset] = useState<ReturnType<typeof parseTelegramExport> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SignalCategory | "all">("all");
  const [session, setSession] = useState<TradingSession | "all">("all");
  const [minTotal, setMinTotal] = useState(0);
  const [movementThreshold, setMovementThreshold] = useState(2);
  const [minEdgeSamples, setMinEdgeSamples] = useState(1);
  const [edgeSortMode, setEdgeSortMode] = useState<EdgeSortMode>("edge");
  const [sortMode, setSortMode] = useState<SortMode>("conviction");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEdgeName, setSelectedEdgeName] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(DATA_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Data tidak terbaca (${response.status})`);
        return response.json() as Promise<TelegramExport>;
      })
      .then((json) => {
        if (!active) return;
        const parsed = parseTelegramExport(json);
        setDataset(parsed);
        setDateFrom(parsed.summary.minDate);
        setDateTo(parsed.summary.maxDate);
        setError("");
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message || "Gagal membaca result.json");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const baseSignals = useMemo(() => {
    if (!dataset) return [];
    return dedupe ? dataset.uniqueSignals : dataset.rawSignals;
  }, [dataset, dedupe]);

  const dateScopedSignals = useMemo(() => {
    return baseSignals.filter((signal) => (!dateFrom || signal.tradeDate >= dateFrom) && (!dateTo || signal.tradeDate <= dateTo));
  }, [baseSignals, dateFrom, dateTo]);

  const filteredSignals = useMemo(() => {
    const term = query.trim().toUpperCase();
    return dateScopedSignals.filter((signal) => {
      const matchesTerm =
        !term ||
        signal.ticker.includes(term) ||
        signal.signalName.toUpperCase().includes(term) ||
        signal.category.toUpperCase().includes(term);
      const matchesCategory = category === "all" || signal.category === category;
      const matchesSession = session === "all" || signal.session === session;
      const matchesTotal = signal.total >= minTotal;
      return matchesTerm && matchesCategory && matchesSession && matchesTotal;
    });
  }, [category, dateScopedSignals, minTotal, query, session]);

  const tickerStats = useMemo(() => buildTickerStats(filteredSignals), [filteredSignals]);

  const selectedStat = useMemo(() => {
    if (!selectedTicker) return tickerStats[0];
    return tickerStats.find((stat) => stat.ticker === selectedTicker) || tickerStats[0];
  }, [selectedTicker, tickerStats]);

  const selectedSignals = useMemo(() => {
    if (!selectedStat) return [];
    return filteredSignals.filter((signal) => signal.ticker === selectedStat.ticker);
  }, [filteredSignals, selectedStat]);

  const sortedTickerStats = useMemo(() => {
    return [...tickerStats].sort((a, b) => {
      if (sortMode === "signals") return b.eventCount - a.eventCount || b.conviction - a.conviction;
      if (sortMode === "total") return b.maxTotal - a.maxTotal || b.conviction - a.conviction;
      if (sortMode === "first") return a.firstSignal.signalDateTime.localeCompare(b.firstSignal.signalDateTime);
      return b.conviction - a.conviction || b.maxTotal - a.maxTotal;
    });
  }, [sortMode, tickerStats]);

  const signalMix = useMemo(() => groupSignals(filteredSignals, (signal) => signal.signalName).slice(0, 10), [
    filteredSignals,
  ]);
  const signalEdges = useMemo(() => buildSignalEdges(filteredSignals, movementThreshold, dateScopedSignals), [
    dateScopedSignals,
    filteredSignals,
    movementThreshold,
  ]);
  const visibleSignalEdges = useMemo(() => {
    const filtered = signalEdges.filter((edge) => edge.sampleCount >= minEdgeSamples);
    return [...filtered].sort((a, b) => {
      if (edgeSortMode === "samples") return b.sampleCount - a.sampleCount || b.edgeScore - a.edgeScore;
      if (edgeSortMode === "move") return b.moveRate - a.moveRate || b.sampleCount - a.sampleCount;
      if (edgeSortMode === "up") return b.upRate - a.upRate || b.sampleCount - a.sampleCount;
      if (edgeSortMode === "return") return b.avgForwardReturnPct - a.avgForwardReturnPct || b.sampleCount - a.sampleCount;
      if (edgeSortMode === "runup") return b.avgMaxRunupPct - a.avgMaxRunupPct || b.sampleCount - a.sampleCount;
      if (edgeSortMode === "drawdown") return b.avgMaxDrawdownPct - a.avgMaxDrawdownPct || b.sampleCount - a.sampleCount;
      return b.edgeScore - a.edgeScore || b.sampleCount - a.sampleCount;
    });
  }, [edgeSortMode, minEdgeSamples, signalEdges]);
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeName) return null;
    return visibleSignalEdges.find((edge) => edge.signalName === selectedEdgeName) || signalEdges.find((edge) => edge.signalName === selectedEdgeName) || null;
  }, [selectedEdgeName, signalEdges, visibleSignalEdges]);

  const categoryMix = useMemo(() => groupSignals(filteredSignals, (signal) => signal.category), [filteredSignals]);
  const timeBuckets = useMemo(() => buildTimeBuckets(filteredSignals), [filteredSignals]);
  const dayStats = useMemo(() => groupSignals(filteredSignals, (signal) => signal.tradeDate), [filteredSignals]);
  const tickerOptions = useMemo(() => buildTickerStats(baseSignals).map((stat) => stat.ticker), [baseSignals]);

  const topTicker = sortedTickerStats[0];
  const multiSignalCount = tickerStats.filter((ticker) => ticker.categories.length >= 3 || ticker.signalNames.length >= 4).length;
  const rawVisibleCount = filteredSignals.reduce((total, signal) => total + signal.duplicateCount, 0);
  const avgSignalsPerTicker = tickerStats.length ? filteredSignals.length / tickerStats.length : 0;

  useEffect(() => {
    const hasModal = detailOpen || Boolean(selectedEdgeName) || guideOpen;
    if (!hasModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDetailOpen(false);
      setSelectedEdgeName("");
      setGuideOpen(false);
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailOpen, selectedEdgeName, guideOpen]);

  function pickTicker(ticker: string, openCard = true) {
    setSelectedTicker(ticker);
    if (openCard) setDetailOpen(true);
  }

  function resetFilters() {
    if (!dataset) return;
    setDateFrom(dataset.summary.minDate);
    setDateTo(dataset.summary.maxDate);
    setQuery("");
    setCategory("all");
    setSession("all");
    setMinTotal(0);
    setSelectedTicker("");
    setDetailOpen(false);
    setSelectedEdgeName("");
    setSortMode("conviction");
  }

  function exportCsv() {
    const header = ["date", "time", "ticker", "signal", "category", "price", "score", "total", "session", "raw_count"];
    const rows = filteredSignals.map((signal) => [
      signal.tradeDate,
      signal.signalTime,
      signal.ticker,
      signal.signalName,
      signal.category,
      signal.hasPrice ? String(signal.price) : "",
      String(signal.score),
      String(signal.total),
      signal.session,
      String(signal.duplicateCount),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `om-botak-signals-${dateFrom || "all"}-${dateTo || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="screen center-state">
        <div className="loader" />
        <p>Membaca signal market...</p>
      </main>
    );
  }

  if (error || !dataset) {
    return (
      <main className="screen center-state">
        <Zap size={34} />
        <h1>Data belum siap</h1>
        <p>{error || "Pastikan file public/data/result.json tersedia."}</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="hero-band">
        <div>
          <div className="eyebrow">
            <Activity size={16} />
            Live Signal Intelligence
          </div>
          <h1>Om Botak Signal Radar</h1>
          <p>
            {dataset.summary.chatName} · update terakhir {formatDateTime(dataset.summary.lastMessageDateTime)}
          </p>
        </div>
        <div className="hero-actions">
          <button className="icon-button" onClick={() => window.location.reload()} aria-label="Muat ulang data" title="Muat ulang data">
            <RefreshCw size={18} />
          </button>
          <button className="secondary-button" onClick={() => setGuideOpen(true)}>
            <BookOpen size={17} />
            Guide
          </button>
          <button className="primary-button" onClick={exportCsv}>
            <Download size={17} />
            CSV
          </button>
        </div>
      </section>

      <section className="toolbar" aria-label="Filter dashboard">
        <div className="field date-field">
          <CalendarDays size={17} />
          <input type="date" value={dateFrom} min={dataset.summary.minDate} max={dataset.summary.maxDate} onChange={(event) => setDateFrom(event.target.value)} />
          <span className="dash">to</span>
          <input type="date" value={dateTo} min={dataset.summary.minDate} max={dataset.summary.maxDate} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <label className="field search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} list="ticker-list" placeholder="Ticker / signal" />
          <datalist id="ticker-list">
            {tickerOptions.map((ticker) => (
              <option value={ticker} key={ticker} />
            ))}
          </datalist>
        </label>
        <FilterSelect
          icon={<SlidersHorizontal size={17} />}
          value={category}
          options={[
            { value: "all", label: "Semua kategori" },
            ...allCategories().map((item) => ({ value: item, label: item })),
          ]}
          onChange={(value) => setCategory(value as SignalCategory | "all")}
        />
        <FilterSelect
          icon={<Clock3 size={17} />}
          value={session}
          options={[
            { value: "all", label: "Semua sesi" },
            ...allSessions().map((item) => ({ value: item, label: item })),
          ]}
          onChange={(value) => setSession(value as TradingSession | "all")}
        />
        <label className="field compact-field">
          <Target size={17} />
          <input type="number" min="0" step="1" value={minTotal} onChange={(event) => setMinTotal(Number(event.target.value))} />
        </label>
        <label className="switch-control">
          <input type="checkbox" checked={dedupe} onChange={(event) => setDedupe(event.target.checked)} />
          <span>Dedupe</span>
        </label>
        <button className="icon-button" onClick={resetFilters} aria-label="Reset filter" title="Reset filter">
          <X size={18} />
        </button>
      </section>

      <section className="metric-grid">
        <MetricCard icon={<Zap />} label="Signal tampil" value={formatCompact(filteredSignals.length)} detail={`${formatCompact(rawVisibleCount)} raw event`} tone="lime" />
        <MetricCard icon={<Layers3 />} label="Ticker aktif" value={formatCompact(tickerStats.length)} detail={`${avgSignalsPerTicker.toFixed(1)} signal/ticker`} tone="cyan" />
        <MetricCard icon={<Flame />} label="Top radar" value={topTicker?.ticker || "-"} detail={topTicker ? `conviction ${topTicker.conviction}` : "-"} tone="amber" />
        <MetricCard icon={<Sparkles />} label="Confluence" value={formatCompact(multiSignalCount)} detail="multi setup terdeteksi" tone="rose" />
      </section>

      <section className="dashboard-grid">
        <div className="panel span-7">
          <PanelHeader icon={<TrendingUp />} title="Top Saham by Signal" aside={<SortTabs value={sortMode} onChange={setSortMode} />} />
          <div className="ticker-list">
            {sortedTickerStats.slice(0, 18).map((stat, index) => (
              <TickerRow
                key={stat.ticker}
                stat={stat}
                rank={index + 1}
                selected={selectedStat?.ticker === stat.ticker}
                maxConviction={sortedTickerStats[0]?.conviction || 1}
                onClick={() => pickTicker(stat.ticker, false)}
              />
            ))}
          </div>
        </div>

        <div className="panel span-5">
          <PanelHeader
            icon={<LineChart />}
            title={selectedStat ? `${selectedStat.ticker} Signal Card` : "Signal Card"}
            aside={
              selectedStat ? (
                <button className="mini-action" onClick={() => setDetailOpen(true)}>
                  <Maximize2 size={15} />
                  Pop out
                </button>
              ) : null
            }
          />
          {selectedStat ? <TickerDetail stat={selectedStat} signals={selectedSignals} /> : <EmptyState text="Belum ada ticker dalam filter." />}
        </div>

        <div className="panel span-8">
          <PanelHeader icon={<BarChart3 />} title="Intraday Signal Flow" aside={<span className="panel-note">{filteredSignals.length} event</span>} />
          <TimeBuckets buckets={timeBuckets} />
        </div>

        <div className="panel span-4">
          <PanelHeader icon={<Target />} title="Signal Mix" />
          <BarList stats={signalMix} />
        </div>

        <div className="panel span-12">
          <PanelHeader
            icon={<Target />}
            title="Signal Edge Analyzer"
            aside={
              <div className="edge-controls">
                <FilterSelect
                  icon={<SlidersHorizontal size={16} />}
                  value={edgeSortMode}
                  options={[
                    { value: "edge", label: "Edge terbaik" },
                    { value: "samples", label: "Sample terbanyak" },
                    { value: "move", label: "Move rate" },
                    { value: "up", label: "Follow-up naik" },
                    { value: "return", label: "Avg return" },
                    { value: "runup", label: "Avg run-up" },
                    { value: "drawdown", label: "Drawdown rendah" },
                  ]}
                  onChange={(value) => setEdgeSortMode(value as EdgeSortMode)}
                />
                <label className="threshold-control">
                  Min sample
                  <input
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    value={minEdgeSamples}
                    onChange={(event) => setMinEdgeSamples(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="threshold-control">
                  Gerak &gt;=
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={movementThreshold}
                    onChange={(event) => setMovementThreshold(Number(event.target.value) || 0)}
                  />
                  %
                </label>
              </div>
            }
          />
          <SignalEdgePanel edges={visibleSignalEdges} onPickTicker={pickTicker} onOpenSamples={setSelectedEdgeName} />
        </div>

        <div className="panel span-4">
          <PanelHeader icon={<CalendarDays />} title="Daily Pulse" />
          <BarList stats={dayStats} compact />
        </div>

        <div className="panel span-4">
          <PanelHeader icon={<Sparkles />} title="Kategori Setup" />
          <CategoryPills stats={categoryMix} />
        </div>

        <div className="panel span-4">
          <PanelHeader icon={<Star />} title="Trader Radar" />
          <RadarIdeas stats={tickerStats} onPick={pickTicker} />
        </div>

        <div className="panel span-12">
          <PanelHeader icon={<LineChart />} title="Price Movement Board" aside={<span className="panel-note">berdasarkan harga signal</span>} />
          <PriceMovers stats={tickerStats} onPick={pickTicker} />
        </div>

        <div className="panel span-12">
          <PanelHeader icon={<Activity />} title="Signal Tape" aside={<span className="panel-note">urut jam signal</span>} />
          <SignalTable signals={filteredSignals.slice(0, 350)} onPick={pickTicker} />
        </div>
      </section>

      {detailOpen && selectedStat ? (
        <TickerPopout stat={selectedStat} signals={selectedSignals} onClose={() => setDetailOpen(false)} />
      ) : null}
      {selectedEdge ? (
        <EdgeSamplesPopout
          edge={selectedEdge}
          threshold={movementThreshold}
          onClose={() => setSelectedEdgeName("")}
          onPickTicker={(ticker) => {
            setSelectedEdgeName("");
            pickTicker(ticker);
          }}
        />
      ) : null}
      {guideOpen ? <GuidePopout onClose={() => setGuideOpen(false)} /> : null}
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "lime" | "cyan" | "amber" | "rose";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function PanelHeader({ icon, title, aside }: { icon: ReactNode; title: string; aside?: ReactNode }) {
  return (
    <div className="panel-header">
      <h2>
        {icon}
        {title}
      </h2>
      {aside}
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  options,
  onChange,
}: {
  icon: ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="field custom-select" ref={ref}>
      <button className="select-trigger" type="button" onClick={() => setOpen((current) => !current)}>
        {icon}
        <span className="select-value">{selected?.label}</span>
        <ChevronDown size={16} className={open ? "select-chevron open" : "select-chevron"} />
      </button>
      {open ? (
        <div className="select-menu">
          {options.map((option) => (
            <button
              className={option.value === value ? "select-option active" : "select-option"}
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <Check size={15} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortTabs({ value, onChange }: { value: SortMode; onChange: (value: SortMode) => void }) {
  const options: Array<{ value: SortMode; label: string }> = [
    { value: "conviction", label: "Radar" },
    { value: "signals", label: "Signal" },
    { value: "total", label: "Total" },
    { value: "first", label: "Early" },
  ];
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TickerRow({
  stat,
  rank,
  selected,
  maxConviction,
  onClick,
}: {
  stat: TickerStat;
  rank: number;
  selected: boolean;
  maxConviction: number;
  onClick: () => void;
}) {
  const width = Math.max(8, (stat.conviction / maxConviction) * 100);
  return (
    <button className={`ticker-row ${selected ? "selected" : ""}`} onClick={onClick}>
      <span className="rank">{String(rank).padStart(2, "0")}</span>
      <span className="ticker-main">
        <strong>{stat.ticker}</strong>
        <small>
          {stat.eventCount} signal · {stat.categories.slice(0, 3).join(", ")}
        </small>
      </span>
      <span className="ticker-metrics">
        <b>{stat.maxTotal.toFixed(1)}</b>
        <small>{stat.firstSignal.signalTime}</small>
      </span>
      <span className="confidence-track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
      <ChevronRight size={16} />
    </button>
  );
}

function TickerDetail({ stat, signals }: { stat: TickerStat; signals: SignalEvent[] }) {
  const sortedSignals = useMemo(() => [...signals].sort((a, b) => a.signalDateTime.localeCompare(b.signalDateTime)), [signals]);
  const signalGroups = useMemo(() => groupSignalEventsByDate(sortedSignals), [sortedSignals]);
  const latestDate = signalGroups[0]?.date || "";
  const [openDates, setOpenDates] = useState<Set<string>>(() => new Set(latestDate ? [latestDate] : []));

  useEffect(() => {
    setOpenDates(new Set(latestDate ? [latestDate] : []));
  }, [latestDate, stat.ticker]);

  const toggleDate = (date: string) => {
    setOpenDates((current) => {
      const next = new Set(current);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  return (
    <div className="ticker-detail">
      <div className="detail-head">
        <div>
          <span className="detail-label">Conviction</span>
          <strong>{stat.conviction}</strong>
        </div>
        <div>
          <span className="detail-label">Total max</span>
          <strong>{stat.maxTotal.toFixed(1)}</strong>
        </div>
        <div>
          <span className="detail-label">Snapshot</span>
          <strong className={stat.priceChangePct >= 0 ? "positive" : "negative"}>{stat.pricedEventCount ? formatPct(stat.priceChangePct) : "-"}</strong>
        </div>
      </div>
      <PriceTrendChart stat={stat} signals={sortedSignals} />
      <div className="tag-cloud">
        {stat.categories.map((item) => (
          <span key={item}>{item}</span>
        ))}
        {stat.signalNames.slice(0, 4).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="event-stack">
        {signalGroups.map((group) => (
          <section className="signal-day-group" key={group.date}>
            <button className="signal-day-toggle" type="button" onClick={() => toggleDate(group.date)} aria-expanded={openDates.has(group.date)}>
              <span>
                <strong>{formatTradeDate(group.date)}</strong>
                <small>
                  {group.signals.length} signal · {group.rawCount} raw · {group.firstTime}-{group.lastTime}
                </small>
              </span>
              <ChevronDown className={openDates.has(group.date) ? "chevron-open" : ""} size={17} />
            </button>
            {openDates.has(group.date) ? (
              <div className="signal-day-events">
                {group.signals.map((signal) => (
                  <SignalEventCard signal={signal} key={`${signal.duplicateKey}-${signal.id}`} />
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

function SignalEventCard({ signal }: { signal: SignalEvent }) {
  return (
    <article className="event-card">
      <div className="event-time">
        <strong>{signal.signalTime}</strong>
        <small>{signal.session}</small>
      </div>
      <div className="event-body">
        <div>
          <strong>{signal.signalName}</strong>
          <span>{formatEventPrice(signal)}</span>
        </div>
        <p>
          +{signal.score} · Total {signal.total.toFixed(1)}
          {signal.duplicateCount > 1 ? ` · ${signal.duplicateCount}x raw` : ""}
        </p>
        {signal.tags.length > 0 ? (
          <div className="mini-tags">
            {signal.tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

interface SignalEventDateGroup {
  date: string;
  signals: SignalEvent[];
  rawCount: number;
  firstTime: string;
  lastTime: string;
}

const tradeDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function groupSignalEventsByDate(signals: SignalEvent[]): SignalEventDateGroup[] {
  const groups = new Map<string, SignalEvent[]>();
  signals.forEach((signal) => {
    const list = groups.get(signal.tradeDate) || [];
    list.push(signal);
    groups.set(signal.tradeDate, list);
  });

  return Array.from(groups.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, dateSignals]) => {
      const sorted = [...dateSignals].sort((a, b) => a.signalDateTime.localeCompare(b.signalDateTime));
      return {
        date,
        signals: sorted,
        rawCount: sorted.reduce((total, signal) => total + signal.duplicateCount, 0),
        firstTime: sorted[0]?.signalTime || "-",
        lastTime: sorted.at(-1)?.signalTime || "-",
      };
    });
}

function formatTradeDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value || "-";

  return tradeDateFormatter.format(new Date(year, month - 1, day));
}

function PriceTrendChart({ stat, signals }: { stat: TickerStat; signals: SignalEvent[] }) {
  const points = signals.filter(hasSignalPrice);
  const width = 640;
  const height = 172;
  const padX = 22;
  const padY = 18;
  const minPrice = points.length ? Math.min(...points.map((point) => point.price)) : 0;
  const maxPrice = points.length ? Math.max(...points.map((point) => point.price)) : 0;
  const span = maxPrice - minPrice || 1;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const tone = stat.priceChangePct >= 0 ? "up" : "down";
  const coords = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : padX + (index / (points.length - 1)) * usableW;
    const y = padY + (1 - (point.price - minPrice) / span) * usableH;
    return { x, y, point };
  });
  const line = coords.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = coords.length
    ? `${padX},${height - padY} ${line} ${width - padX},${height - padY}`
    : "";
  const first = points[0];
  const last = points.at(-1);
  const high = points.length ? points.reduce((top, point) => (point.price > top.price ? point : top), points[0]) : undefined;
  const low = points.length ? points.reduce((bottom, point) => (point.price < bottom.price ? point : bottom), points[0]) : undefined;

  return (
    <section className={`price-trend trend-${tone}`}>
      <div className="price-kpis">
        <div>
          <span>Awal</span>
          <strong>{stat.pricedEventCount ? formatPrice(stat.firstPrice) : "-"}</strong>
          <small>{first ? `${first.tradeDate} ${first.signalTime}` : "-"}</small>
        </div>
        <div>
          <span>Terbaru</span>
          <strong>{stat.pricedEventCount ? formatPrice(stat.lastPrice) : "-"}</strong>
          <small>{last ? `${last.tradeDate} ${last.signalTime}` : "-"}</small>
        </div>
        <div>
          <span>Perubahan</span>
          <strong className={stat.priceChangePct >= 0 ? "positive" : "negative"}>{stat.pricedEventCount ? formatPct(stat.priceChangePct) : "-"}</strong>
          <small>{stat.pricedEventCount} price snapshot dari {stat.eventCount} signal</small>
        </div>
      </div>
      <div className="price-chart-wrap">
        {points.length ? (
          <>
            <svg className="price-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Grafik harga ${stat.ticker}`}>
              <defs>
                <linearGradient id={`area-${stat.ticker}-${tone}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={tone === "up" ? "#8de46a" : "#ef6f83"} stopOpacity="0.42" />
                  <stop offset="100%" stopColor={tone === "up" ? "#8de46a" : "#ef6f83"} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line className="chart-grid" x1={padX} x2={width - padX} y1={padY} y2={padY} />
              <line className="chart-grid" x1={padX} x2={width - padX} y1={height / 2} y2={height / 2} />
              <line className="chart-grid" x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} />
              {area ? <polygon points={area} fill={`url(#area-${stat.ticker}-${tone})`} /> : null}
              {line ? <polyline points={line} className="chart-line" /> : null}
              {coords.map(({ x, y, point }, index) => (
                <circle
                  key={`${point.id}-${index}`}
                  className={index === 0 || index === coords.length - 1 ? "chart-dot main-dot" : "chart-dot"}
                  cx={x}
                  cy={y}
                  r={index === 0 || index === coords.length - 1 ? 4.8 : 2.6}
                />
              ))}
            </svg>
            <div className="price-range">
              <span>Low {formatPrice(low?.price || minPrice)}</span>
              <span>High {formatPrice(high?.price || maxPrice)}</span>
            </div>
          </>
        ) : (
          <div className="chart-empty">Signal ticker ini belum membawa harga snapshot.</div>
        )}
      </div>
    </section>
  );
}

function PriceMovers({ stats, onPick }: { stats: TickerStat[]; onPick: (ticker: string) => void }) {
  const movable = stats.filter((stat) => stat.pricedEventCount >= 2 && stat.firstPrice > 0);
  const gainers = [...movable].sort((a, b) => b.priceChangePct - a.priceChangePct).slice(0, 8);
  const losers = [...movable].sort((a, b) => a.priceChangePct - b.priceChangePct).slice(0, 8);
  const maxMove = Math.max(...movable.map((stat) => Math.abs(stat.priceChangePct)), 1);

  if (!movable.length) return <EmptyState text="Belum cukup price snapshot." />;

  return (
    <div className="price-mover-grid">
      <MoverColumn title="Top Naik" icon={<ArrowUpRight size={18} />} stats={gainers} maxMove={maxMove} onPick={onPick} />
      <MoverColumn title="Top Turun" icon={<ArrowDownRight size={18} />} stats={losers} maxMove={maxMove} onPick={onPick} />
    </div>
  );
}

function SignalEdgePanel({
  edges,
  onPickTicker,
  onOpenSamples,
}: {
  edges: SignalEdge[];
  onPickTicker: (ticker: string) => void;
  onOpenSamples: (signalName: string) => void;
}) {
  const topEdges = edges.slice(0, 12);
  const maxScore = Math.max(...topEdges.map((edge) => edge.edgeScore), 1);

  if (!topEdges.length) return <EmptyState text="Belum cukup data lanjutan untuk menghitung edge." />;

  return (
    <div className="edge-layout">
      <div className="edge-summary">
        {topEdges.slice(0, 3).map((edge, index) => (
          <button className="edge-card" key={edge.signalName} onClick={() => onOpenSamples(edge.signalName)}>
            <span className="rank">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{edge.signalName}</strong>
              <small>
                {edge.sampleCount} sample - {edge.category}
              </small>
            </div>
            <b>{edge.moveRate.toFixed(0)}%</b>
            <p>
              Follow-up naik {edge.upRate.toFixed(0)}% - avg return {formatPct(edge.avgForwardReturnPct)}
            </p>
          </button>
        ))}
      </div>
      <div className="edge-table-wrap">
        <table className="edge-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Sample</th>
              <th>Move Rate</th>
              <th>Naik</th>
              <th>Turun</th>
              <th>Avg Return</th>
              <th>Avg Run-up</th>
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {topEdges.map((edge) => (
              <tr key={edge.signalName}>
                <td>
                  <div className="edge-name">
                    <strong>{edge.signalName}</strong>
                    <small>{edge.category}</small>
                    <i>
                      <b style={{ width: `${Math.max(7, (edge.edgeScore / maxScore) * 100)}%` }} />
                    </i>
                  </div>
                </td>
                <td>
                  <button className="sample-button" onClick={() => onOpenSamples(edge.signalName)}>
                    {edge.sampleCount}
                  </button>
                </td>
                <td>{edge.moveRate.toFixed(0)}%</td>
                <td className="positive">{edge.upRate.toFixed(0)}%</td>
                <td className="negative">{edge.downRate.toFixed(0)}%</td>
                <td className={edge.avgForwardReturnPct >= 0 ? "positive" : "negative"}>
                  {formatPct(edge.avgForwardReturnPct)}
                </td>
                <td className={edge.avgMaxRunupPct >= 0 ? "positive" : "negative"}>{formatPct(edge.avgMaxRunupPct)}</td>
                <td>
                  <button className="ticker-link" onClick={() => onPickTicker(edge.bestTicker)}>
                    {edge.bestTicker}
                  </button>
                  <span className="best-move"> {formatPct(edge.bestMovePct)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EdgeSamplesPopout({
  edge,
  threshold,
  onClose,
  onPickTicker,
}: {
  edge: SignalEdge;
  threshold: number;
  onClose: () => void;
  onPickTicker: (ticker: string) => void;
}) {
  const movedSamples = edge.samples.filter((sample) => sample.absMovePct >= threshold).length;
  const upSamples = edge.samples.filter((sample) => sample.maxRunupPct >= threshold).length;
  const downSamples = edge.samples.filter((sample) => sample.maxDrawdownPct <= -threshold).length;

  return (
    <div className="popout-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="popout-card edge-popout-card" role="dialog" aria-modal="true" aria-label={`${edge.signalName} samples`}>
        <div className="popout-head">
          <div>
            <span className="detail-label">Sample Signal</span>
            <h2>{edge.signalName}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup sample signal" title="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="sample-kpis">
          <div>
            <span>Total sample</span>
            <strong>{edge.sampleCount}</strong>
            <small>{edge.category}</small>
          </div>
          <div>
            <span>Move rate</span>
            <strong>{edge.moveRate.toFixed(0)}%</strong>
            <small>{movedSamples} bergerak &gt;= {threshold}%</small>
          </div>
          <div>
            <span>Follow-up naik</span>
            <strong className="positive">{edge.upRate.toFixed(0)}%</strong>
            <small>{upSamples} sample naik</small>
          </div>
          <div>
            <span>Drawdown</span>
            <strong className="negative">{edge.downRate.toFixed(0)}%</strong>
            <small>{downSamples} sample turun</small>
          </div>
        </div>
        <SampleTable samples={edge.samples} threshold={threshold} onPickTicker={onPickTicker} />
      </section>
    </div>
  );
}

function GuidePopout({ onClose }: { onClose: () => void }) {
  return (
    <div className="popout-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="popout-card guide-popout-card" role="dialog" aria-modal="true" aria-label="Panduan dashboard">
        <div className="popout-head">
          <div>
            <span className="detail-label">Panduan</span>
            <h2>Cara Membaca Dashboard</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup guide" title="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="guide-grid">
          <GuideBlock
            title="Dasar Data"
            items={[
              ["Sumber data", "Semua angka dihitung dari file Telegram export result.json yang ada di public/data/result.json."],
              ["Harga", "Harga adalah harga yang muncul pada teks signal, bukan data OHLC resmi bursa. Jika signal tidak membawa harga, kolom harga tampil '-'."],
              ["Tanpa harga", "Signal tanpa harga tetap dihitung untuk jumlah signal, top saham, kategori, flow, dan tape, tetapi tidak dipakai untuk grafik harga, mover, atau edge return."],
              ["Rentang filter", "Mayoritas metrik mengikuti filter tanggal, kategori, sesi, ticker/search, min total, dan mode dedupe. Edge follow-up punya aturan khusus yang dijelaskan di bawah."],
              ["Raw event", "Jumlah pesan signal asli yang ada di chat sebelum pembersihan duplikat."],
            ]}
          />
          <GuideBlock
            title="Dedupe"
            items={[
              ["Arti", "Dedupe berarti menggabungkan signal yang sama agar tidak dihitung berkali-kali."],
              ["Kapan duplikat", "Signal dianggap sama jika tanggal, jam signal, ticker, nama signal, status harga, harga jika ada, dan score sama."],
              ["Dedupe aktif", "Cocok untuk analisa bersih. Replay signal dihitung satu kali sehingga top saham dan edge tidak bias karena spam/repost."],
              ["Dedupe mati", "Cocok untuk audit chat. Semua pesan asli dihitung, termasuk signal yang dikirim ulang."],
              ["Raw count", "Jika satu signal muncul 8 kali, mode dedupe menghitung 1 signal tetapi raw count tetap bisa menunjukkan 8 raw event."],
              ["Saran", "Untuk membaca edge, mover, dan top saham, gunakan Dedupe aktif agar statistik lebih stabil."],
            ]}
          />
          <GuideBlock
            title="Filter Global"
            items={[
              ["Tanggal", "Membatasi semua panel ke signal yang tanggalnya berada di rentang awal sampai akhir."],
              ["Ticker / signal", "Mencari ticker, nama signal, atau kategori. Contoh: CTTH, SMART MONEY, Momentum."],
              ["Kategori", "Membatasi signal berdasarkan kelompok setup seperti Smart Money, Momentum, Closing, Trend, dan lainnya."],
              ["Sesi", "Membatasi signal berdasarkan jam bursa: Opening, Sesi 1, Lunch, Sesi 2, Closing, atau After Market."],
              ["Min total", "Hanya menampilkan signal dengan nilai Total minimal sesuai angka yang kamu isi."],
            ]}
          />
          <GuideBlock
            title="Top Saham"
            items={[
              ["Signal tampil", "Jumlah signal dalam filter saat ini. Angka raw event menunjukkan jumlah pesan asli sebelum dedupe."],
              ["Ticker aktif", "Jumlah saham unik yang punya minimal satu signal dalam filter."],
              ["Top radar", "Saham dengan skor conviction tertinggi pada filter saat ini."],
              ["Conviction", "Skor gabungan dari jumlah signal, total score, variasi signal, kategori setup, signal awal, tag PRO, dan raw count."],
            ]}
          />
          <GuideBlock
            title="Ranking Top Saham"
            items={[
              ["Radar", "Urutan berdasarkan conviction tertinggi. Cocok untuk mencari saham yang paling ramai dan banyak confluence signal."],
              ["Signal", "Urutan berdasarkan jumlah signal terbanyak pada saham tersebut."],
              ["Total", "Urutan berdasarkan nilai Total tertinggi yang pernah muncul pada saham tersebut."],
              ["Early", "Urutan berdasarkan signal paling awal. Cocok untuk melihat saham yang muncul cepat di sesi awal."],
            ]}
          />
          <GuideBlock
            title="Signal Card"
            items={[
              ["Awal", "Harga pertama yang tersedia pada saham tersebut dalam filter."],
              ["Terbaru", "Harga terakhir yang tersedia pada saham tersebut dalam filter."],
              ["Perubahan", "Rumus: (harga terbaru - harga awal) / harga awal x 100%."],
              ["Grafik harga", "Garis hanya mengikuti signal yang membawa harga. Signal tanpa harga tetap muncul di daftar event."],
            ]}
          />
          <GuideBlock
            title="Price Movement Board"
            items={[
              ["Mover", "Saham yang harga signal pertamanya berubah cukup besar sampai harga signal terakhir dalam filter."],
              ["Top Naik", "Daftar saham dengan persentase kenaikan terbesar dari harga signal awal ke harga signal terbaru."],
              ["Top Turun", "Daftar saham dengan persentase penurunan terbesar dari harga signal awal ke harga signal terbaru."],
              ["Rumus", "Perubahan = (harga signal terbaru - harga signal awal) / harga signal awal x 100%."],
              ["Batasan", "Mover hanya membaca harga yang muncul di signal, bukan high-low harian dari market."],
            ]}
          />
          <GuideBlock
            title="Flow dan Mix"
            items={[
              ["Intraday Signal Flow", "Grafik batang jumlah signal berdasarkan bucket jam. Dipakai untuk melihat jam mana signal paling padat."],
              ["Signal Mix", "Ranking nama signal yang paling sering muncul dalam filter saat ini."],
              ["Daily Pulse", "Jumlah signal per tanggal. Dipakai untuk melihat hari mana paling ramai."],
              ["Kategori Setup", "Distribusi signal berdasarkan kategori setup. Membantu melihat market sedang dominan momentum, trend, smart money, atau lainnya."],
            ]}
          />
          <GuideBlock
            title="Signal Edge Analyzer"
            items={[
              ["Sample", "Jumlah kejadian signal yang punya harga entry dan masih punya harga lanjutan pada ticker yang sama setelah signal itu muncul."],
              ["Gerak >=", "Ambang minimum agar pergerakan dianggap signifikan. Default 2 berarti minimal 2%."],
              ["Move rate", "Persentase sample yang setelah signal keluar sempat bergerak naik atau turun minimal sebesar ambang."],
              ["Universe follow-up", "Entry signal mengikuti filter aktif, tetapi harga lanjutan memakai semua price snapshot dalam rentang tanggal agar tidak bias oleh filter kategori/search."],
              ["Naik", "Persentase sample yang setelah signal keluar sempat naik minimal sebesar ambang. Angka ini bisa overlap dengan Turun jika sample volatil dua arah."],
              ["Turun", "Persentase sample yang setelah signal keluar sempat turun minimal sebesar ambang. Angka ini bisa overlap dengan Naik jika sample volatil dua arah."],
            ]}
          />
          <GuideBlock
            title="Sort Edge Analyzer"
            items={[
              ["Edge terbaik", "Ranking gabungan dari move rate, follow-up naik, avg return, avg run-up, dan bobot sample."],
              ["Sample terbanyak", "Urutan signal berdasarkan jumlah sample terbesar. Cocok untuk mencari data yang lebih tebal."],
              ["Move rate", "Urutan signal yang paling sering membuat harga bergerak minimal sebesar ambang, tanpa melihat arah naik atau turun."],
              ["Follow-up naik", "Urutan signal yang paling sering diikuti kenaikan minimal sebesar ambang."],
              ["Avg return", "Rata-rata return dari harga entry signal ke harga latest berikutnya pada ticker yang sama."],
              ["Avg run-up", "Rata-rata kenaikan terbaik yang sempat terjadi setelah signal muncul."],
              ["Drawdown rendah", "Urutan yang memprioritaskan signal dengan rata-rata penurunan lebih kecil."],
            ]}
          />
          <GuideBlock
            title="Sample Pop-out"
            items={[
              ["Cara buka", "Klik angka Sample atau card top edge untuk melihat daftar saham pembentuk statistik signal itu."],
              ["Entry", "Harga ketika signal tersebut muncul pada ticker itu."],
              ["Latest", "Harga signal terakhir berikutnya pada ticker yang sama setelah entry signal."],
              ["Return", "Perubahan dari Entry ke Latest."],
              ["Run-up", "Kenaikan terbaik yang sempat terjadi setelah entry signal."],
              ["Drawdown", "Penurunan terdalam yang sempat terjadi setelah entry signal."],
              ["Status Volatil", "Artinya satu sample pernah menyentuh ambang naik dan ambang turun, sehingga peluang gerak ada tetapi risikonya juga besar."],
            ]}
          />
          <GuideBlock
            title="Trader Radar dan Tape"
            items={[
              ["Trader Radar", "Shortcut saham yang punya confluence, early flow, atau tanda starred. Dipakai untuk menemukan watchlist cepat."],
              ["Confluence", "Saham yang punya banyak variasi signal atau banyak kategori setup dalam filter."],
              ["Early flow", "Saham yang signalnya muncul awal, terutama sekitar opening."],
              ["Starred", "Saham yang signal mentahnya memiliki tanda bintang pada teks export."],
              ["Signal Tape", "Tabel kronologis semua signal dalam filter. Klik ticker untuk membuka card saham."],
            ]}
          />
          <GuideBlock
            title="Cara Pakai Praktis"
            items={[
              ["Langkah 1", "Set Min sample minimal 10 atau 20 agar signal dengan data terlalu sedikit tidak mendominasi."],
              ["Langkah 2", "Sort Edge terbaik, lalu cek Naik dan Turun. Signal bagus biasanya Naik tinggi dan Turun terkendali."],
              ["Langkah 3", "Klik angka Sample untuk melihat saham apa saja yang membentuk statistik signal tersebut."],
              ["Langkah 4", "Klik ticker dari sample untuk membuka card saham dan melihat urutan signal serta grafik harganya."],
              ["Batasan", "Ini analisa historis dari signal snapshot. Bukan jaminan signal berikutnya pasti bergerak sama."],
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function GuideBlock({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <article className="guide-block">
      <h3>{title}</h3>
      <dl>
        {items.map(([term, description]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function SampleTable({
  samples,
  threshold,
  onPickTicker,
}: {
  samples: SignalEdgeSample[];
  threshold: number;
  onPickTicker: (ticker: string) => void;
}) {
  return (
    <div className="sample-table-wrap">
      <table className="sample-table">
        <thead>
          <tr>
            <th>Saham</th>
            <th>Entry Signal</th>
            <th>Entry</th>
            <th>Latest</th>
            <th>Return</th>
            <th>Run-up</th>
            <th>Drawdown</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((sample) => {
            const moved = sample.absMovePct >= threshold;
            const hitUp = sample.maxRunupPct >= threshold;
            const hitDown = sample.maxDrawdownPct <= -threshold;
            const status = hitUp && hitDown ? "Volatil" : hitUp ? "Naik" : hitDown ? "Turun" : "Sideways";
            const statusTone = hitUp && hitDown ? "sample-volatile" : moved ? "sample-moved" : "";
            return (
              <tr key={`${sample.signal.duplicateKey}-${sample.latestSignal.id}`}>
                <td>
                  <button className="ticker-link" onClick={() => onPickTicker(sample.signal.ticker)}>
                    {sample.signal.ticker}
                  </button>
                </td>
                <td>
                  <span className="sample-signal-name">{sample.signal.signalName}</span>
                  <small>{sample.signal.tradeDate} {sample.signal.signalTime}</small>
                </td>
                <td>{formatEventPrice(sample.signal)}</td>
                <td>
                  {formatPrice(sample.latestSignal.price)}
                  <small>{sample.latestSignal.tradeDate} {sample.latestSignal.signalTime}</small>
                </td>
                <td className={sample.finalReturnPct >= 0 ? "positive" : "negative"}>{formatPct(sample.finalReturnPct)}</td>
                <td className={sample.maxRunupPct >= 0 ? "positive" : "negative"}>{formatPct(sample.maxRunupPct)}</td>
                <td className={sample.maxDrawdownPct >= 0 ? "positive" : "negative"}>{formatPct(sample.maxDrawdownPct)}</td>
                <td>
                  <span className={`sample-status ${statusTone}`}>{status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MoverColumn({
  title,
  icon,
  stats,
  maxMove,
  onPick,
}: {
  title: string;
  icon: ReactNode;
  stats: TickerStat[];
  maxMove: number;
  onPick: (ticker: string) => void;
}) {
  return (
    <div className="mover-column">
      <h3>
        {icon}
        {title}
      </h3>
      <div className="mover-list">
        {stats.map((stat) => {
          const width = Math.max(7, (Math.abs(stat.priceChangePct) / maxMove) * 100);
          const tone = stat.priceChangePct >= 0 ? "up" : "down";
          return (
            <button className={`mover-row mover-${tone}`} key={`${title}-${stat.ticker}`} onClick={() => onPick(stat.ticker)}>
              <span className="mover-ticker">{stat.ticker}</span>
              <span className="mover-price">
                {formatPrice(stat.firstPrice)} {"->"} {formatPrice(stat.lastPrice)}
              </span>
              <strong>{formatPct(stat.priceChangePct)}</strong>
              <i>
                <b style={{ width: `${width}%` }} />
              </i>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TickerPopout({
  stat,
  signals,
  onClose,
}: {
  stat: TickerStat;
  signals: SignalEvent[];
  onClose: () => void;
}) {
  return (
    <div className="popout-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="popout-card" role="dialog" aria-modal="true" aria-label={`${stat.ticker} Signal Card`}>
        <div className="popout-head">
          <div>
            <span className="detail-label">Signal Card</span>
            <h2>{stat.ticker}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup signal card" title="Tutup">
            <X size={18} />
          </button>
        </div>
        <TickerDetail stat={stat} signals={signals} />
      </section>
    </div>
  );
}

function TimeBuckets({ buckets }: { buckets: ReturnType<typeof buildTimeBuckets> }) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
  if (!buckets.length) return <EmptyState text="Tidak ada signal pada filter ini." />;
  return (
    <div className="time-chart">
      {buckets.map((bucket) => (
        <div className="time-bar" key={bucket.key}>
          <span style={{ height: `${Math.max(8, (bucket.count / max) * 100)}%` }} title={`${bucket.key}: ${bucket.count} signal`} />
          <small>{bucket.key}</small>
        </div>
      ))}
    </div>
  );
}

function BarList({ stats, compact = false }: { stats: ReturnType<typeof groupSignals>; compact?: boolean }) {
  const max = Math.max(...stats.map((stat) => stat.count), 1);
  if (!stats.length) return <EmptyState text="Belum ada data." />;
  return (
    <div className={`bar-list ${compact ? "compact" : ""}`}>
      {stats.map((stat) => (
        <div className="bar-row" key={stat.key}>
          <div>
            <strong>{stat.key}</strong>
            <small>{stat.rawCount} raw · total {stat.maxTotal.toFixed(1)}</small>
          </div>
          <span>{stat.count}</span>
          <div className="bar-track">
            <i style={{ width: `${Math.max(6, (stat.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryPills({ stats }: { stats: ReturnType<typeof groupSignals> }) {
  const max = Math.max(...stats.map((stat) => stat.count), 1);
  if (!stats.length) return <EmptyState text="Tidak ada kategori." />;
  return (
    <div className="category-grid">
      {stats.map((stat) => (
        <button className="category-pill" key={stat.key}>
          <span>{stat.key}</span>
          <strong>{stat.count}</strong>
          <i style={{ width: `${(stat.count / max) * 100}%` }} />
        </button>
      ))}
    </div>
  );
}

function RadarIdeas({ stats, onPick }: { stats: TickerStat[]; onPick: (ticker: string) => void }) {
  const confluence = stats.filter((stat) => stat.categories.length >= 3 || stat.signalNames.length >= 4).slice(0, 3);
  const early = stats.filter((stat) => stat.firstSignal.minutes <= 570).slice(0, 3);
  const starred = stats.filter((stat) => stat.starredCount > 0).slice(0, 3);
  const groups = [
    { label: "Confluence", items: confluence },
    { label: "Early flow", items: early },
    { label: "Starred", items: starred },
  ];
  return (
    <div className="radar-ideas">
      {groups.map((group) => (
        <div className="idea-group" key={group.label}>
          <span>{group.label}</span>
          {group.items.length ? (
            group.items.map((item) => (
              <button key={`${group.label}-${item.ticker}`} onClick={() => onPick(item.ticker)}>
                <strong>{item.ticker}</strong>
                <small>{item.maxTotal.toFixed(1)} · {item.firstSignal.signalTime}</small>
              </button>
            ))
          ) : (
            <em>-</em>
          )}
        </div>
      ))}
    </div>
  );
}

function SignalTable({ signals, onPick }: { signals: SignalEvent[]; onPick: (ticker: string) => void }) {
  if (!signals.length) return <EmptyState text="Filter saat ini kosong." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jam</th>
            <th>Ticker</th>
            <th>Signal</th>
            <th>Harga</th>
            <th>Score</th>
            <th>Total</th>
            <th>Sesi</th>
            <th>Raw</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr key={`${signal.duplicateKey}-${signal.id}`}>
              <td>{signal.tradeDate}</td>
              <td>{signal.signalTime}</td>
              <td>
                <button className="ticker-link" onClick={() => onPick(signal.ticker)}>
                  {signal.ticker}
                </button>
              </td>
              <td>
                <span className="signal-cell">{signal.signalName}</span>
              </td>
              <td>{formatEventPrice(signal)}</td>
              <td>+{signal.score}</td>
              <td>{signal.total.toFixed(1)}</td>
              <td>{signal.session}</td>
              <td>{signal.duplicateCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function formatEventPrice(signal: SignalEvent): string {
  return hasSignalPrice(signal) ? formatPrice(signal.price) : "-";
}
