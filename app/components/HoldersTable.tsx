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

    // 获取最后一次资金来源地址
    const getLastFundingSource = (holderAddress: string, relatedData: any) => {
        if (!relatedData?.transactions.length) return null;

        // 查找最后一笔接收交易（持有者作为接收方）
        for (let i = relatedData.transactions.length - 1; i >= 0; i--) {
            const tx = relatedData.transactions[i];
            if (tx.to === holderAddress) {
                return tx.from;  // 返回发送方地址
            }
        }

        return null;  // 如果没有找到接收交易
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
                            Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            From
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Holdings (%)
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.topHolders.map((holder, index) => {
                        const relatedData = data.relatedAddresses[holder.holder_address];
                        const lastFundingSource = getLastFundingSource(holder.holder_address, relatedData);

                        return (
                            <tr key={holder.holder_address} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div
                                            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                            title={holder.holder_address}
                                        >
                                            <a href={`https://solscan.io/address/${holder.holder_address}`} target="_blank" rel="noopener noreferrer">
                                                {getShortAddress(holder.holder_address)}
                                            </a>
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
                                        title={lastFundingSource || ''}
                                    >
                                        {lastFundingSource ? (
                                            <a href={`https://solscan.io/address/${lastFundingSource}`} target="_blank" rel="noopener noreferrer">
                                                {getShortAddress(lastFundingSource)}
                                            </a>
                                        ) : '-'}
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
