import { useId, useMemo, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { LIMITS, normalizeDecision, PRESETS, type ValidationIssue } from '../engine';
import { altColor } from '../lib/colors';

export interface FormState {
  dilemma: string;
  useCustom: boolean;
  alternatives: string[];
}

export const EMPTY_FORM: FormState = { dilemma: '', useCustom: false, alternatives: ['', ''] };

interface IntakeFormProps {
  form: FormState;
  onChange: (form: FormState) => void;
  onSubmit: () => void;
  issues: ValidationIssue[];
}

export function IntakeForm({ form, onChange, onSubmit, issues }: IntakeFormProps) {
  const dilemmaId = useId();
  const dilemmaErrId = useId();
  const altErrId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(
    () => normalizeDecision({ dilemma: form.dilemma, alternatives: form.useCustom ? form.alternatives : undefined }),
    [form],
  );

  const dilemmaIssues = issues.filter((i) => i.field === 'dilemma');
  const altIssues = issues.filter((i) => i.field === 'alternatives');
  const length = form.dilemma.trim().length;
  const over = length > LIMITS.dilemmaMax;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  const setAlt = (i: number, value: string) => {
    const alternatives = form.alternatives.slice();
    alternatives[i] = value;
    onChange({ ...form, alternatives });
  };

  const removeAlt = (i: number) => {
    const alternatives = form.alternatives.filter((_, k) => k !== i);
    onChange({ ...form, alternatives: alternatives.length ? alternatives : [''] });
  };

  return (
    <form className="intake panel" onSubmit={submit} noValidate aria-labelledby="intake-title">
      <div className="sticker sticker-left">FORM OE-1 · PETITION FOR DELIBERATION</div>
      <h2 id="intake-title" className="intake-title">
        State your <span className="scribble">trivial</span> dilemma
      </h2>
      <p className="intake-sub">
        Twelve deterministic specialists, a 10,000-universe Monte Carlo simulation and one decision tree are standing by.
      </p>

      <label htmlFor={dilemmaId} className="field-label">
        Your dilemma
      </label>
      <div className={`textarea-wrap ${dilemmaIssues.length || over ? 'has-error' : ''}`}>
        <textarea
          id={dilemmaId}
          ref={textRef}
          value={form.dilemma}
          onChange={(e) => onChange({ ...form, dilemma: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="Should I order samosa or vada pav?"
          rows={3}
          aria-invalid={dilemmaIssues.length > 0 || over}
          aria-describedby={`${dilemmaErrId} ${dilemmaId}-count`}
        />
        <span id={`${dilemmaId}-count`} className={`char-count ${over ? 'over' : ''}`} aria-live="polite">
          {length}/{LIMITS.dilemmaMax}
        </span>
      </div>
      <div id={dilemmaErrId} className="field-error" role={dilemmaIssues.length ? 'alert' : undefined}>
        {dilemmaIssues.map((i) => (
          <p key={i.message}>✖ {i.message}</p>
        ))}
      </div>

      <fieldset className="presets">
        <legend className="field-label">Or pick a certified crisis</legend>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`chip ${form.dilemma === p.dilemma ? 'chip-active' : ''}`}
              aria-pressed={form.dilemma === p.dilemma}
              onClick={() => {
                onChange({
                  dilemma: p.dilemma,
                  useCustom: !!p.alternatives,
                  alternatives: p.alternatives ? [...p.alternatives] : ['', ''],
                });
                textRef.current?.focus();
              }}
            >
              <span aria-hidden="true">{p.emoji}</span> {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="custom-toggle">
        <label className="switch">
          <input
            type="checkbox"
            checked={form.useCustom}
            onChange={(e) => onChange({ ...form, useCustom: e.target.checked })}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>Specify alternatives manually</span>
        </label>
      </div>

      {form.useCustom && (
        <fieldset className="custom-alts" aria-describedby={altErrId}>
          <legend className="field-label">
            Alternatives ({form.alternatives.length}/{LIMITS.maxAlternatives})
          </legend>
          {form.alternatives.map((alt, i) => (
            <div className="alt-row" key={i}>
              <span className="alt-dot" style={{ background: altColor(i) }} aria-hidden="true" />
              <input
                type="text"
                value={alt}
                maxLength={LIMITS.alternativeMax + 20}
                onChange={(e) => setAlt(i, e.target.value)}
                placeholder={`Alternative ${i + 1}`}
                aria-label={`Alternative ${i + 1}`}
                aria-invalid={alt.trim().length > LIMITS.alternativeMax}
              />
              <span className={`char-count small ${alt.trim().length > LIMITS.alternativeMax ? 'over' : ''}`}>
                {alt.trim().length}/{LIMITS.alternativeMax}
              </span>
              <button type="button" className="btn-icon" onClick={() => removeAlt(i)} aria-label={`Remove alternative ${i + 1}`}>
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onChange({ ...form, alternatives: [...form.alternatives, ''] })}
            disabled={form.alternatives.length >= LIMITS.maxAlternatives}
          >
            + Add alternative
          </button>
          <p className="hint">Blank alternatives are ignored. With fewer than two, the Council adds “Do absolutely nothing”.</p>
          <div id={altErrId} className="field-error" role={altIssues.length ? 'alert' : undefined}>
            {altIssues.map((i) => (
              <p key={i.message}>✖ {i.message}</p>
            ))}
          </div>
        </fieldset>
      )}

      <div className="preview" aria-live="polite">
        <span className="field-label">The Council will consider:</span>
        {preview.ok ? (
          <>
            <div className="preview-chips">
              {preview.decision.alternatives.map((a, i) => (
                <span key={a.id} className="alt-chip" style={{ ['--alt' as string]: altColor(i) }}>
                  {a.label}
                  {a.synthetic && <em> (invented)</em>}
                </span>
              ))}
            </div>
            {preview.decision.notes.length > 0 && (
              <ul className="preview-notes">
                {preview.decision.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="preview-empty">Nothing yet. The specialists are idling expensively.</p>
        )}
      </div>

      <button type="submit" className="btn btn-analyze">
        <span>ANALYZE</span>
        <small>Ctrl + Enter · commence overthinking</small>
      </button>
    </form>
  );
}
