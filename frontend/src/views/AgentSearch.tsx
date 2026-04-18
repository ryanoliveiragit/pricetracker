"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronDown,
  Globe,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Truck,
  X as XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "../context/ThemeContext";
import { suppliersApi } from "../services/api";
import {
  buildSupplierSearchPayload,
  sendAgentMessage,
  type AgentOption,
  type AgentResponse,
  type AgentSummary,
  type ChatMessage,
} from "../services/agentApi";

/* ─── STATIC ANIMATIONS ─── */
const AGENT_STYLE = `
  .mono { font-family: var(--font-mono, 'Courier New', monospace); }

  /* Grid background */
  .hero-bg {
    background-image:
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* ── Keyframes ── */
  @keyframes sparkle-spin {
    0%,100% { transform: scale(1) rotate(0deg); opacity:1; }
    25%     { transform: scale(1.4) rotate(18deg); opacity:0.7; }
    75%     { transform: scale(0.7) rotate(-12deg); opacity:0.5; }
  }
  @keyframes float-up {
    0%,100% { opacity:0; transform: translateY(0); }
    20%     { opacity:0.7; }
    60%     { opacity:0.4; transform: translateY(-18px); }
  }
  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes blink-cur {
    0%,50% { opacity:1; } 51%,100% { opacity:0; }
  }
  @keyframes dot-bounce {
    0%,80%,100% { transform: translateY(0); opacity:0.4; }
    40%         { transform: translateY(-6px); opacity:1; }
  }
  @keyframes spin-loader {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes pulse-dot {
    0%,100% { opacity:1; transform:scale(1); }
    50%     { opacity:0.5; transform:scale(0.75); }
  }

  .sparkle-anim  { animation: sparkle-spin 3.2s ease-in-out infinite; display:inline-block; }
  .float-anim    { animation: float-up 4s ease-in-out infinite; }
  .marquee-anim  { animation: marquee 22s linear infinite; }
  .cursor-blink  { animation: blink-cur 1s infinite; }
  .dot-bounce    { animation: dot-bounce 1.4s ease-in-out infinite; }
  .spin-loader   { animation: spin-loader 0.75s linear infinite; }
  .pulse-dot     { animation: pulse-dot 2s ease-in-out infinite; }
  .press:active  { transform: scale(0.96); }

  /* shimmer gradient for loading skeletons */
  .shimmer-text {
    background: linear-gradient(90deg, var(--t3) 25%, var(--t1) 50%, var(--t3) 75%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 2s linear infinite;
  }

  /* Chat message fade-in edge */
  .chat-scroll-fade {
    mask-image: linear-gradient(to bottom, transparent 0px, black 40px, black calc(100% - 40px), transparent 100%);
  }

  .agent-page ::-webkit-scrollbar       { width: 4px; }
  .agent-page ::-webkit-scrollbar-track { background: transparent; }
  .agent-page ::-webkit-scrollbar-thumb { background: var(--ln2); border-radius: 2px; }
  .agent-page textarea::placeholder,
  .agent-page input::placeholder        { color: var(--t3); opacity: 1; }

  /* ── Height lock: fills viewport, never scrolls at page level ── */
  .agent-page {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* ── Responsive ── */
  .chat-sidebar {
    display: flex;
    transition: width 250ms cubic-bezier(0.4,0,0.2,1), opacity 250ms;
  }
  @media (max-width: 860px) {
    .chat-sidebar { display: none !important; }
    .chat-sidebar.sidebar-open { display: flex !important; position: absolute; right: 0; top: 0; bottom: 0; z-index: 10; }
  }
  @media (max-width: 600px) {
    .hero-headline { font-size: 32px !important; }
    .hero-desc     { font-size: 13px !important; }
    .hero-input    { padding: 3px 3px 3px 12px !important; }
    .chat-messages { padding: 16px 12px 0 !important; }
    .chat-input    { padding: 0 12px !important; }
    .chat-header   { padding: 10px 16px !important; }
  }
`;

/* ─── THEME TOKENS ─── */
// Accent uses --primary-500 / --primary-600 from ThemeContext (stored as "R G B" triplets)
function buildTokens(isDark: boolean): React.CSSProperties {
  return isDark ? {
    "--acc":        "rgb(var(--primary-500))",
    "--acc2":       "rgb(var(--primary-600))",
    "--acc-soft":   "rgb(var(--primary-500) / 0.12)",
    "--acc-softer": "rgb(var(--primary-500) / 0.06)",
    "--acc-glow":   "rgb(var(--primary-500) / 0.35)",
    "--bg0": "#0a0a0a",
    "--bg1": "#141414",
    "--bg2": "#1a1a1a",
    "--bg3": "#222222",
    "--ln":  "rgba(255,255,255,0.07)",
    "--ln2": "rgba(255,255,255,0.12)",
    "--t0": "#f0f0ea",
    "--t1": "#b0b0a8",
    "--t2": "#787870",
    "--t3": "#525250",
    "--ok": "#42c366",
    "--grid-line": "rgba(255,255,255,0.04)",
  } as React.CSSProperties : {
    "--acc":        "rgb(var(--primary-500))",
    "--acc2":       "rgb(var(--primary-600))",
    "--acc-soft":   "rgb(var(--primary-500) / 0.08)",
    "--acc-softer": "rgb(var(--primary-500) / 0.04)",
    "--acc-glow":   "rgb(var(--primary-500) / 0.30)",
    "--bg0": "#fafaf7",
    "--bg1": "#f4f4ef",
    "--bg2": "#ffffff",
    "--bg3": "#f0f0ea",
    "--ln":  "rgba(20,20,15,0.08)",
    "--ln2": "rgba(20,20,15,0.14)",
    "--t0": "#1a1a15",
    "--t1": "#4a4a42",
    "--t2": "#7a7a6f",
    "--t3": "#a8a89d",
    "--ok": "#42c366",
    "--grid-line": "rgba(20,20,15,0.04)",
  } as React.CSSProperties;
}

/* ─── SCRAMBLE / MATRIX UTILS ─── */
const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-=?+/\\|<>[]{}";
const rndChar = () => MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];

/** Scramble-decrypt a string: random chars → revealed left-to-right */
function useScramble(target: string, duration = 1100, delay = 0) {
  const [display, setDisplay] = useState(() =>
    target.split("").map(c => c === " " ? " " : rndChar()).join("")
  );
  useEffect(() => {
    const totalFrames = duration / 16;
    let frame = 0;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        const revealed = Math.floor((frame / totalFrames) * target.length);
        setDisplay(
          target.split("").map((c, i) =>
            c === " " ? " " : i < revealed ? c : rndChar()
          ).join("")
        );
        frame++;
        if (frame >= totalFrames) { clearInterval(interval); setDisplay(target); }
      }, 16);
    }, delay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [target, duration, delay]);
  return display;
}

/** Cycles through placeholder texts with scramble decrypt between each */
const PLACEHOLDERS = [
  "20 sacos de cimento CP-II e areia lavada",
  "tinta acrílica branca 18L para área externa",
  "vergalhão CA-50 10mm — 100 barras",
  "kit hidráulico para banheiro completo",
  "telha cerâmica colonial — 200m²",
  "porcelanato 60x60 bege polido — 3 caixas",
];

function useCrypticPlaceholder(interval = 3200) {
  const [idx, setIdx] = useState(0);
  const [display, setDisplay] = useState(PLACEHOLDERS[0]);
  const [isScrambling, setIsScrambling] = useState(false);
  const target = PLACEHOLDERS[idx];

  // Cycle index
  useEffect(() => {
    const t = setInterval(() => {
      setIdx(i => (i + 1) % PLACEHOLDERS.length);
      setIsScrambling(true);
    }, interval);
    return () => clearInterval(t);
  }, [interval]);

  // Scramble-decrypt when target changes
  useEffect(() => {
    if (!isScrambling) return;
    const duration = 900;
    const totalFrames = duration / 16;
    let frame = 0;
    const iv = setInterval(() => {
      const revealed = Math.floor((frame / totalFrames) * target.length);
      setDisplay(
        target.split("").map((c, i) =>
          c === " " ? " " : i < revealed ? c : rndChar()
        ).join("")
      );
      frame++;
      if (frame >= totalFrames) {
        clearInterval(iv);
        setDisplay(target);
        setIsScrambling(false);
      }
    }, 16);
    return () => clearInterval(iv);
  }, [idx, target, isScrambling]);

  return { display, isScrambling };
}


/* ─── TYPEWRITER ─── */
function TypewriterText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i < text.length) setShown(text.slice(0, ++i));
      else { clearInterval(t); onDone?.(); }
    }, 12);
    return () => clearInterval(t);
  }, [text]);
  const done = shown.length >= text.length;
  return (
    <span>
      {shown}
      {!done && (
        <span className="cursor-blink" style={{
          display: "inline-block", width: 7, height: 15,
          background: "var(--acc)", marginLeft: 2, verticalAlign: "-2px",
        }} />
      )}
    </span>
  );
}

/* ─── SPARKLE ✦ ─── */
function Sparkle({ style, delay = 0, size = 18 }: { style: React.CSSProperties; delay?: number; size?: number }) {
  return (
    <span className="sparkle-anim" aria-hidden style={{
      position: "absolute", color: "var(--acc)", fontSize: size,
      userSelect: "none", animationDelay: `${delay}s`, ...style,
    }}>✦</span>
  );
}

/* ─── FLOATING SQUARE PIXEL ─── */
function FloatPixel({ style }: { style: React.CSSProperties }) {
  return (
    <div className="float-anim" aria-hidden style={{
      position: "absolute", width: 7, height: 7,
      background: "var(--acc)", opacity: 0.28, borderRadius: 2, ...style,
    }} />
  );
}

const PIXEL_POS: React.CSSProperties[] = [
  { top: "13%", left: "8%",  animationDelay: "0s"   },
  { top: "19%", left: "20%", animationDelay: "1.6s"  },
  { top: "24%", right:"13%", animationDelay: "0.8s"  },
  { top: "30%", right:"24%", animationDelay: "2.3s"  },
  { top: "47%", left: "6%",  animationDelay: "1.1s"  },
  { top: "58%", right:"8%",  animationDelay: "0.5s"  },
  { top: "70%", left: "15%", animationDelay: "2.9s"  },
  { top: "78%", right:"18%", animationDelay: "1.8s"  },
  { top: "36%", left: "44%", animationDelay: "3.2s"  },
];

/* ─── HERO BACKGROUND — grid only ─── */
function HeroBg() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div className="hero-bg" style={{
        position: "absolute", inset: 0,
        maskImage: "radial-gradient(ellipse 85% 70% at 50% 40%, black 5%, transparent 75%)",
      }} />
    </div>
  );
}

/* ─── SUPPLIER MARQUEE ─── */
function SupplierMarquee({ names }: { names: string[] }) {
  if (!names.length) return null;
  const doubled = [...names, ...names];
  return (
    <div style={{ overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)" }}>
      <div className="marquee-anim" style={{ display: "flex", gap: 48, width: "max-content", padding: "4px 0" }}>
        {doubled.map((n, i) => (
          <span key={i} className="mono" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "var(--t3)" }}>
            {n.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── THINKING DOTS ─── */
function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "6px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="dot-bounce" style={{
          width: 5, height: 5, borderRadius: "50%", background: "var(--acc)",
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  );
}

/* ─── TOOL USE CARD ─── */
interface ToolCardProps {
  name: string;
  method: string;
  status: "running" | "done" | "pending";
  logs?: string[];
  result?: string;
}

function ToolUseCard({ name, method, status, logs, result }: ToolCardProps) {
  const [expanded, setExpanded] = useState(status === "running");
  const isRunning = status === "running";
  const isDone = status === "done";

  return (
    <div style={{
      border: `1px solid ${isRunning ? "var(--acc)" : "var(--ln2)"}`,
      borderRadius: 10, overflow: "hidden",
      background: isRunning ? "var(--acc-softer)" : "var(--bg2)",
      boxShadow: isRunning ? "0 4px 16px -6px var(--acc-glow)" : "none",
      transition: "all 300ms",
    }}>
      <button onClick={() => setExpanded(!expanded)} className="press"
        style={{ width: "100%", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--t0)", fontFamily: "inherit" }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center",
          background: isRunning ? "var(--acc)" : isDone ? "color-mix(in srgb, var(--ok) 15%, transparent)" : "var(--bg3)",
          color: isRunning ? "#fff" : isDone ? "var(--ok)" : "var(--t2)",
        }}>
          {isRunning ? (
            <Loader2 size={11} className="spin-loader" />
          ) : isDone ? (
            <CheckCircle2 size={11} />
          ) : (
            <Box size={11} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{name}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--t3)" }}>{method}</span>
          </div>
          {result && <div className="mono" style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>{result}</div>}
          {isRunning && !result && <ThinkingDots />}
        </div>
        <ChevronDown size={14} style={{ color: "var(--t3)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>

      {expanded && logs && logs.length > 0 && (
        <div style={{
          padding: "10px 12px 12px", borderTop: "1px solid var(--ln)",
          background: "var(--bg1)",
        }}>
          {logs.map((log, i) => (
            <div key={i} className="mono" style={{
              display: "flex", gap: 8, fontSize: 11, marginBottom: 3,
              animation: `fade-in 300ms ${i * 80}ms both`,
            }}>
              <span style={{ color: "var(--t3)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: log.startsWith("→") ? "var(--acc)" : "var(--t2)", fontWeight: log.startsWith("→") ? 500 : 400 }}>{log}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SEARCH MODES ─── */
type SearchMode = "padrao" | "avancada";

const MODE_CONFIG: Record<SearchMode, { label: string; icon: React.ReactNode; hint: string }> = {
  padrao: {
    label: "Busca Padrão",
    icon: <Layers size={13} />,
    hint: "Pesquisa todos os fornecedores conectados e retorna o melhor preço de imediato.",
  },
  avancada: {
    label: "Busca Avançada",
    icon: <Sparkles size={13} />,
    hint: "O agente IA refina variante, marca e quantidade antes de iniciar a cotação.",
  },
};

/* ─── QUICK PROMPTS ─── */
const QUICK_PROMPTS = [
  { icon: <Layers size={12} />, text: "Cotação para obra residencial 100m²" },
  { icon: <Truck size={12} />, text: "Vergalhões 10mm e areia média" },
  { icon: <Box size={12} />, text: "Tinta acrílica branca 18L" },
  { icon: <TrendingUp size={12} />, text: "Cimento CP-II ao melhor preço" },
];

/* ─── HERO COMMAND BAR ─── */
interface HeroProps {
  onSend: (text: string, mode: SearchMode) => void;
}

function HeroCommandBar({ onSend }: HeroProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<SearchMode>("padrao");
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    suppliersApi.getAll()
      .then(list => setSupplierNames(list.filter(s => s.isActive).map(s => s.name)))
      .catch(() => {/* silently ignore if backend offline */});
  }, []);

  const { display: placeholder, isScrambling } = useCrypticPlaceholder(3600);
  const scrambledCotar = useScramble("cotar", 900, 500);
  const scrambledCount = useScramble("mais de 10 mil produtos", 1100, 900);

  const submit = useCallback(() => {
    if (!text.trim()) return;
    onSend(text, mode);
    setText("");
  }, [text, mode, onSend]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px", position: "relative", overflow: "hidden",
    }}>
      <HeroBg />

      {/* Centre readability mask */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 65% 60% at 50% 44%, var(--bg0) 28%, transparent 72%)",
      }} />


      <div style={{ width: "100%", maxWidth: 660, position: "relative", zIndex: 1 }}>

        {/* ── Badge ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px 5px 7px", background: "var(--bg2)",
            border: "1px solid var(--ln2)", borderRadius: 100,
            fontSize: 11, color: "var(--t1)",
            boxShadow: "0 1px 4px var(--ln)",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: "var(--acc-soft)", display: "grid", placeItems: "center", color: "var(--acc)",
            }}>
              <Sparkles size={11} />
            </div>
            <span className="mono" style={{ letterSpacing: "0.03em" }}>powered by construprice.ai · v2.4</span>
          </div>
        </motion.div>

        {/* ── Headline ── */}
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{
            fontSize: 48, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.05,
            textAlign: "center", marginBottom: 16, color: "var(--t0)",
          }}
        >
          O que você precisa{" "}
          <span className="mono" style={{ color: "var(--acc)", fontWeight: 500 }}>
            {scrambledCotar}
          </span>
          {" "}hoje?
        </motion.h1>

        {/* ── Description ── */}
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          style={{
            fontSize: 15, color: "var(--t2)", textAlign: "center",
            maxWidth: 500, margin: "0 auto 36px", lineHeight: 1.6,
          }}
        >
          Descreva em linguagem natural — do material à quantidade. O agente
          identifica os itens, cruza{" "}
          <span className="mono" style={{ color: "var(--t0)", fontSize: 13, fontWeight: 500 }}>
            {scrambledCount}
          </span>
          {" "}e monta a cotação ideal em segundos.
        </motion.p>

        {/* ── Input card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
          <div style={{
            background: "var(--bg2)",
            border: `1px solid ${focused ? "var(--acc)" : "var(--ln2)"}`,
            borderRadius: 14,
            boxShadow: focused
              ? "0 0 0 4px var(--acc-soft), 0 16px 40px -14px var(--acc-glow)"
              : "0 6px 24px -8px var(--ln2), 0 1px 3px var(--ln)",
            transition: "all 220ms cubic-bezier(0.4,0,0.2,1)",
            overflow: "hidden",
            position: "relative",
          }}>
            {/* Input row */}
            <div style={{ display: "flex", alignItems: "center", padding: "4px 4px 4px 16px" }}>
              <Sparkles size={17} style={{
                color: focused ? "var(--acc)" : "var(--t3)",
                flexShrink: 0, marginRight: 10, transition: "color 200ms",
              }} />

              {/* Native input + cryptic placeholder overlay */}
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => { if (e.key === "Enter") submit(); }}
                  style={{
                    width: "100%", padding: "15px 0", fontSize: 15,
                    background: "none", border: "none", outline: "none",
                    color: "var(--t0)", fontFamily: "inherit",
                  }}
                />
                {!text && (
                  <div aria-hidden className="mono" style={{
                    position: "absolute", top: "50%", left: 0,
                    transform: "translateY(-50%)",
                    fontSize: 14, color: "var(--t3)", pointerEvents: "none",
                    opacity: isScrambling ? 0.55 : 0.45,
                    transition: "opacity 300ms",
                    whiteSpace: "nowrap", overflow: "hidden",
                    maxWidth: "100%", textOverflow: "ellipsis",
                  }}>
                    {placeholder}
                  </div>
                )}
              </div>

              <button onClick={submit} disabled={!text.trim()} className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "10px 16px", margin: 4, borderRadius: 10,
                  background: text.trim() ? "var(--acc)" : "var(--bg3)",
                  color: text.trim() ? "#fff" : "var(--t3)",
                  fontSize: 13, fontWeight: 600,
                  border: "none", cursor: text.trim() ? "pointer" : "default",
                  transition: "all 180ms",
                  boxShadow: text.trim() ? "0 4px 12px -2px var(--acc-glow)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                Buscar <ArrowRight size={14} />
              </button>
            </div>

            {/* Footer bar: mode selector + meta */}
            <div style={{
              display: "flex", alignItems: "center",
              padding: "6px 8px 8px", borderTop: "1px solid var(--ln)", gap: 4,
            }}>
              {/* Mode pills */}
              {(Object.keys(MODE_CONFIG) as SearchMode[]).map(m => {
                const active = mode === m;
                return (
                  <button key={m} onClick={() => setMode(m)} className="press"
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 11px", borderRadius: 7,
                      background: active ? "var(--acc-soft)" : "transparent",
                      color: active ? "var(--acc)" : "var(--t2)",
                      border: `1px solid ${active ? "var(--acc-soft)" : "transparent"}`,
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      cursor: "pointer", fontFamily: "inherit", transition: "all 160ms",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg3)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {MODE_CONFIG[m].icon}
                    {MODE_CONFIG[m].label}
                  </button>
                );
              })}

              <div style={{ flex: 1 }} />

              {/* Meta */}
              <div className="mono" style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--t3)", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Globe size={10} /> campinas/sp
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Store size={10} /> {supplierNames.length || "—"} fornecedores
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <kbd style={{ padding: "1px 5px", background: "var(--bg3)", border: "1px solid var(--ln)", borderRadius: 3 }}>⏎</kbd>
                  enviar
                </span>
              </div>
            </div>
          </div>

          {/* Mode hint */}
          <AnimatePresence mode="wait">
            <motion.p key={mode}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{ textAlign: "center", fontSize: 12, color: "var(--t3)", marginTop: 10 }}
            >
              {MODE_CONFIG[mode].hint}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* ── Quick prompts ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
          style={{ marginTop: 22 }}
        >
          <div className="mono" style={{
            fontSize: 10, color: "var(--t3)", letterSpacing: "0.12em",
            textTransform: "uppercase", textAlign: "center", marginBottom: 12,
          }}>
            ou comece com
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {QUICK_PROMPTS.map((p, i) => (
              <motion.button key={i}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.72 + i * 0.07 }}
                onClick={() => onSend(p.text, mode)} className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 14px", background: "var(--bg2)",
                  border: "1px solid var(--ln)", borderRadius: 100,
                  fontSize: 12, color: "var(--t1)", cursor: "pointer",
                  fontFamily: "inherit", transition: "all 180ms",
                  boxShadow: "0 1px 3px var(--ln)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = "var(--acc)";
                  el.style.color = "var(--acc)";
                  el.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = "var(--ln)";
                  el.style.color = "var(--t1)";
                  el.style.transform = "translateY(0)";
                }}
              >
                {p.icon} {p.text}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Supplier marquee ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          style={{ marginTop: 40 }}
        >
          <div className="mono" style={{
            fontSize: 10, color: "var(--t3)", letterSpacing: "0.12em",
            textTransform: "uppercase", textAlign: "center", marginBottom: 12,
          }}>
            conectado com
          </div>
          <SupplierMarquee names={supplierNames} />
        </motion.div>
      </div>
    </div>
  );
}

/* ─── USER MESSAGE ─── */
function UserMessage({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", justifyContent: "flex-end" }}
    >
      <div style={{
        maxWidth: "72%",
        background: "var(--acc-soft)",
        border: "1px solid var(--acc-soft)",
        borderRadius: "14px 14px 4px 14px",
        padding: "10px 14px",
        fontSize: 14,
        lineHeight: 1.55,
        color: "var(--t0)",
        whiteSpace: "pre-wrap",
      }}>{text}</div>
    </motion.div>
  );
}

/* ─── ASSISTANT MESSAGE ─── */
interface AssistantMsgProps {
  text: string;
  isStreaming: boolean;
  onDone?: () => void;
  tools?: ToolCardProps[];
}

function AssistantMessage({ text, isStreaming, onDone, tools }: AssistantMsgProps) {
  const [toolStage, setToolStage] = useState(0);
  const [textReady, setTextReady] = useState(!isStreaming);

  useEffect(() => {
    if (!tools?.length) { setTextReady(true); return; }
    if (!isStreaming) { setToolStage(tools.length + 1); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    tools.forEach((_, i) => {
      timers.push(setTimeout(() => setToolStage(i + 1), 500 + i * 1600));
    });
    timers.push(setTimeout(() => setToolStage(tools.length + 1), 500 + tools.length * 1600));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (toolStage > (tools?.length ?? 0)) setTextReady(true);
  }, [toolStage, tools?.length]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: "linear-gradient(135deg, var(--acc-soft), var(--bg2))",
        border: "1px solid var(--acc-soft)",
        display: "grid", placeItems: "center", color: "var(--acc)",
      }}>
        <Sparkles size={13} className="sparkle-anim" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t0)", letterSpacing: "-0.01em" }}>Agente</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--t3)", background: "var(--bg1)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--ln)" }}>construprice.ai</span>
        </div>

        {tools && tools.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: toolStage > tools.length ? 12 : 0 }}>
            {tools.map((t, i) => {
              const status: ToolCardProps["status"] = toolStage > i + 1 ? "done" : toolStage === i + 1 ? "running" : "pending";
              if (status === "pending") return null;
              return <ToolUseCard key={i} {...t} status={status} />;
            })}
          </div>
        )}

        {textReady && text && (
          <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t1)", whiteSpace: "pre-wrap" }}>
            {isStreaming ? <TypewriterText text={text} onDone={onDone} /> : text}
          </div>
        )}

        {!textReady && tools && toolStage === 0 && <ThinkingDots />}
      </div>
    </motion.div>
  );
}

/* ─── LOADING INDICATOR ─── */
function LoadingMessage() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: "linear-gradient(135deg, var(--acc-soft), var(--bg2))",
        border: "1px solid var(--acc-soft)",
        display: "grid", placeItems: "center", color: "var(--acc)",
      }}>
        <Sparkles size={13} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 8 }}>
        <ThinkingDots />
      </div>
    </motion.div>
  );
}

/* ─── QUICK OPTION CHIP ─── */
function QuickChip({ label, disabled, onSelect }: { label: string; disabled: boolean; onSelect: () => void }) {
  const isQualquer = label.toLowerCase() === "qualquer";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="press"
      style={{
        padding: "6px 13px",
        background: isQualquer ? "transparent" : "var(--bg2)",
        border: `1px solid ${isQualquer ? "var(--ln)" : "var(--ln2)"}`,
        borderRadius: 100,
        fontSize: 13,
        color: isQualquer ? "var(--t2)" : "var(--t1)",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 160ms",
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--acc)";
          el.style.color = "var(--acc)";
          el.style.background = "var(--acc-softer)";
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = isQualquer ? "var(--ln)" : "var(--ln2)";
        el.style.color = isQualquer ? "var(--t2)" : "var(--t1)";
        el.style.background = isQualquer ? "transparent" : "var(--bg2)";
      }}
    >
      {label}
    </button>
  );
}

/* ─── SUPPLIER SELECT CARD ─── */
function SupplierSelectCard({ options, onSelect }: { options: AgentOption[]; onSelect: (val: string) => void }) {
  return (
    <div style={{
      padding: "12px 14px", background: "var(--bg1)",
      border: "1px solid var(--ln)", borderRadius: 10,
    }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
        Selecione o fornecedor
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(opt => {
          const isAll = opt.value.toLowerCase().includes("todos");
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className="press"
              style={{
                padding: "7px 14px",
                background: isAll ? "var(--acc-softer)" : "var(--bg2)",
                border: `1px solid ${isAll ? "var(--acc-soft)" : "var(--ln2)"}`,
                borderRadius: 100,
                fontSize: 13,
                color: isAll ? "var(--acc)" : "var(--t1)",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 160ms",
                display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "var(--acc)";
                el.style.color = "var(--acc)";
                el.style.background = "var(--acc-softer)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = isAll ? "var(--acc-soft)" : "var(--ln2)";
                el.style.color = isAll ? "var(--acc)" : "var(--t1)";
                el.style.background = isAll ? "var(--acc-softer)" : "var(--bg2)";
              }}
            >
              {isAll ? <Globe size={11} /> : <Store size={11} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── MULTI CHIPS INPUT ─── */
function MultiChipsInput({ suggested, onConfirm, onSkip }: { suggested: string[]; onConfirm: (vals: string[]) => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<string[]>([...suggested]);
  const [custom, setCustom] = useState("");

  function toggle(alias: string) {
    setSelected(prev => prev.includes(alias) ? prev.filter(a => a !== alias) : [...prev, alias]);
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    setSelected(prev => [...prev, trimmed]);
    setCustom("");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        padding: "14px 16px", background: "var(--bg2)",
        border: "1px solid var(--ln)", borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Tag size={13} style={{ color: "var(--acc)" }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--t0)" }}>Confirme os termos de busca</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {selected.map(alias => (
          <button
            key={alias}
            type="button"
            onClick={() => toggle(alias)}
            style={{
              padding: "6px 12px",
              background: "var(--acc-soft)",
              border: "1px solid var(--acc)",
              borderRadius: 100,
              fontSize: 13,
              color: "var(--acc)",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 150ms",
            }}
          >
            {alias} <XIcon size={11} />
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Adicionar termo..."
            style={{
              padding: "6px 12px",
              background: "var(--bg1)",
              border: "1px dashed var(--ln2)",
              borderRadius: 100,
              fontSize: 13,
              color: "var(--t1)",
              fontFamily: "inherit",
              outline: "none",
              width: 150,
            }}
          />
          {custom.trim() && (
            <button type="button" onClick={addCustom} style={{
              width: 28, height: 28,
              background: "var(--acc-softer)",
              border: "1px solid var(--acc)",
              borderRadius: "50%",
              display: "grid", placeItems: "center",
              color: "var(--acc)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onConfirm(selected)}
          disabled={selected.length === 0}
          className="press"
          style={{
            padding: "8px 16px",
            background: selected.length > 0 ? "var(--acc)" : "var(--bg3)",
            color: selected.length > 0 ? "#fff" : "var(--t3)",
            border: "none",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            cursor: selected.length > 0 ? "pointer" : "default",
            fontFamily: "inherit",
            transition: "all 180ms",
            boxShadow: selected.length > 0 ? "0 2px 8px -1px var(--acc-glow)" : "none",
          }}
        >
          Confirmar {selected.length} {selected.length === 1 ? "termo" : "termos"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="press"
          style={{
            padding: "8px 14px",
            background: "var(--bg1)",
            color: "var(--t2)",
            border: "1px solid var(--ln)",
            borderRadius: 7,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 180ms",
          }}
        >
          Pular
        </button>
      </div>
    </motion.div>
  );
}

/* ─── STICKY INPUT ─── */
function StickyInput({ onSend, disabled }: { onSend: (t: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.min(ref.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  return (
    <div style={{ padding: "12px 0 16px" }}>
      <div style={{
        background: "var(--bg1)",
        border: `1px solid ${focused ? "var(--acc)" : "var(--ln)"}`,
        borderRadius: 12,
        padding: "8px 8px 8px 14px",
        display: "flex", alignItems: "flex-end", gap: 8,
        transition: "border-color 180ms, box-shadow 180ms",
        boxShadow: focused
          ? "0 0 0 3px var(--acc-soft)"
          : "none",
        opacity: disabled ? 0.6 : 1,
      }}>
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          disabled={disabled}
          placeholder={disabled ? "Selecione uma opção acima..." : "Mensagem..."}
          rows={1}
          style={{
            flex: 1, fontSize: 14, lineHeight: 1.5, resize: "none",
            minHeight: 24, maxHeight: 120, padding: "4px 0",
            background: "none", border: "none", outline: "none",
            color: "var(--t0)", fontFamily: "inherit",
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="press"
          style={{
            width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center",
            background: text.trim() && !disabled ? "var(--acc)" : "transparent",
            color: text.trim() && !disabled ? "#fff" : "var(--t3)",
            border: `1px solid ${text.trim() && !disabled ? "var(--acc)" : "var(--ln)"}`,
            cursor: text.trim() && !disabled ? "pointer" : "default",
            transition: "all 160ms",
            boxShadow: text.trim() && !disabled ? "0 2px 8px -2px var(--acc-glow)" : "none",
            flexShrink: 0,
          }}
        >
          <Send size={12} />
        </button>
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 6, fontSize: 10, color: "var(--t3)" }}>
        <span>↵ enviar · ⇧↵ nova linha</span>
        <span>·</span>
        <span>construprice pode cometer erros.</span>
      </div>
    </div>
  );
}

/* ─── SUMMARY SIDEBAR ─── */
function formatFieldLabel(field: string) {
  const m: Record<string, string> = {
    variant: "Variante", brand: "Marca", weight_volume: "Peso/volume",
    size_dimension: "Tamanho", color_finish: "Cor/acabamento",
    model: "Modelo", quantity: "Quantidade", aliases: "Outros nomes",
  };
  return m[field] ?? field;
}

function SummaryPanel({
  summary, ready, searchItems, onStartSearch, onReset,
}: {
  summary: AgentSummary | null;
  ready: boolean;
  searchItems: string[];
  onStartSearch: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{
      width: 290, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "var(--bg1)", border: "1px solid var(--ln)",
      borderRadius: 10, overflow: "hidden",
    }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--ln)", display: "flex", alignItems: "center", gap: 6 }}>
        <ShoppingCart size={12} style={{ color: "var(--acc)" }} />
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--t2)" }}>Escopo da busca</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ padding: "8px 10px", background: "var(--bg2)", borderRadius: 7, border: "1px solid var(--ln)" }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>Fornecedor</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t0)" }}>{summary?.supplier_label ?? "—"}</div>
        </div>

        {summary?.products?.length ? summary.products.map(p => (
          <div key={p.product_key} style={{
            padding: "8px 10px", borderRadius: 7,
            border: `1px solid ${p.active ? "var(--acc)" : "var(--ln)"}`,
            background: p.active ? "var(--acc-softer)" : "var(--bg2)",
            transition: "all 200ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--t0)" }}>{p.position}. {p.label}</span>
              {p.ready ? (
                <CheckCircle2 size={12} style={{ color: "var(--ok)", flexShrink: 0 }} />
              ) : p.active ? (
                <Loader2 size={11} className="spin-loader" style={{ color: "var(--acc)", flexShrink: 0 }} />
              ) : null}
            </div>
            {p.selected_fields.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
                {p.selected_fields.map(f => (
                  <span key={f.field} className="mono" style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 8,
                    background: f.field === "aliases" ? "var(--acc-soft)" : "var(--bg3)",
                    color: f.field === "aliases" ? "var(--acc)" : "var(--t2)",
                    border: "1px solid var(--ln)",
                  }}>
                    {f.value}
                  </span>
                ))}
              </div>
            )}
            <div className="mono" style={{
              fontSize: 9, padding: "3px 7px", borderRadius: 5,
              background: "var(--acc-softer)", color: "var(--t2)",
              border: "1px dashed var(--ln2)",
            }}>
              {p.search_item}
            </div>
          </div>
        )) : (
          <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--t3)" }}>
            Os itens aparecerão aqui conforme o agente refinar.
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--ln)" }}>
        {ready ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" onClick={onStartSearch} className="press"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 16px", background: "var(--acc)", color: "#fff",
                borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "0 4px 12px -2px var(--acc-glow)",
              }}
            >
              <ShoppingCart size={14} /> Iniciar Cotação
            </button>
            <button type="button" onClick={onReset} className="press"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 16px", background: "var(--bg1)", color: "var(--t1)",
                borderRadius: 8, fontSize: 13, fontWeight: 500, border: "1px solid var(--ln)", cursor: "pointer",
              }}
            >
              <RotateCcw size={13} /> Refinar busca
            </button>
            {searchItems.length > 0 && (
              <p className="mono" style={{ textAlign: "center", fontSize: 11, color: "var(--t3)" }}>
                {searchItems.length} {searchItems.length === 1 ? "item pronto" : "itens prontos"}
              </p>
            )}
          </div>
        ) : (
          <p className="mono" style={{ textAlign: "center", fontSize: 11, color: "var(--t3)" }}>
            A cotação será liberada quando o escopo estiver claro.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── CHAT THREAD ─── */
interface UiMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: ToolCardProps[];
  chips?: AgentOption[];
}

/* ─── MAIN COMPONENT ─── */
export default function AgentSearch() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  const { isDark } = useTheme();
  const tokens = buildTokens(isDark);

  const hasMessages = messages.length > 0;
  const ready = lastResponse?.ready ?? false;
  const searchItems = lastResponse?.search_items ?? [];
  const canType = (lastResponse?.allow_free_text ?? true) && !ready
    && lastResponse?.input_type !== "multi_chips"
    && lastResponse?.input_type !== "select";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function processMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const uid = `u-${Date.now()}`;
    const nextHistory: ChatMessage[] = [...history, { role: "user", content: trimmed }];

    setMessages(m => [...m, { id: uid, role: "user", text: trimmed }]);
    setHistory(nextHistory);
    setIsLoading(true);

    try {
      const response = await sendAgentMessage(trimmed, history);

      const aid = `a-${Date.now()}`;
      const chips = response.input_type === "chips" ? (response.options ?? []) : undefined;

      setMessages(m => [...m, {
        id: aid,
        role: "assistant",
        text: response.message,
        chips,
      }]);
      setHistory(h => [...h, { role: "assistant", content: response.message }]);
      setLastResponse(response);
      setSummary(response.summary);
      setSelectedSuppliers(response.selected_suppliers ?? []);
      setStreamingId(aid);
    } catch {
      setMessages(m => [...m, {
        id: `e-${Date.now()}`,
        role: "assistant",
        text: "⚠️ Não consegui processar sua mensagem. Tente novamente.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleHeroSend(text: string, mode: SearchMode) {
    if (mode === "padrao") {
      // Direct search: split by comma/newline, save and navigate
      const items = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      localStorage.setItem(
        "construprice-last-search-items",
        JSON.stringify(items.length ? items : [text.trim()])
      );
      localStorage.removeItem("construprice-last-search-suppliers");
      router.push("/results");
      return;
    }
    void processMessage(text);
  }

  function handleReset() {
    setMessages([]);
    setHistory([]);
    setLastResponse(null);
    setSummary(null);
    setSelectedSuppliers([]);
    localStorage.removeItem("construprice-last-search-suppliers");
  }

  function handleStartSearch() {
    if (!searchItems.length) return;
    localStorage.setItem("construprice-last-search-items", JSON.stringify(searchItems));
    const supplierPayload = buildSupplierSearchPayload(selectedSuppliers);
    if (supplierPayload?.length) {
      localStorage.setItem("construprice-last-search-suppliers", JSON.stringify(supplierPayload.map(i => i.store_name)));
    } else {
      localStorage.removeItem("construprice-last-search-suppliers");
    }
    router.push("/results");
  }

  const lastMsg = messages[messages.length - 1];
  const currentChips = (!isLoading && !ready && lastMsg?.role === "assistant" && lastMsg?.chips?.length)
    ? lastMsg.chips
    : [];

  return (
    <>
      <style>{AGENT_STYLE}</style>
      <div className="agent-page" style={{
        ...tokens,
        display: "flex", flexDirection: "column",
        background: "var(--bg0)", color: "var(--t0)",
        fontFamily: "'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        transition: "background 200ms, color 200ms",
      }}>

        {!hasMessages && (
          <HeroCommandBar onSend={handleHeroSend} />
        )}

        {hasMessages && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Chat column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
              {/* Session header */}
              <div className="chat-header" style={{
                padding: "10px 20px", borderBottom: "1px solid var(--ln)",
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--bg0)", position: "relative", zIndex: 2,
              }}>
                {/* Live dot */}
                <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: "var(--ok)", boxShadow: "0 0 5px var(--ok)" }} />

                {/* Progress segments */}
                {lastResponse && lastResponse.progress_total > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {Array.from({ length: lastResponse.progress_total }).map((_, i) => (
                      <div key={i} style={{
                        width: 18, height: 3, borderRadius: 2,
                        background: i < lastResponse.progress_current ? "var(--acc)" : "var(--ln2)",
                        transition: "background 300ms",
                      }} />
                    ))}
                    <span className="mono" style={{ marginLeft: 6, fontSize: 10, color: "var(--t3)" }}>
                      {lastResponse.progress_current}/{lastResponse.progress_total}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--t2)" }}>Cotação avançada</span>
                )}

                <div style={{ flex: 1 }} />

                {/* Summary toggle */}
                <button onClick={() => setShowSidebar(s => !s)} className="press"
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 9px", background: showSidebar ? "var(--acc-soft)" : "transparent",
                    border: `1px solid ${showSidebar ? "var(--acc-soft)" : "var(--ln)"}`,
                    borderRadius: 6, fontSize: 11, color: showSidebar ? "var(--acc)" : "var(--t2)",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 180ms",
                  }}
                >
                  <ShoppingCart size={10} /> Resumo
                </button>

                <button onClick={handleReset} className="press"
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 9px", background: "transparent",
                    border: "1px solid var(--ln)", borderRadius: 6,
                    fontSize: 11, color: "var(--t2)", cursor: "pointer", fontFamily: "inherit",
                    transition: "all 180ms",
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = "var(--acc)"; el.style.color = "var(--acc)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = "var(--ln)"; el.style.color = "var(--t2)"; }}
                >
                  <RotateCcw size={10} /> Reiniciar
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 24px 0" }}>
                <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
                  <AnimatePresence initial={false}>
                    {messages.map(m => m.role === "user"
                      ? <UserMessage key={m.id} text={m.text} />
                      : <AssistantMessage
                          key={m.id}
                          text={m.text}
                          isStreaming={m.id === streamingId}
                          onDone={() => m.id === streamingId && setStreamingId(null)}
                          tools={m.tools}
                        />
                    )}
                  </AnimatePresence>

                  {isLoading && <LoadingMessage />}

                  {/* Quick chips (input_type === "chips") */}
                  {currentChips.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      style={{ paddingLeft: 40 }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {currentChips.map(opt => (
                          <QuickChip
                            key={opt.value}
                            label={opt.label}
                            disabled={isLoading}
                            onSelect={() => void processMessage(opt.value)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Supplier select (input_type === "select") */}
                  {!isLoading && !ready && lastResponse?.input_type === "select" && (lastResponse.options?.length ?? 0) > 0 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ paddingLeft: 40 }}>
                      <SupplierSelectCard
                        options={lastResponse.options}
                        onSelect={val => void processMessage(val)}
                      />
                    </motion.div>
                  )}

                  {/* Alias multi-chips (input_type === "multi_chips") */}
                  {!isLoading && !ready && lastResponse?.input_type === "multi_chips" && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ paddingLeft: 40 }}>
                      <MultiChipsInput
                        suggested={lastResponse.suggested_aliases ?? []}
                        onConfirm={vals => void processMessage(vals.join(", "))}
                        onSkip={() => void processMessage("Pular")}
                      />
                    </motion.div>
                  )}
                </div>
                <div style={{ height: 8 }} />
              </div>

              {/* Sticky input */}
              <div style={{
                padding: "0 24px",
                borderTop: "1px solid var(--ln)",
                background: "var(--bg0)",
                backdropFilter: "blur(8px)",
              }}>
                <div style={{ maxWidth: 680, margin: "0 auto" }}>
                  {!canType && !isLoading && !ready && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 0 0",
                      fontSize: 12, color: "var(--t3)",
                    }}>
                      <ChevronDown size={12} style={{ color: "var(--acc)" }} />
                      <span>Selecione uma opção acima para continuar</span>
                    </div>
                  )}
                  <StickyInput onSend={t => void processMessage(t)} disabled={isLoading || !canType} />
                </div>
              </div>
            </div>

            {/* Summary sidebar */}
            {showSidebar && (
              <div className={`chat-sidebar${showSidebar ? " sidebar-open" : ""}`} style={{
                padding: "12px 16px 12px 0",
                flexShrink: 0,
                alignItems: "stretch",
              }}>
                <SummaryPanel
                  summary={summary}
                  ready={ready}
                  searchItems={searchItems}
                  onStartSearch={handleStartSearch}
                  onReset={handleReset}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
