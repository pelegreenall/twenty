import { useCallback, useEffect, useState, useMemo } from 'react';
import { defineFrontComponent, useRecordId } from 'twenty-sdk';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

// ── Theme tokens ──────────────────────────────────────────────────────────────

const T = {
  bgPrimary: 'var(--t-background-primary)',
  bgSecondary: 'var(--t-background-secondary)',
  bgTertiary: 'var(--t-background-tertiary)',
  textPrimary: 'var(--t-font-color-primary)',
  textSecondary: 'var(--t-font-color-secondary)',
  textLight: 'var(--t-font-color-light)',
  textInverted: 'var(--t-font-color-inverted)',
  borderMedium: 'var(--t-border-color-medium)',
  borderLight: 'var(--t-border-color-light)',
  accent: 'var(--t-accent-primary)',
  fontFamily: 'var(--t-font-family)',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatAnswer = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// ── Component ─────────────────────────────────────────────────────────────────

const ResultsWidget = () => {
  const surveyId = useRecordId();
  const metadataApiClient = useMemo(() => new MetadataApiClient(), []);

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    setError(null);
    try {
      const manifest = await metadataApiClient.query({
        findManyLogicFunctions: { id: true, name: true },
      } as any);
      const func = (manifest as any)?.findManyLogicFunctions?.find(
        (f: any) => f.name === 'aggregate-results',
      );
      if (!func) { setError('aggregate-results function not found'); return; }

      const result = await metadataApiClient.mutation({
        executeOneLogicFunction: {
          __args: { input: { id: func.id, payload: { surveyId } } },
          data: true,
          error: true,
        },
      } as any);
      const execResult = (result as any)?.executeOneLogicFunction;
      if (execResult?.error) {
        const e = execResult.error;
        const msg = typeof e === 'string' ? e : e?.message ?? e?.errorMessage ?? JSON.stringify(e);
        console.error('[ResultsWidget] exec error:', e);
        setError(msg);
        return;
      }
      if (execResult?.data) setResults(execResult.data);
    } catch (err) {
      console.error('[ResultsWidget] error:', err);
      setError(err instanceof Error ? err.message : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, [surveyId, metadataApiClient]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  // ── Styles ─────────────────────────────────────────────────────────────────

  const S = {
    root: {
      display: 'flex', flexDirection: 'column' as const, height: '100%',
      fontFamily: T.fontFamily, fontSize: '14px', color: T.textPrimary,
      background: T.bgSecondary, overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', background: T.bgPrimary,
      borderBottom: `1px solid ${T.borderMedium}`, flexShrink: 0,
    },
    headTitle: { fontSize: '14px', fontWeight: 700, color: T.textPrimary },
    refreshBtn: {
      padding: '5px 10px', background: 'none', border: `1px solid ${T.borderMedium}`,
      borderRadius: '5px', fontSize: '12px', color: T.textSecondary,
      cursor: 'pointer',
    },
    statsRow: {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
      padding: '12px', background: T.bgPrimary,
      borderBottom: `1px solid ${T.borderLight}`, flexShrink: 0,
    },
    statCard: (color: string, textColor: string) => ({
      padding: '10px', borderRadius: '7px', textAlign: 'center' as const,
      background: color,
    }),
    statLabel: (textColor: string) => ({
      fontSize: '10px', fontWeight: 700, color: textColor,
      letterSpacing: '.5px', textTransform: 'uppercase' as const,
    }),
    statValue: (textColor: string) => ({
      fontSize: '22px', fontWeight: 800, color: textColor, lineHeight: '1.2',
    }),
    responseList: { flex: 1, overflowY: 'auto' as const, padding: '8px' },
    personCard: {
      background: T.bgPrimary, borderRadius: '7px', marginBottom: '6px',
      border: `1px solid ${T.borderLight}`, overflow: 'hidden',
    },
    personHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', cursor: 'pointer',
    },
    personName: { fontSize: '13px', fontWeight: 600, color: T.textPrimary },
    personEmail: { fontSize: '11px', color: T.textLight, marginTop: '1px' },
    chevron: (open: boolean) => ({
      fontSize: '10px', color: T.textLight,
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform .15s',
    }),
    answersWrap: { padding: '0 14px 12px', borderTop: `1px solid ${T.borderLight}` },
    answerRow: {
      padding: '8px 0', borderBottom: `1px solid ${T.borderLight}`,
    },
    qLabel: { fontSize: '11px', fontWeight: 600, color: T.textLight, marginBottom: '3px' },
    aValue: { fontSize: '13px', color: T.textPrimary },
    emptyMsg: {
      padding: '24px', textAlign: 'center' as const, color: T.textLight,
      fontSize: '13px', lineHeight: '1.6',
    },
  };

  if (!surveyId) {
    return <div style={{ padding: '20px', color: T.textLight, fontFamily: T.fontFamily }}>Open a survey record to view results.</div>;
  }

  if (loading) {
    return <div style={{ padding: '20px', color: T.textLight, fontFamily: T.fontFamily }}>Loading results…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: T.fontFamily }}>
        <div style={{ color: '#991b1b', fontSize: '13px', marginBottom: '12px' }}>⚠ {error}</div>
        <button style={S.refreshBtn} onClick={fetchResults}>Retry</button>
      </div>
    );
  }

  if (!results) {
    return <div style={{ padding: '20px', color: T.textLight, fontFamily: T.fontFamily }}>No results yet.</div>;
  }

  const { stats } = results;
  const responses: any[] = stats?.responses ?? [];

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headTitle}>Results</span>
        <button style={S.refreshBtn} onClick={fetchResults}>↻ Refresh</button>
      </div>

      {/* Stats row */}
      <div style={S.statsRow}>
        <div style={S.statCard('#eff6ff', '#1d4ed8')}>
          <div style={S.statLabel('#1d4ed8')}>Sent</div>
          <div style={S.statValue('#1d4ed8')}>{stats?.totalSent ?? 0}</div>
        </div>
        <div style={S.statCard('#f0fdf4', '#15803d')}>
          <div style={S.statLabel('#15803d')}>Completed</div>
          <div style={S.statValue('#15803d')}>{stats?.totalCompleted ?? 0}</div>
        </div>
        <div style={S.statCard('#faf5ff', '#7e22ce')}>
          <div style={S.statLabel('#7e22ce')}>Rate</div>
          <div style={S.statValue('#7e22ce')}>{stats?.responseRate ?? 0}%</div>
        </div>
      </div>

      {/* Per-person responses */}
      <div style={S.responseList}>
        {responses.length === 0 ? (
          <div style={S.emptyMsg}>
            No responses yet.<br />
            Send the survey to recipients first.
          </div>
        ) : (
          responses.map((r: any) => {
            const isOpen = expandedPerson === r.personId;
            const answers: any[] = r.answers ?? [];
            return (
              <div key={r.personId ?? r.distributionId} style={S.personCard}>
                <div
                  style={S.personHeader}
                  onClick={() => setExpandedPerson(isOpen ? null : r.personId)}
                >
                  <div>
                    <div style={S.personName}>{r.personName || 'Anonymous'}</div>
                    {r.personEmail && <div style={S.personEmail}>{r.personEmail}</div>}
                  </div>
                  <span style={S.chevron(isOpen)}>▶</span>
                </div>
                {isOpen && (
                  <div style={S.answersWrap}>
                    {answers.length === 0 ? (
                      <div style={{ color: T.textLight, fontSize: '12px', padding: '8px 0' }}>
                        No answers recorded.
                      </div>
                    ) : (
                      answers.map((a: any, i: number) => (
                        <div
                          key={a.questionName ?? i}
                          style={{
                            ...S.answerRow,
                            borderBottom: i < answers.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                          }}
                        >
                          <div style={S.qLabel}>{a.questionTitle ?? a.questionName}</div>
                          <div style={S.aValue}>{formatAnswer(a.answer)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000008',
  name: 'results-widget',
  description: 'View survey results per person',
  component: ResultsWidget,
});
