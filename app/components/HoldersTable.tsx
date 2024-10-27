'use client';

import { AnalysisResult } from '@/types';

interface Props {
    data: AnalysisResult;
}

export default function HoldersTable({ data }: Props) {
    // 获取缩略地址
    const getShortAddress = (address: string) => {
        return address ? `${address.substring(0, 4)}` : '-';
    };

    return (
        <div className="overflow-auto rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            SNS
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Transaction From
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Holdings (%)
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.topHolders.map((holder, index) => {
                        const relatedData = data.relatedAddresses[holder.holder_address];
                        const lastTx = relatedData?.transactions[relatedData.transactions.length - 1];

                        return (
                            <tr key={holder.holder_address} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div
                                            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                            title={holder.holder_address}
                                        >
                                            <a href={`https://solscan.io/address/${holder.holder_address}`} target="_blank" rel="noopener noreferrer"> {getShortAddress(holder.holder_address)}</a>

                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                        {holder.holder_sns || '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div
                                        className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
                                        title={lastTx?.from || ''}
                                    >
                                        <a href={`https://solscan.io/address/${lastTx?.from}`} target="_blank" rel="noopener noreferrer"> {lastTx ? getShortAddress(lastTx.from) : '-'}</a>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                        {(parseFloat(holder.holder_pct_of_supply) * 100).toFixed(2)}%
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}