'use client';

import { useState } from 'react';
import AddressInput from './components/AddressInput';
import HoldersTable from './components/HoldersTable';
import Graph from './components/Graph';
import LoadingOverlay from './components/LoadingOverlay';
import type { AnalysisResult } from '@/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (address: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      setData(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部说明 */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mt-4">
            <AddressInput onSubmit={handleAnalyze} />
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading && <LoadingOverlay />}

      {/* 分析结果 */}
      {data && (

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">

              <h3 className="text-lg font-medium text-gray-900">
                Top Holders
              </h3>
              <div className="mt-4">
                <HoldersTable data={data} />
              </div>
            </div>
          </div>
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">
                Relationship Graph
              </h3>
              <div className="mt-4 h-[600px]">
                <Graph data={data} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}