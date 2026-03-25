interface SearchBarProps {
  value: string;
  itemCount: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function SearchBar({ value, itemCount, onChange, onSubmit, disabled = false }: SearchBarProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label htmlFor="materials-input" className="mb-2 block text-sm font-semibold text-slate-700">
        Lista de materiais (1 item por linha)
      </label>

      <textarea
        id="materials-input"
        className="h-56 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        placeholder="Ex.: Fita isolante 20m"
        value={value}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Itens detectados: <strong>{itemCount}</strong> (máx. 20)
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Pesquisar preços
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Dica: quanto mais específica a descrição (marca, medida, modelo), melhores serão os resultados.
      </p>
    </section>
  );
}
