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
  | 'boolean'
  | 'html'; // Added html type for decorative elements or page breaks

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
  html?: string; // For 'html' type questions
};

type SurveyPage = {
  name: string;
  title?: string;
  description?: string;
  elements?: Question[];
};

type SurveyJson = {
  title?: string;
  pages: SurveyPage[];
  showWelcomePage?: boolean;
  welcomePage?: {
    title?: string;
    description?: string;
  };
  completedHtml?: string;
};

type SurveyStyle = {
  primaryColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  backgroundColor: string;
  cardBackgroundColor: string;
  questionTextColor: string;
  customCss: string;
  redirectUrl: string;
  redirectDelay: number;
};

const QTYPES: Array<{ v: QuestionType; l: string }> = [
  { v: 'text', l: 'Short Text' },
  { v: 'comment', l: 'Long Text' },
  { v: 'radiogroup', l: 'Single Choice' },
  { v: 'checkbox', l: 'Multiple Choice' },
  { v: 'dropdown', l: 'Dropdown' },
  { v: 'rating', l: 'Rating' },
  { v: 'boolean', l: 'Yes / No' },
  { v: 'html', l: 'HTML / Text Block' },
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
  showWelcomePage: false,
};

// -- Remote-DOM event helpers --------------------------------------------------
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

// -- Shared styles ------------------------------------------------------------─
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
    fontSize: '16px',
    color: T.textLight,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: '1',
    opacity: 0.6,
  },
  sbGroup: {
    paddingBottom: '8px',
    borderBottom: `1px solid ${T.borderLight}`,
  },
  sbSubHead: {
    padding: '12px 14px 6px',
    fontSize: '10px',
    fontWeight: 700,
    color: T.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addSmall: {
    background: 'none',
    border: 'none',
    color: T.accent,
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0 4px',
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

// -- ChoicesEditor ------------------------------------------------------------─

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
          x
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

// -- QuestionEditor ------------------------------------------------------------

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

      {question.type === 'html' && (
        <div style={S.fg}>
          <label style={S.label}>HTML Content</label>
          <textarea
            style={{ ...S.fi, minHeight: '120px', fontFamily: 'monospace' }}
            value={question.html ?? ''}
            placeholder="Enter HTML or plain text…"
            onChange={(ev) => upd('html', getEv(ev))}
          />
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

      {question.type !== 'html' && (
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
      )}
    </div>
  );
};

// -- Welcome & Completion Editors ---------------------------------------------

const WelcomeEditor = ({
  survey,
  onChange,
}: {
  survey: SurveyJson;
  onChange: (s: SurveyJson) => void;
}) => {
  const upd = (k: string, v: any) => {
    const welcomePage = { ...(survey.welcomePage || {}), [k]: v };
    onChange({ ...survey, welcomePage });
  };

  return (
    <div style={S.qEditor}>
      <div style={S.sectionHd}>Welcome Page</div>
      <div style={S.fg}>
        <label style={S.cbRow}>
          <input
            type="checkbox"
            checked={!!survey.showWelcomePage}
            onChange={(ev) => {
              const checked = getEvChecked(ev);
              onChange({
                ...survey,
                showWelcomePage: checked,
                welcomePage: (checked && !survey.welcomePage)
                  ? { 
                      title: survey.title || 'Welcome', 
                      description: 'Please take a moment to fill out this survey.' 
                    }
                  : survey.welcomePage
              });
            }}
            style={{ width: '15px', height: '15px', cursor: 'pointer' }}
          />
          Show Welcome Page
        </label>
      </div>

      {survey.showWelcomePage && (
        <>
          <div style={S.fg}>
            <label style={S.label}>Title</label>
            <input
              style={S.fi}
              value={survey.welcomePage?.title ?? ''}
              placeholder="Welcome to our survey"
              onChange={(ev) => upd('title', getEv(ev))}
            />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Description</label>
            <textarea
              style={{ ...S.fi, minHeight: '100px' }}
              value={survey.welcomePage?.description ?? ''}
              placeholder="Please take a few minutes to fill out…"
              onChange={(ev) => upd('description', getEv(ev))}
            />
          </div>
        </>
      )}
    </div>
  );
};

const CompletionEditor = ({
  survey,
  style,
  onSurveyChange,
  onStyleChange,
}: {
  survey: SurveyJson;
  style: SurveyStyle;
  onSurveyChange: (s: SurveyJson) => void;
  onStyleChange: (s: SurveyStyle) => void;
}) => {
  return (
    <div style={S.qEditor}>
      <div style={S.sectionHd}>Completion Page</div>
      <div style={S.fg}>
        <label style={S.label}>Success Message (HTML)</label>
        <textarea
          style={{ ...S.fi, minHeight: '150px' }}
          value={survey.completedHtml ?? ''}
          placeholder="Thank you for your response!"
          onChange={(ev) =>
            onSurveyChange({ ...survey, completedHtml: getEv(ev) })
          }
        />
      </div>

      <div style={{ ...S.sectionHd, marginTop: '24px' }}>Auto-Redirect</div>
      <div style={S.fg}>
        <label style={S.label}>Redirect URL (Optional)</label>
        <input
          style={S.fi}
          value={style.redirectUrl ?? ''}
          placeholder="https://example.com/thanks"
          onChange={(ev) => onStyleChange({ ...style, redirectUrl: getEv(ev) })}
        />
      </div>
      <div style={S.fg}>
        <label style={S.label}>Redirect Delay (Seconds)</label>
        <input
          type="number"
          style={S.fi}
          value={style.redirectDelay ?? 5}
          onChange={(ev) => onStyleChange({ ...style, redirectDelay: parseInt(getEv(ev)) || 0 })}
        />
        <p style={{ fontSize: '12px', color: T.textTertiary, marginTop: '4px' }}>
          Seconds to wait on the thank you page before redirecting.
        </p>
      </div>
    </div>
  );
};

const PageEditor = ({
  page,
  onChange,
}: {
  page: SurveyPage;
  onChange: (p: SurveyPage) => void;
}) => {
  const upd = (k: keyof SurveyPage, v: any) => onChange({ ...page, [k]: v });

  return (
    <div style={S.qEditor}>
      <div style={S.sectionHd}>Page Settings</div>
      <div style={S.fg}>
        <label style={S.label}>Page Title (optional)</label>
        <input
          style={S.fi}
          value={page.title ?? ''}
          placeholder="Enter page title…"
          onChange={(ev) => upd('title', getEv(ev))}
        />
      </div>
      <div style={S.fg}>
        <label style={S.label}>Page Description (optional)</label>
        <textarea
          style={{ ...S.fi, minHeight: '60px' }}
          value={page.description ?? ''}
          placeholder="Enter page description…"
          onChange={(ev) => upd('description', getEv(ev))}
        />
      </div>
    </div>
  );
};

// -- PreviewQuestion ----------------------------------------------------------─
// Renders a single question as a static preview (no survey-core dependency).

const PreviewQuestion = ({
  q,
  index,
  style,
}: {
  q: Question;
  index: number;
  style: SurveyStyle;
}) => {
  const labelStyle = {
    display: 'block',
    fontWeight: 700,
    marginBottom: '8px',
    color: style.questionTextColor || '#0f172a',
    fontSize: '15px',
  };
  const descStyle = { fontSize: '13px', color: '#64748b', marginBottom: '12px' };
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#1e293b',
    background: '#ffffff',
    boxSizing: 'border-box' as const,
  };
  const radioStyle = { marginRight: '10px', width: '16px', height: '16px', cursor: 'pointer' };
  const wrap = {
    marginBottom: '28px',
    paddingBottom: '28px',
    borderBottom: '1px solid #f1f5f9',
  };
  const title = q.title || q.name;
  const required = q.isRequired ? (
    <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
  ) : null;

  return (
    <div style={wrap}>
      {q.type === 'html' ? (
        <div
          dangerouslySetInnerHTML={{ __html: q.html ?? '' }}
          style={{ color: style.questionTextColor }}
        />
      ) : (
        <>
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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Array.from({ length: q.rateMax ?? 5 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: `1px solid ${style.primaryColor}`,
                    background: '#ffffff',
                    color: style.primaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {i + 1}
                </div>
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
        </>
      )}
    </div>
  );
};

// -- PreviewTab ----------------------------------------------------------------

const PreviewTab = ({
  surveyJson,
  style,
}: {
  surveyJson: SurveyJson;
  style: SurveyStyle;
}) => {
  return (
    <div
      style={{
        ...S.previewPane,
        background: style.backgroundColor || '#f0f4f8',
        padding: 0,
        display: 'block',
      }}
    >
      <div
        style={{
          background: style.headerBackgroundColor,
          color: style.headerTextColor,
          padding: '20px 24px',
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '-.02em',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>{surveyJson.title || 'Survey'}</span>
        <span
          style={{
            fontSize: '12px',
            opacity: 0.8,
            marginLeft: '12px',
            background: 'rgba(0,0,0,0.15)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Preview Mode
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 20px 80px',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            background: style.cardBackgroundColor || '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.05)',
            padding: '40px',
          }}
        >
          {/* Welcome section */}
          {surveyJson.showWelcomePage && surveyJson.welcomePage && (
            <div style={{ marginBottom: '40px', borderBottom: `2px solid ${style.primaryColor}22`, paddingBottom: '32px' }}>
              <h1 style={{ fontSize: '28px', color: style.questionTextColor, marginBottom: '12px' }}>
                {surveyJson.welcomePage.title || 'Welcome'}
              </h1>
              <p style={{ fontSize: '16px', color: '#64748b', lineHeight: '1.6' }}>
                {surveyJson.welcomePage.description}
              </p>
            </div>
          )}

          {/* Pages section */}
          {surveyJson.pages.map((page, pi) => (
            <div key={pi} style={{ 
              marginBottom: '48px',
              padding: '24px',
              border: `1px solid ${style.primaryColor}11`,
              borderRadius: '12px',
              background: `${style.primaryColor}05`
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '24px',
                borderBottom: `1px solid ${style.primaryColor}22`,
                paddingBottom: '12px'
              }}>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 700, 
                  color: style.primaryColor, 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Page {pi + 1}
                </span>
                {surveyJson.pages.length > 1 && (
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                    (Page Break)
                  </span>
                )}
              </div>
              
              {(page.title || page.description) && (
                <div style={{ marginBottom: '24px' }}>
                  {page.title && <h2 style={{ fontSize: '20px', color: style.questionTextColor, marginBottom: '8px' }}>{page.title}</h2>}
                  {page.description && <p style={{ fontSize: '14px', color: '#64748b' }}>{page.description}</p>}
                </div>
              )}
              {(page.elements ?? []).map((q, qi) => (
                <PreviewQuestion
                  key={q.name}
                  q={q}
                  index={qi}
                  style={style}
                />
              ))}
            </div>
          ))}

          {/* Completion section */}
          {surveyJson.completedHtml && (
            <div
              style={{
                marginTop: '40px',
                padding: '32px',
                background: `${style.primaryColor}08`,
                borderRadius: '12px',
                border: `1px dashed ${style.primaryColor}44`,
                textAlign: 'center',
              }}
            >
              <div
                style={{ fontSize: '18px', color: style.questionTextColor }}
                dangerouslySetInnerHTML={{ __html: surveyJson.completedHtml }}
              />
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', fontWeight: 600 }}>
                (Completion Message Preview)
              </div>
            </div>
          )}

          <button
            style={{
              marginTop: '32px',
              padding: '14px 32px',
              background: style.primaryColor,
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              transition: 'opacity 0.2s',
            }}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
};

// -- StyleTab ------------------------------------------------------------------

const StyleTab = ({
  style,
  onChange,
}: {
  style: SurveyStyle;
  onChange: (s: SurveyStyle) => void;
}) => {
  const upd = (k: keyof SurveyStyle, v: string) =>
    onChange({ ...style, [k]: v });

  return (
    <div style={S.previewPane}>
      <div style={S.previewCard}>
        <div style={S.sectionHd}>Theme Colors</div>

        <div style={S.fg}>
          <label style={S.label}>Primary Color (Buttons, Accents)</label>
          <input
            type="color"
            style={{ ...S.fi, height: '40px', padding: '4px' }}
            value={style.primaryColor}
            onChange={(e) => upd('primaryColor', getEv(e))}
          />
        </div>

        <div style={S.fg}>
          <label style={S.label}>Header Background Color</label>
          <input
            type="color"
            style={{ ...S.fi, height: '40px', padding: '4px' }}
            value={style.headerBackgroundColor}
            onChange={(e) => upd('headerBackgroundColor', getEv(e))}
          />
        </div>

        <div style={S.fg}>
          <label style={S.label}>Header Text Color</label>
          <input
            type="color"
            style={{ ...S.fi, height: '40px', padding: '4px' }}
            value={style.headerTextColor}
            onChange={(e) => upd('headerTextColor', getEv(e))}
          />
        </div>

        <div style={S.fg}>
          <label style={S.label}>Page Background Color</label>
          <input
            type="color"
            style={{ ...S.fi, height: '40px', padding: '4px' }}
            value={style.backgroundColor}
            onChange={(e) => upd('backgroundColor', getEv(e))}
          />
        </div>

        <div style={S.fg}>
          <label style={S.label}>Question Block Background</label>
          <input
            type="color"
            style={{ ...S.fi, height: '40px', padding: '4px' }}
            value={style.cardBackgroundColor}
            onChange={(e) => upd('cardBackgroundColor', getEv(e))}
          />
        </div>

        <div style={S.fg}>
          <label style={S.label}>Question Text Color</label>
          <input
            type="color"
            style={{ ...S.fi, height: '40px', padding: '4px' }}
            value={style.questionTextColor}
            onChange={(e) => upd('questionTextColor', getEv(e))}
          />
        </div>

        <div style={{ ...S.sectionHd, marginTop: '32px' }}>Advanced Styling</div>
        <div style={S.fg}>
          <label style={S.label}>Custom CSS</label>
          <textarea
            style={{
              ...S.fi,
              minHeight: '200px',
              fontFamily: "'Fira Code','Consolas',monospace",
            }}
            value={style.customCss}
            placeholder=".hdr { font-family: 'Comic Sans MS'; }"
            onChange={(e) => upd('customCss', getEv(e))}
          />
        </div>
      </div>
    </div>
  );
};


// -- Main component ------------------------------------------------------------

const SurveyBuilder = () => {
  const surveyId = useRecordId();
  const coreApiClient = useMemo(() => new CoreApiClient(), []);

  const [survey, setSurvey] = useState<SurveyJson>(DEFAULT_SURVEY_JSON);
  const [style, setStyle] = useState<SurveyStyle>({
    primaryColor: '#0070f3',
    headerBackgroundColor: '#0070f3',
    headerTextColor: '#ffffff',
    backgroundColor: '#f0f4f8',
    cardBackgroundColor: '#ffffff',
    questionTextColor: '#0f172a',
    customCss: '',
    redirectUrl: '',
    redirectDelay: 5,
  });

  // Updated selection state
  const [sel, setSel] = useState<{
    type: 'welcome' | 'page' | 'question' | 'completion' | null;
    pageIdx: number;
    qIdx: number | null;
  }>({ type: 'page', pageIdx: 0, qIdx: null });

  const [tab, setTab] = useState<'designer' | 'preview' | 'style' | 'json'>(
    'designer',
  );
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
            primaryColor: true,
            headerBackgroundColor: true,
            headerTextColor: true,
            backgroundColor: true,
            cardBackgroundColor: true,
            questionTextColor: true,
            customCss: true,
            redirectUrl: true,
            redirectDelay: true,
          },
        } as never);

        const surveyRecord = (result as { sm133788Survey?: { surveyJsJson?: string; primaryColor?: string; headerBackgroundColor?: string; headerTextColor?: string; backgroundColor?: string; cardBackgroundColor?: string; questionTextColor?: string; customCss?: string; redirectUrl?: string; redirectDelay?: number } })
          ?.sm133788Survey;
        const raw = surveyRecord?.surveyJsJson;

        if (!cancelled) {
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                if (parsed.showWelcomePage === undefined) {
                  parsed.showWelcomePage = false;
                }
                setSurvey(parsed as SurveyJson);
              }
            } catch (e) {
              console.error('[SurveyBuilder] Failed to parse survey JSON:', e);
            }
          }
          if (surveyRecord) {
            setStyle({
              primaryColor: surveyRecord.primaryColor || '#0070f3',
              headerBackgroundColor:
                surveyRecord.headerBackgroundColor || '#0070f3',
              headerTextColor: surveyRecord.headerTextColor || '#ffffff',
              backgroundColor: surveyRecord.backgroundColor || '#f0f4f8',
              cardBackgroundColor:
                surveyRecord.cardBackgroundColor || '#ffffff',
              questionTextColor: surveyRecord.questionTextColor || '#0f172a',
              customCss: surveyRecord.customCss || '',
              redirectUrl: surveyRecord.redirectUrl || '',
              redirectDelay: surveyRecord.redirectDelay ?? 5,
            });
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

  // Auto-save debounced sync
  const saveAll = (nextSurvey: SurveyJson, nextStyle: SurveyStyle) => {
    setSurvey(nextSurvey);
    setStyle(nextStyle);
    setSaveStatus('saving');

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await coreApiClient.mutation({
          updateSm133788Survey: {
            __args: {
              id: surveyId,
              data: {
                surveyJsJson: JSON.stringify(nextSurvey),
                name: nextSurvey.title,
                primaryColor: nextStyle.primaryColor,
                headerBackgroundColor: nextStyle.headerBackgroundColor,
                headerTextColor: nextStyle.headerTextColor,
                backgroundColor: nextStyle.backgroundColor,
                cardBackgroundColor: nextStyle.cardBackgroundColor,
                questionTextColor: nextStyle.questionTextColor,
                customCss: nextStyle.customCss,
                redirectUrl: nextStyle.redirectUrl,
                redirectDelay: nextStyle.redirectDelay,
              },
            },
            id: true,
          },
        } as any);
        setSaveStatus('saved');
      } catch (err) {
        console.error('[SurveyBuilder] save error:', err);
        setSaveStatus('error');
      }
    }, 1500);
  };

  const updateSurvey = (next: SurveyJson) => saveAll(next, style);
  const updateStyle = (next: SurveyStyle) => saveAll(survey, next);

  const addPage = () => {
    const newPage: SurveyPage = {
      name: `page${survey.pages.length + 1}`,
      elements: [],
    };
    updateSurvey({ ...survey, pages: [...survey.pages, newPage] });
    setSel({ type: 'page', pageIdx: survey.pages.length, qIdx: null });
  };

  const deletePage = (idx: number) => {
    if (survey.pages.length <= 1) return;
    const nextPages = survey.pages.filter((_, i) => i !== idx);
    updateSurvey({ ...survey, pages: nextPages });
    setSel({
      type: 'page',
      pageIdx: Math.max(0, idx - 1),
      qIdx: null,
    });
  };

  const addQuestion = (pageIdx: number) => {
    const q: Question = {
      type: 'text',
      name: `q_${Date.now()}`,
      title: `New Question`,
      isRequired: false,
    };
    const pages = survey.pages.map((p, i) =>
      i === pageIdx ? { ...p, elements: [...(p.elements ?? []), q] } : p,
    );
    updateSurvey({ ...survey, pages });
    setSel({
      type: 'question',
      pageIdx,
      qIdx: (survey.pages[pageIdx].elements ?? []).length,
    });
  };

  const deleteQuestion = (pageIdx: number, qIdx: number) => {
    const pages = survey.pages.map((p, i) => {
      if (i !== pageIdx) return p;
      return {
        ...p,
        elements: (p.elements ?? []).filter((_, qi) => qi !== qIdx),
      };
    });
    updateSurvey({ ...survey, pages });
    setSel({ type: 'page', pageIdx, qIdx: null });
  };

  const updateQuestion = (pageIdx: number, qIdx: number, updated: Question) => {
    const pages = survey.pages.map((p, i) => {
      if (i !== pageIdx) return p;
      return {
        ...p,
        elements: (p.elements ?? []).map((el, qi) => (qi === qIdx ? updated : el)),
      };
    });
    updateSurvey({ ...survey, pages });
  };

  const updatePage = (pageIdx: number, updated: SurveyPage) => {
    const pages = survey.pages.map((p, i) => (i === pageIdx ? updated : p));
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

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'error'
        ? 'Save failed'
        : 'Saved';

  return (
    <div style={S.root}>
      {/* Tab bar */}
      <div style={S.tabBar}>
        {(['designer', 'preview', 'style', 'json'] as const).map((t) => (
          <div
            key={t}
            style={S.tab(tab === t)}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
        <div style={S.badge(saveStatus)}>{saveLabel}</div>
        <a
          href={(() => {
            let base = '';
            try {
              if (typeof window !== 'undefined' && window.location?.origin) {
                base = window.location.origin.replace(':3001', ':3000');
              }
            } catch (e) {}
            return `${base}/s/survey-page?surveyId=${surveyId}&preview=true`;
          })()}
          target="_blank"
          style={{
            ...S.addBtn,
            textDecoration: 'none',
            marginLeft: 'auto',
            marginRight: '0',
            padding: '6px 12px',
            fontSize: '12px',
            background: T.bgTertiary,
            color: T.textPrimary,
            border: `1px solid ${T.borderMedium}`,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Test Link
        </a>
      </div>

      {/* Designer */}
      {tab === 'designer' && (
        <div style={S.designer}>
          {/* Sidebar */}
          <div style={S.sidebar}>
            <div style={S.sbHead}>Project Structure</div>
            <div style={S.qList}>
              {/* Special Pages */}
              <div style={S.sbGroup}>
                <div style={S.sbSubHead}>Special Pages</div>
                <div
                  style={S.qCard(sel.type === 'welcome')}
                  onClick={() => setSel({ type: 'welcome', pageIdx: 0, qIdx: null })}
                >
                  <span style={S.qName}>Welcome Page</span>
                </div>
                <div
                  style={S.qCard(sel.type === 'completion')}
                  onClick={() => setSel({ type: 'completion', pageIdx: 0, qIdx: null })}
                >
                  <span style={S.qName}>Completion Page</span>
                </div>
              </div>

              {/* Pages & Questions */}
              {survey.pages.map((p, pi) => (
                <div key={pi} style={S.sbGroup}>
                  <div style={S.sbSubHead}>
                    <span>Page {pi + 1}</span>
                    <button
                      style={S.addSmall}
                      onClick={() => deletePage(pi)}
                      title="Delete Page"
                    >
                      Delete
                    </button>
                  </div>
                  <div
                    style={S.qCard(sel.type === 'page' && sel.pageIdx === pi)}
                    onClick={() => setSel({ type: 'page', pageIdx: pi, qIdx: null })}
                  >
                    <span style={S.qName}>Page Settings</span>
                  </div>
                  {(p.elements ?? []).map((q, qi) => (
                    <div
                      key={q.name}
                      style={S.qCard(sel.type === 'question' && sel.pageIdx === pi && sel.qIdx === qi)}
                      onClick={() => setSel({ type: 'question', pageIdx: pi, qIdx: qi })}
                    >
                      <span style={{ ...S.qNum, fontSize: '10px' }}>{qi + 1}</span>
                      <span style={S.qName}>{q.title || q.name}</span>
                      <button
                        style={S.qDel}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          deleteQuestion(pi, qi);
                        }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    style={{ ...S.addChoiceBtn, borderStyle: 'solid', margin: '4px 10px', width: 'auto' }}
                    onClick={() => addQuestion(pi)}
                  >
                    + Add Question
                  </button>
                </div>
              ))}
            </div>
            <button style={S.addBtn} onClick={addPage}>
              + Add New Page
            </button>
          </div>

          {/* Editor pane */}
          <div style={S.editorPane}>
            {/* Survey title only shown on page/question selection for context? Or always? */}
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

            {/* Contextual Editor */}
            {sel.type === 'welcome' && (
              <WelcomeEditor survey={survey} onChange={updateSurvey} />
            )}
            {sel.type === 'completion' && (
              <CompletionEditor 
                survey={survey} 
                style={style}
                onSurveyChange={updateSurvey}
                onStyleChange={updateStyle}
              />
            )}
            {sel.type === 'page' && (
              <PageEditor
                page={survey.pages[sel.pageIdx]}
                onChange={(p) => updatePage(sel.pageIdx, p)}
              />
            )}
            {sel.type === 'question' && sel.qIdx !== null && (
              <QuestionEditor
                question={survey.pages[sel.pageIdx].elements![sel.qIdx]}
                onChange={(q) => updateQuestion(sel.pageIdx, sel.qIdx!, q)}
              />
            )}
            {!sel.type && (
              <div style={S.emptyHint}>
                Select an element from the sidebar to edit.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {tab === 'preview' && <PreviewTab surveyJson={survey} style={style} />}

      {/* Style */}
      {tab === 'style' && <StyleTab style={style} onChange={updateStyle} />}

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
