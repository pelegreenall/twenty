import { useEffect, useMemo, useRef, useState } from 'react';
import { defineFrontComponent, useRecordId } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';

// Front components run inside a remote-dom Web Worker — all React elements are
// proxied to real DOM elements by the host renderer. No iframe tricks needed;
// we just write a normal React component with inline styles.

type QuestionType =
  | 'text'
  | 'comment'
  | 'radiogroup'
  | 'checkbox'
  | 'dropdown'
  | 'rating'
  | 'boolean';

type Choice = { value: string; text: string };

type Question = {
  type: QuestionType;
  name: string;
  title?: string;
  description?: string;
  isRequired?: boolean;
  inputType?: string;
  choices?: Choice[];
  rateMax?: number;
};

type SurveyJson = {
  title?: string;
  pages: Array<{ name: string; elements?: Question[] }>;
};

const QTYPES: Array<{ v: QuestionType; l: string }> = [
  { v: 'text', l: 'Short Text' },
  { v: 'comment', l: 'Long Text' },
  { v: 'radiogroup', l: 'Single Choice' },
  { v: 'checkbox', l: 'Multiple Choice' },
  { v: 'dropdown', l: 'Dropdown' },
  { v: 'rating', l: 'Rating' },
  { v: 'boolean', l: 'Yes / No' },
];

const QTYPE_LABEL: Record<string, string> = Object.fromEntries(
  QTYPES.map((t) => [t.v, t.l]),
);

const HAS_CHOICES = new Set<QuestionType>([
  'radiogroup',
  'checkbox',
  'dropdown',
]);

const DEFAULT_SURVEY_JSON: SurveyJson = {
  title: 'New Survey',
  pages: [
    {
      name: 'page1',
      elements: [
        {
          type: 'text',
          name: 'question1',
          title: 'Sample question',
        },
      ],
    },
  ],
};

// ── Remote-DOM event helpers ──────────────────────────────────────────────────
// In the remote-dom Web Worker, onChange receives a RemoteEvent<SerializedEventData>
// (extends CustomEvent). The new value lives in ev.detail.value, not ev.target.value.

const getEv = (ev: unknown): string => {
  const e = ev as { detail?: { value?: string }; target?: { value?: string } };
  return e?.detail?.value ?? e?.target?.value ?? '';
};

const getEvChecked = (ev: unknown): boolean => {
  const e = ev as {
    detail?: { checked?: boolean };
    target?: { checked?: boolean };
  };
  return e?.detail?.checked ?? e?.target?.checked ?? false;
};

// ── Shared styles ─────────────────────────────────────────────────────────────
// Colors reference Twenty's CSS custom properties so they automatically adapt
// to light/dark mode without any extra logic.

const T = {
  // backgrounds
  bgPrimary: 'var(--t-background-primary)',
  bgSecondary: 'var(--t-background-secondary)',
  bgTertiary: 'var(--t-background-tertiary)',
  bgTransparentBlue: 'var(--t-background-transparent-blue)',
  bgTransparentMedium: 'var(--t-background-transparent-medium)',
  // text / font
  textPrimary: 'var(--t-font-color-primary)',
  textSecondary: 'var(--t-font-color-secondary)',
  textTertiary: 'var(--t-font-color-tertiary)',
  textLight: 'var(--t-font-color-light)',
  textInverted: 'var(--t-font-color-inverted)',
  // borders
  borderMedium: 'var(--t-border-color-medium)',
  borderLight: 'var(--t-border-color-light)',
  borderBlue: 'var(--t-border-color-blue)',
  // accent (Twenty's primary blue)
  accent: 'var(--t-accent-primary)',
  accentBg: 'var(--t-background-transparent-blue)',
  // status badge colours (hardcoded — not theme-sensitive by design)
  savedBg: '#d1fae5',
  savedText: '#065f46',
  savingBg: '#fef3c7',
  savingText: '#92400e',
  errorBg: '#fee2e2',
  errorText: '#991b1b',
  // danger
  danger: 'var(--t-font-color-danger)',
  // font family
  fontFamily: 'var(--t-font-family)',
} as const;

const S = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    fontFamily: T.fontFamily,
    fontSize: '14px',
    color: T.textPrimary,
    background: T.bgSecondary,
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    background: T.bgPrimary,
    borderBottom: `1px solid ${T.borderMedium}`,
    padding: '0 12px',
    flexShrink: 0,
    alignItems: 'center',
    minHeight: '42px',
  },
  tab: (active: boolean) => ({
    padding: '11px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: active ? T.accent : T.textTertiary,
    borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
    fontWeight: active ? (500 as const) : (400 as const),
    userSelect: 'none' as const,
    transition: 'color .15s',
  }),
  badge: (status: 'saved' | 'saving' | 'error') => ({
    marginLeft: 'auto',
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontWeight: 500,
    background:
      status === 'saved'
        ? T.savedBg
        : status === 'saving'
          ? T.savingBg
          : T.errorBg,
    color:
      status === 'saved'
        ? T.savedText
        : status === 'saving'
          ? T.savingText
          : T.errorText,
  }),
  designer: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    background: T.bgPrimary,
    borderRight: `1px solid ${T.borderMedium}`,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  sbHead: {
    padding: '10px 14px',
    borderBottom: `1px solid ${T.borderLight}`,
    fontSize: '11px',
    fontWeight: 700,
    color: T.textLight,
    letterSpacing: '.8px',
    textTransform: 'uppercase' as const,
  },
  qList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 6px',
  },
  qCard: (selected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: selected ? `1px solid ${T.borderBlue}` : '1px solid transparent',
    background: selected ? T.bgTransparentBlue : 'transparent',
    marginBottom: '3px',
  }),
  qNum: {
    fontSize: '11px',
    fontWeight: 700,
    color: T.textLight,
    minWidth: '18px',
  },
  qName: {
    flex: 1,
    fontSize: '13px',
    color: T.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  qType: {
    fontSize: '11px',
    color: T.textLight,
    flexShrink: 0,
  },
  qDel: {
    background: 'none',
    border: 'none',
    fontSize: '17px',
    color: T.textLight,
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: '1',
  },
  addBtn: {
    margin: '8px',
    padding: '9px',
    background: T.accent,
    color: T.textInverted,
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  editorPane: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '18px 22px',
  },
  titleWrap: {
    background: T.bgPrimary,
    borderRadius: '8px',
    padding: '14px 18px',
    marginBottom: '16px',
    border: `1px solid ${T.borderLight}`,
  },
  titleInput: {
    fontSize: '20px',
    fontWeight: 700,
    border: 'none',
    outline: 'none',
    width: '100%',
    color: T.textPrimary,
    background: 'transparent',
  },
  qEditor: {
    background: T.bgPrimary,
    borderRadius: '8px',
    padding: '18px',
    border: `1px solid ${T.borderLight}`,
  },
  sectionHd: {
    fontSize: '12px',
    fontWeight: 700,
    color: T.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '.6px',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${T.borderLight}`,
  },
  fg: { marginBottom: '14px' },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: T.textTertiary,
    marginBottom: '5px',
    letterSpacing: '.3px',
  },
  fi: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${T.borderMedium}`,
    borderRadius: '6px',
    fontSize: '14px',
    color: T.textPrimary,
    background: T.bgPrimary,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  choiceRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    marginBottom: '6px',
  },
  delChoice: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: T.textLight,
    cursor: 'pointer',
    padding: '0',
    lineHeight: '1',
  },
  addChoiceBtn: {
    padding: '7px',
    background: T.bgSecondary,
    border: `1px dashed ${T.borderMedium}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: T.textTertiary,
    width: '100%',
    marginTop: '4px',
  },
  cbRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: T.textPrimary,
    cursor: 'pointer',
  },
  emptyHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '120px',
    color: T.textLight,
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  previewPane: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
    background: T.bgSecondary,
  },
  previewCard: {
    maxWidth: '700px',
    margin: '0 auto',
    background: T.bgPrimary,
    borderRadius: '10px',
    border: `1px solid ${T.borderLight}`,
    overflow: 'hidden',
    padding: '24px',
  },
  jsonPane: {
    flex: 1,
    overflow: 'auto',
    padding: '14px',
    background: '#1e1e1e',
  },
  pre: {
    color: '#d4d4d4',
    fontSize: '12.5px',
    lineHeight: '1.6',
    fontFamily: "'Fira Code','Consolas',monospace",
    whiteSpace: 'pre-wrap' as const,
    margin: 0,
  },
};

// ── ChoicesEditor ─────────────────────────────────────────────────────────────

const ChoicesEditor = ({
  choices,
  onChange,
}: {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}) => (
  <div>
    {choices.map((c, i) => (
      <div key={i} style={S.choiceRow}>
        <input
          style={{ ...S.fi, flex: 1 }}
          value={c.text || c.value || ''}
          placeholder={`Option ${i + 1}`}
          onChange={(ev) => {
            const v = getEv(ev);
            onChange(
              choices.map((x, xi) =>
                xi === i ? { value: v, text: v } : x,
              ),
            );
          }}
        />
        <button
          style={S.delChoice}
          onClick={() => onChange(choices.filter((_, xi) => xi !== i))}
        >
          ×
        </button>
      </div>
    ))}
    <button
      style={S.addChoiceBtn}
      onClick={() =>
        onChange([
          ...choices,
          {
            value: `item${choices.length + 1}`,
            text: `Option ${choices.length + 1}`,
          },
        ])
      }
    >
      + Add option
    </button>
  </div>
);

// ── QuestionEditor ────────────────────────────────────────────────────────────

const QuestionEditor = ({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) => {
  const upd = (k: keyof Question, v: unknown) => {
    const nq = { ...question, [k]: v } as Question;
    if (k === 'type' && HAS_CHOICES.has(v as QuestionType) && !nq.choices) {
      nq.choices = [
        { value: 'item1', text: 'Option 1' },
        { value: 'item2', text: 'Option 2' },
      ];
    }
    onChange(nq);
  };

  return (
    <div style={S.qEditor}>
      <div style={S.sectionHd}>
        {QTYPE_LABEL[question.type] ?? question.type} Question
      </div>

      <div style={S.fg}>
        <label style={S.label}>Question text</label>
        <input
          style={S.fi}
          value={question.title ?? ''}
          placeholder="Enter question…"
          onChange={(ev) => upd('title', getEv(ev))}
        />
      </div>

      <div style={S.fg}>
        <label style={S.label}>Type</label>
        <select
          style={S.fi}
          value={question.type}
          onChange={(ev) => upd('type', getEv(ev) as QuestionType)}
        >
          {QTYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </select>
      </div>

      {question.type === 'text' && (
        <div style={S.fg}>
          <label style={S.label}>Input format</label>
          <select
            style={S.fi}
            value={question.inputType ?? 'text'}
            onChange={(ev) => upd('inputType', getEv(ev))}
          >
            {['text', 'email', 'number', 'date', 'url'].map((v) => (
              <option key={v} value={v}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {HAS_CHOICES.has(question.type) && (
        <div style={S.fg}>
          <label style={S.label}>Options</label>
          <ChoicesEditor
            choices={question.choices ?? []}
            onChange={(v) => upd('choices', v)}
          />
        </div>
      )}

      {question.type === 'rating' && (
        <div style={S.fg}>
          <label style={S.label}>Max stars</label>
          <select
            style={S.fi}
            value={question.rateMax ?? 5}
            onChange={(ev) => upd('rateMax', Number(getEv(ev)))}
          >
            {[3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n} stars
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={S.fg}>
        <label style={S.label}>Description (optional)</label>
        <input
          style={S.fi}
          value={question.description ?? ''}
          placeholder="Helper text shown under the question…"
          onChange={(ev) => upd('description', getEv(ev))}
        />
      </div>

      <div style={S.fg}>
        <label style={S.cbRow}>
          <input
            type="checkbox"
            checked={!!question.isRequired}
            onChange={(ev) => upd('isRequired', getEvChecked(ev))}
            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
          />
          Required
        </label>
      </div>
    </div>
  );
};

// ── PreviewQuestion ───────────────────────────────────────────────────────────
// Renders a single question as a static preview (no survey-core dependency).

const PreviewQuestion = ({
  q,
  index,
}: {
  q: Question;
  index: number;
}) => {
  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    marginBottom: '6px',
    color: T.textPrimary,
  };
  const descStyle = { fontSize: '13px', color: T.textTertiary, marginBottom: '8px' };
  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${T.borderMedium}`,
    borderRadius: '6px',
    fontSize: '14px',
    color: T.textPrimary,
    background: T.bgPrimary,
    boxSizing: 'border-box' as const,
  };
  const radioStyle = { marginRight: '8px' };
  const wrap = {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: `1px solid ${T.borderLight}`,
  };
  const title = q.title || q.name;
  const required = q.isRequired ? (
    <span style={{ color: T.danger, marginLeft: '2px' }}>*</span>
  ) : null;

  return (
    <div style={wrap}>
      <label style={labelStyle}>
        {index + 1}. {title}
        {required}
      </label>
      {q.description && <div style={descStyle}>{q.description}</div>}

      {(q.type === 'text' || q.type === 'comment') &&
        (q.type === 'comment' ? (
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder="Your answer…"
          />
        ) : (
          <input
            type={q.inputType ?? 'text'}
            style={inputStyle}
            placeholder="Your answer…"
          />
        ))}

      {(q.type === 'radiogroup' || q.type === 'checkbox') &&
        (q.choices ?? []).map((c, ci) => (
          <label
            key={ci}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '6px',
              cursor: 'pointer',
            }}
          >
            <input
              type={q.type === 'radiogroup' ? 'radio' : 'checkbox'}
              name={`preview_${q.name}`}
              style={radioStyle}
            />
            {c.text || c.value}
          </label>
        ))}

      {q.type === 'dropdown' && (
        <select style={inputStyle} defaultValue="">
          <option value="">Select…</option>
          {(q.choices ?? []).map((c, ci) => (
            <option key={ci} value={c.value}>
              {c.text || c.value}
            </option>
          ))}
        </select>
      )}

      {q.type === 'rating' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {Array.from({ length: q.rateMax ?? 5 }, (_, i) => (
            <button
              key={i}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: `1px solid ${T.borderMedium}`,
                background: T.bgPrimary,
                color: T.textPrimary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {q.type === 'boolean' && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Yes', 'No'].map((opt) => (
            <label
              key={opt}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <input type="radio" name={`preview_${q.name}`} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── PreviewTab ────────────────────────────────────────────────────────────────

const PreviewTab = ({ surveyJson }: { surveyJson: SurveyJson }) => {
  const questions = (surveyJson.pages ?? []).flatMap((p) => p.elements ?? []);

  return (
    <div style={S.previewPane}>
      <div style={S.previewCard}>
        {surveyJson.title && (
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 700,
              marginBottom: '20px',
              color: T.textPrimary,
            }}
          >
            {surveyJson.title}
          </h2>
        )}
        {questions.length === 0 ? (
          <div style={S.emptyHint}>
            No questions yet. Switch to Designer to add some.
          </div>
        ) : (
          questions.map((q, i) => (
            <PreviewQuestion key={q.name} q={q} index={i} />
          ))
        )}
        {questions.length > 0 && (
          <button
            style={{
              padding: '10px 24px',
              background: T.accent,
              color: T.textInverted,
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
};

// ── flatQuestions helper ──────────────────────────────────────────────────────

const flatQuestions = (survey: SurveyJson): Question[] =>
  (survey.pages ?? []).flatMap((p) => p.elements ?? []);

// ── Main component ────────────────────────────────────────────────────────────

const SurveyBuilder = () => {
  const surveyId = useRecordId();
  const coreApiClient = useMemo(() => new CoreApiClient(), []);

  const [survey, setSurvey] = useState<SurveyJson>(DEFAULT_SURVEY_JSON);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<'designer' | 'preview' | 'json'>('designer');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>(
    'saved',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing survey JSON on mount
  useEffect(() => {
    if (!surveyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = await coreApiClient.query({
          sm133788Survey: {
            __args: { filter: { id: { eq: surveyId } } },
            id: true,
            surveyJsJson: true,
          },
        } as never);

        const raw = (result as { sm133788Survey?: { surveyJsJson?: string } })
          ?.sm133788Survey?.surveyJsJson;

        if (!cancelled) {
          if (raw) {
            try {
              setSurvey(JSON.parse(raw) as SurveyJson);
            } catch {
              // malformed JSON — start fresh
            }
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('[SurveyBuilder] load error:', err);
        if (!cancelled) {
          setError(`Failed to load survey data: ${String(err)}`);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [surveyId, coreApiClient]);

  // Auto-save with 1.5 s debounce
  const updateSurvey = (next: SurveyJson) => {
    setSurvey(next);
    setSaveStatus('saving');

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await coreApiClient.mutation({
          updateSm133788Survey: {
            __args: {
              id: surveyId,
              data: { 
                surveyJsJson: JSON.stringify(next),
                name: next.title,
              },
            },
            id: true,
          },
        } as any);
        setSaveStatus('saved');
      } catch (err) {
        console.error('[SurveyBuilder] save error full object:', JSON.stringify(err, null, 2));
        console.error('[SurveyBuilder] save error:', err);
        setSaveStatus('error');
      }
    }, 1500);
  };

  const questions = flatQuestions(survey);

  const addQuestion = () => {
    const q: Question = {
      type: 'text',
      name: `q_${Date.now()}`,
      title: `Question ${questions.length + 1}`,
      isRequired: false,
    };
    const pages = survey.pages.map((p, i) =>
      i === 0 ? { ...p, elements: [...(p.elements ?? []), q] } : p,
    );
    updateSurvey({ ...survey, pages });
    setSelIdx(questions.length);
  };

  const deleteQuestion = (idx: number) => {
    let c = 0;
    const pages = survey.pages.map((p) => ({
      ...p,
      elements: (p.elements ?? []).filter(() => c++ !== idx),
    }));
    updateSurvey({ ...survey, pages });
    setSelIdx((prev) => {
      if (prev === null) return null;
      const nlen = questions.length - 1;
      if (nlen <= 0) return null;
      return Math.min(prev, nlen - 1);
    });
  };

  const updateQuestion = (idx: number, updated: Question) => {
    let c = 0;
    const pages = survey.pages.map((p) => ({
      ...p,
      elements: (p.elements ?? []).map((el) => (c++ === idx ? updated : el)),
    }));
    updateSurvey({ ...survey, pages });
  };

  if (!surveyId) {
    return (
      <div style={{ padding: '20px', color: '#666' }}>
        Open a specific survey record to edit it.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', color: '#999' }}>Loading builder…</div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#c00' }}>{error}</div>
    );
  }

  const selQ = selIdx !== null ? questions[selIdx] : null;
  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'error'
        ? 'Save failed'
        : 'Saved ✓';

  return (
    <div style={S.root}>
      {/* Tab bar */}
      <div style={S.tabBar}>
        {(['designer', 'preview', 'json'] as const).map((t) => (
          <div
            key={t}
            style={S.tab(tab === t)}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
        <div style={S.badge(saveStatus)}>{saveLabel}</div>
      </div>

      {/* Designer */}
      {tab === 'designer' && (
        <div style={S.designer}>
          {/* Sidebar */}
          <div style={S.sidebar}>
            <div style={S.sbHead}>Questions ({questions.length})</div>
            <div style={S.qList}>
              {questions.length === 0 ? (
                <div
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: T.textLight,
                    fontSize: '13px',
                    lineHeight: '1.6',
                  }}
                >
                  No questions yet.
                  <br />
                  Click &quot;+ Add Question&quot; to begin.
                </div>
              ) : (
                questions.map((q, i) => (
                  <div
                    key={q.name}
                    style={S.qCard(selIdx === i)}
                    onClick={() => setSelIdx(i)}
                  >
                    <span style={S.qNum}>{i + 1}</span>
                    <span style={S.qName}>{q.title || q.name}</span>
                    <span style={S.qType}>
                      {QTYPE_LABEL[q.type] ?? q.type}
                    </span>
                    <button
                      style={S.qDel}
                      title="Delete"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        deleteQuestion(i);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <button style={S.addBtn} onClick={addQuestion}>
              + Add Question
            </button>
          </div>

          {/* Editor pane */}
          <div style={S.editorPane}>
            {/* Survey title */}
            <div style={S.titleWrap}>
              <input
                style={S.titleInput}
                value={survey.title ?? ''}
                placeholder="Survey title…"
                onChange={(ev) =>
                  updateSurvey({ ...survey, title: getEv(ev) })
                }
              />
            </div>

            {/* Question editor */}
            {selQ ? (
              <QuestionEditor
                question={selQ}
                onChange={(q) => updateQuestion(selIdx!, q)}
              />
            ) : (
              <div style={S.emptyHint}>
                Select a question to edit, or add a new one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {tab === 'preview' && <PreviewTab surveyJson={survey} />}

      {/* JSON */}
      {tab === 'json' && (
        <div style={S.jsonPane}>
          <pre style={S.pre}>{JSON.stringify(survey, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000009',
  name: 'survey-builder',
  description: 'Visual builder for survey questions',
  component: SurveyBuilder,
});
