import { useCallback, useEffect, useState, useMemo } from 'react';
import { defineFrontComponent, useRecordId } from 'twenty-sdk';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { AGGREGATE_RESULTS_FUNCTION_ID } from '../logic-functions/aggregate-results';

const ResultsWidget = () => {
    const surveyId = useRecordId();
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const metadataApiClient = useMemo(() => new MetadataApiClient(), []);

    const fetchResults = useCallback(async () => {
        if (!surveyId) return;
        try {
            const manifest = await metadataApiClient.query({
                findManyLogicFunctions: {
                    id: true,
                    name: true
                }
            } as any);
            const func = (manifest as any)?.findManyLogicFunctions?.find((f: any) => f.name === 'aggregate-results');
            const targetId = func?.id || AGGREGATE_RESULTS_FUNCTION_ID;

            const result = await metadataApiClient.mutation({
                executeOneLogicFunction: {
                    __args: {
                        input: {
                            id: targetId,
                            payload: { surveyId }
                        }
                    },
                    data: true,
                    error: true
                }
            });
            const data = (result as any).executeOneLogicFunction?.data;
            if (data) setResults(data);
        } catch (err) {
            console.error("Failed to fetch results", err);
        } finally {
            setLoading(false);
        }
    }, [surveyId, metadataApiClient]);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    if (loading) return <div style={{ padding: '20px', color: '#666' }}>Analyzing...</div>;
    if (!results) return <div style={{ padding: '20px', color: '#666' }}>No results yet.</div>;

    const { stats } = results;

    return (
        <div style={{ padding: '20px', background: 'white', color: '#333', fontFamily: 'sans-serif' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>Results</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div style={{ padding: '15px', background: '#f0f9ff', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#0369a1' }}>SENT</div>
                    <div style={{ fontSize: '24px', fontWeight: 800 }}>{stats?.totalSent ?? 0}</div>
                </div>
                <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#166534' }}>DONE</div>
                    <div style={{ fontSize: '24px', fontWeight: 800 }}>{stats?.totalCompleted ?? 0}</div>
                </div>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
                {stats?.responses?.length ?? 0} responses recorded.
            </div>
        </div>
    );
};

export default defineFrontComponent({
    universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000008',
    name: 'results-widget',
    description: 'View results',
    component: ResultsWidget,
});
