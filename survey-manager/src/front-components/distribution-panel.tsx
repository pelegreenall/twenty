import { useCallback, useEffect, useState, useMemo } from 'react';
import { defineFrontComponent, useRecordId } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { SEND_SURVEY_FUNCTION_ID } from '../logic-functions/send-survey';

interface Distribution {
  id: string;
  status: string;
  token: string;
  person: {
    id: string;
    name: { firstName: string; lastName: string; };
    emails: { primaryEmail: string; }
  }
}

const DistributionPanel = () => {
  const surveyId = useRecordId();
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const coreApiClient = useMemo(() => new CoreApiClient(), []);
  const metadataApiClient = useMemo(() => new MetadataApiClient(), []);

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
                  emails: { primaryEmail: true }
                }
              }
            }
          }
        }
      } as any);
      const nodes = (result as any)?.sm133788Survey?.distributions?.edges?.map((e: any) => e.node) || [];
      setDistributions(nodes);
    } catch (err) {
      console.error("Failed to fetch distributions", err);
    } finally {
      setLoading(false);
    }
  }, [surveyId, coreApiClient]);

  useEffect(() => {
    fetchDistributions();
  }, [fetchDistributions]);

  const handleSend = async (distributionId: string) => {
    try {
      setSending(true);
      const manifest = await metadataApiClient.query({
        findManyLogicFunctions: {
          id: true,
          name: true
        }
      } as any);
      const func = (manifest as any)?.findManyLogicFunctions?.find((f: any) => f.name === 'send-survey');
      const targetId = func?.id || SEND_SURVEY_FUNCTION_ID;

      await metadataApiClient.mutation({
        executeOneLogicFunction: {
          __args: {
            input: {
              id: targetId,
              payload: { distributionId }
            }
          },
          data: true,
          error: true
        }
      });
      fetchDistributions();
    } catch (err) {
      console.error("Error sending:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', color: '#999' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', background: 'white', color: '#333', fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>Distributions</h3>
      {distributions.length === 0 ? (
        <p style={{ color: '#666', fontSize: '14px' }}>No distributions found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {distributions.map(d => (
            <div key={d.id} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{d.person?.name?.firstName} {d.person?.name?.lastName}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{d.status}</div>
              </div>
              {d.status === 'PENDING' && (
                <button
                  onClick={() => handleSend(d.id)}
                  disabled={sending}
                  style={{ background: '#0070f3', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                >
                  {sending ? '...' : 'Send'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000007',
  name: 'distribution-panel',
  description: 'Manage distributions',
  component: DistributionPanel,
});
