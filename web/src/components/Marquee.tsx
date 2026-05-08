import { cn } from "@/lib/utils";

const logos = [
  "EstoqueAtacadista", "Megaleste", "Cofema", "SuperABC",
  "DepósitoPro", "ObraFácil", "AtacadãoConstrução", "RevendaMais",
];

export default function Marquee({ reverse = false }: { reverse?: boolean }) {
  const items = [...logos, ...logos];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
      <div className={cn(
        "flex w-max gap-12 py-4",
        reverse ? "animate-marquee-rev" : "animate-marquee"
      )}>
        {items.map((name, i) => (
          <span key={i}
            className="whitespace-nowrap text-[13px] font-semibold text-white/25 tracking-wide uppercase">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
