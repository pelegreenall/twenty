import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { defineFrontComponent, useRecordId } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonName { firstName: string; lastName: string }
interface PersonEmails { primaryEmail: string }
interface Person { id: string; name: PersonName; emails: PersonEmails }
interface Distribution {
  id: string;
  status: string;
  token: string;
  person: Person;
}

// ── Theme tokens ──────────────────────────────────────────────────────────────

const T = {
  bgPrimary: 'var(--t-background-primary)',
  bgSecondary: 'var(--t-background-secondary)',
  bgTertiary: 'var(--t-background-tertiary)',
  bgTransparentMedium: 'var(--t-background-transparent-medium)',
  textPrimary: 'var(--t-font-color-primary)',
  textSecondary: 'var(--t-font-color-secondary)',
  textLight: 'var(--t-font-color-light)',
  textInverted: 'var(--t-font-color-inverted)',
  borderMedium: 'var(--t-border-color-medium)',
  borderLight: 'var(--t-border-color-light)',
  accent: 'var(--t-accent-primary)',
  danger: 'var(--t-font-color-danger)',
  fontFamily: 'var(--t-font-family)',
} as const;

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  SENT:      { bg: '#dbeafe', text: '#1e40af', label: 'Sent' },
  OPENED:    { bg: '#e0e7ff', text: '#3730a3', label: 'Opened' },
  COMPLETED: { bg: '#d1fae5', text: '#065f46', label: 'Completed' },
};

const statusBadge = (status: string) => {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569', label: status };
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px',
      background: c.bg, color: c.text, letterSpacing: '.3px',
    }}>
      {c.label}
    </span>
  );
};

const personLabel = (p: Person | undefined) => {
  if (!p) return 'Unknown';
  const full = `${p.name?.firstName ?? ''} ${p.name?.lastName ?? ''}`.trim();
  return full || p.emails?.primaryEmail || 'Unknown';
};

// ── Component ─────────────────────────────────────────────────────────────────

const DistributionPanel = () => {
  const surveyId = useRecordId();
  const coreApiClient = useMemo(() => new CoreApiClient(), []);
  const metadataApiClient = useMemo(() => new MetadataApiClient(), []);

  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendFnId, setSendFnId] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch distributions ────────────────────────────────────────────────────

  const fetchDistributions = useCallback(async () => {
    if (!surveyId) return;
    try {
      const result = await coreApiClient.query({
        sm133788Survey: {
          __args: { filter: { id: { eq: surveyId } } },
          distributions: {
            edges: {
              node: {
                id: true,
                status: true,
                token: true,
                person: {
                  id: true,
                  name: { firstName: true, lastName: true },
                  emails: { primaryEmail: true },
                },
              },
            },
          },
        },
      } as never);
      const nodes = ((result as any)?.sm133788Survey?.distributions?.edges ?? []).map(
        (e: any) => e.node,
      );
      setDistributions(nodes);
    } catch (err) {
      console.error('[DistributionPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [surveyId, coreApiClient]);

  useEffect(() => { fetchDistributions(); }, [fetchDistributions]);

  // ── Resolve send-survey function ID once ──────────────────────────────────

  useEffect(() => {
    metadataApiClient.query({
      findManyLogicFunctions: { id: true, name: true },
    } as any).then((manifest: any) => {
      const fn = manifest?.findManyLogicFunctions?.find((f: any) => f.name === 'send-survey');
      if (fn) setSendFnId(fn.id);
    }).catch(() => {});
  }, [metadataApiClient]);

  // ── Search people ──────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      const result = await coreApiClient.query({
        people: {
          __args: {
            filter: {
              or: [
                { name: { firstName: { like: `%${q}%` } } },
                { name: { lastName: { like: `%${q}%` } } },
                { emails: { primaryEmail: { like: `%${q}%` } } },
              ],
            },
            first: 8,
          },
          edges: {
            node: {
              id: true,
              name: { firstName: true, lastName: true },
              emails: { primaryEmail: true },
            },
          },
        },
      } as never);
      const people = ((result as any)?.people?.edges ?? []).map((e: any) => e.node);
      setSearchResults(people);
      setShowDropdown(people.length > 0);
    } catch (err) {
      console.error('[DistributionPanel] search error:', err);
    } finally {
      setSearching(false);
    }
  }, [coreApiClient]);

  const onSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 350);
  };

  // ── Add person → create distribution ──────────────────────────────────────

  const addPerson = async (person: Person) => {
    if (!surveyId) return;
    // Don't add if already in list
    if (distributions.some((d) => d.person?.id === person.id)) {
      setSearch(''); setSearchResults([]); setShowDropdown(false);
      return;
    }
    setAdding(person.id);
    try {
      const result = await coreApiClient.mutation({
        createSm133788Distribution: {
          __args: {
            data: {
              status: 'PENDING',
              surveyId,
              personId: person.id,
            } as any,
          },
          id: true,
          status: true,
          token: true,
          person: {
            id: true,
            name: { firstName: true, lastName: true },
            emails: { primaryEmail: true },
          },
        },
      } as never);
      const newDist = (result as any)?.createSm133788Distribution;
      if (newDist) {
        setDistributions((prev) => [newDist, ...prev]);
      }
    } catch (err) {
      console.error('[DistributionPanel] add person error:', err);
    } finally {
      setAdding(null);
      setSearch(''); setSearchResults([]); setShowDropdown(false);
    }
  };

  // ── Send email ─────────────────────────────────────────────────────────────

  const sendDist = async (distributionId: string) => {
    if (!sendFnId) { setSendError('send-survey function not found'); return; }
    setSending(distributionId);
    setSendError(null);
    try {
      const result = await metadataApiClient.mutation({
        executeOneLogicFunction: {
          __args: {
            input: { id: sendFnId, payload: { distributionId } },
          },
          data: true,
          error: true,
        },
      } as any);
      const execResult = (result as any)?.executeOneLogicFunction;
      if (execResult?.error) {
        const e = execResult.error;
        throw new Error(typeof e === 'string' ? e : e?.message ?? e?.errorMessage ?? JSON.stringify(e));
      }
      await fetchDistributions();
    } catch (err) {
      console.error('[DistributionPanel] send error:', err);
      setSendError(err instanceof Error ? err.message : JSON.stringify(err));
    } finally {
      setSending(null);
    }
  };

  // ── Send all pending ───────────────────────────────────────────────────────

  const sendAllPending = async () => {
    const pending = distributions.filter((d) => d.status === 'PENDING');
    for (const d of pending) {
      await sendDist(d.id);
    }
  };

  // ── Delete distribution ────────────────────────────────────────────────────

  const deleteDist = async (id: string) => {
    setDeleting(id);
    try {
      await coreApiClient.mutation({
        deleteSm133788Distribution: {
          __args: { id },
          id: true,
        },
      } as never);
      setDistributions((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('[DistributionPanel] delete error:', err);
    } finally {
      setDeleting(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!surveyId) {
    return <div style={{ padding: '20px', color: T.textLight }}>Open a survey record to manage distributions.</div>;
  }

  const pendingCount = distributions.filter((d) => d.status === 'PENDING').length;

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
    sendAllBtn: {
      padding: '6px 12px', background: T.accent, color: T.textInverted,
      border: 'none', borderRadius: '6px', cursor: 'pointer',
      fontSize: '12px', fontWeight: 600,
      opacity: pendingCount === 0 ? 0.4 : 1,
    },
    searchWrap: {
      padding: '10px 12px', background: T.bgPrimary,
      borderBottom: `1px solid ${T.borderLight}`, position: 'relative' as const, flexShrink: 0,
    },
    searchInput: {
      width: '100%', padding: '7px 10px',
      border: `1px solid ${T.borderMedium}`, borderRadius: '6px',
      fontSize: '13px', color: T.textPrimary, background: T.bgSecondary,
      outline: 'none', boxSizing: 'border-box' as const,
    },
    dropdown: {
      position: 'absolute' as const, top: '100%', left: 0, right: 0,
      background: T.bgPrimary, border: `1px solid ${T.borderMedium}`,
      borderRadius: '0 0 8px 8px', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
      zIndex: 100, maxHeight: '220px', overflowY: 'auto' as const,
    },
    dropItem: (hovered: boolean) => ({
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', cursor: 'pointer',
      background: hovered ? T.bgTransparentMedium : 'transparent',
      borderBottom: `1px solid ${T.borderLight}`,
    }),
    dropName: { fontSize: '13px', fontWeight: 500, color: T.textPrimary },
    dropEmail: { fontSize: '11px', color: T.textLight },
    addBtn: {
      padding: '4px 10px', background: T.accent, color: T.textInverted,
      border: 'none', borderRadius: '5px', fontSize: '11px',
      fontWeight: 600, cursor: 'pointer', flexShrink: 0,
    },
    list: { flex: 1, overflowY: 'auto' as const, padding: '8px' },
    distRow: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 12px', borderRadius: '7px', marginBottom: '4px',
      background: T.bgPrimary, border: `1px solid ${T.borderLight}`,
    },
    distInfo: { flex: 1, minWidth: 0 },
    distName: {
      fontSize: '13px', fontWeight: 500, color: T.textPrimary,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    },
    distEmail: { fontSize: '11px', color: T.textLight, marginTop: '1px' },
    actionBtn: (active: boolean) => ({
      padding: '5px 11px', border: 'none', borderRadius: '5px',
      fontSize: '12px', fontWeight: 600, cursor: active ? 'pointer' : 'default',
      background: active ? T.accent : T.bgTertiary,
      color: active ? T.textInverted : T.textLight,
      flexShrink: 0,
    }),
    deleteBtn: {
      padding: '4px 8px', background: 'none', border: `1px solid ${T.borderLight}`,
      borderRadius: '5px', fontSize: '13px', color: T.textLight,
      cursor: 'pointer', flexShrink: 0, lineHeight: 1,
    },
    empty: {
      padding: '24px', textAlign: 'center' as const, color: T.textLight,
      fontSize: '13px', lineHeight: '1.6',
    },
    errorBanner: {
      margin: '8px', padding: '8px 12px', background: '#fee2e2',
      color: '#991b1b', borderRadius: '6px', fontSize: '12px',
    },
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headTitle}>
          Distribution ({distributions.length})
        </span>
        {pendingCount > 0 && (
          <button
            style={S.sendAllBtn}
            disabled={!!sending}
            onClick={sendAllPending}
          >
            {sending ? '…' : `Send All (${pendingCount})`}
          </button>
        )}
      </div>

      {/* Person search */}
      <div style={S.searchWrap} ref={dropdownRef}>
        <input
          style={S.searchInput}
          value={search}
          placeholder={searching ? 'Searching…' : 'Search people to add…'}
          onChange={(ev) => {
            const v = (ev as any)?.detail?.value ?? (ev as any)?.target?.value ?? '';
            onSearchChange(v);
          }}
          onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
        />
        {showDropdown && searchResults.length > 0 && (
          <div style={S.dropdown}>
            {searchResults.map((p) => {
              const alreadyAdded = distributions.some((d) => d.person?.id === p.id);
              return (
                <div
                  key={p.id}
                  style={S.dropItem(false)}
                >
                  <div>
                    <div style={S.dropName}>{personLabel(p)}</div>
                    <div style={S.dropEmail}>{p.emails?.primaryEmail}</div>
                  </div>
                  <button
                    style={{
                      ...S.addBtn,
                      background: alreadyAdded ? '#d1fae5' : T.accent,
                      color: alreadyAdded ? '#065f46' : T.textInverted,
                      cursor: alreadyAdded ? 'default' : 'pointer',
                    }}
                    disabled={alreadyAdded || adding === p.id}
                    onClick={() => !alreadyAdded && addPerson(p)}
                  >
                    {adding === p.id ? '…' : alreadyAdded ? '✓ Added' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error banner */}
      {sendError && (
        <div style={S.errorBanner}>
          ⚠ {sendError}
        </div>
      )}

      {/* Distribution list */}
      <div style={S.list}>
        {loading ? (
          <div style={S.empty}>Loading…</div>
        ) : distributions.length === 0 ? (
          <div style={S.empty}>
            No recipients yet.<br />
            Search for people above to add them.
          </div>
        ) : (
          distributions.map((d) => {
            const isSending = sending === d.id;
            const canSend = d.status === 'PENDING' || d.status === 'SENT';
            return (
              <div key={d.id} style={S.distRow}>
                <div style={S.distInfo}>
                  <div style={S.distName}>{personLabel(d.person)}</div>
                  <div style={S.distEmail}>{d.person?.emails?.primaryEmail}</div>
                </div>
                {statusBadge(d.status)}
                {canSend && (
                  <button
                    style={S.actionBtn(!isSending)}
                    disabled={isSending || !!sending}
                    onClick={() => sendDist(d.id)}
                  >
                    {isSending
                      ? '…'
                      : d.status === 'SENT'
                        ? 'Resend'
                        : 'Send'}
                  </button>
                )}
                <button
                  style={S.deleteBtn}
                  disabled={deleting === d.id}
                  onClick={() => deleteDist(d.id)}
                  title="Remove"
                >
                  {deleting === d.id ? '…' : '✕'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000007',
  name: 'distribution-panel',
  description: 'Add recipients and send survey invitations',
  component: DistributionPanel,
});
