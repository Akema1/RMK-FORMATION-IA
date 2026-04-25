interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export function ConsentCheckbox({
  checked,
  onChange,
  error,
}: ConsentCheckboxProps) {
  return (
    <div>
      <label
        htmlFor="consent"
        className="flex items-start gap-2 text-sm text-slate-700"
      >
        <input
          id="consent"
          name="consent"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          J'accepte les{" "}
          <a
            href="/cgu"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            CGU
          </a>{" "}
          et la{" "}
          <a
            href="/confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </span>
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
