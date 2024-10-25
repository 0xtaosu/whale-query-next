/**
 * analyze.ts
 * 主要功能：分析代币持有者及其交易关系，识别潜在的内幕交易群体
 */


import { fetchTokenHolders } from './dune';
import { getTransactionGraph, getAddressRelationGraph } from './solscan';
import type { Transaction } from './solscan';
import fs from 'fs';

// 类型定义
interface Holder {
    holder_address: string;
    holder_sns: string | null;
    holder_pct_of_supply: string;
}

interface TransactionData {
    from: string;
    to: string;
    amount: number;
    time: string;
    type: 'in' | 'out';
}

interface HolderData {
    incomingAddresses: string[];
    outgoingAddresses: string[];
    totalInAmount: number;
    totalOutAmount: number;
    transactions: TransactionData[];
}

interface AnalysisResult {
    tokenAddress: string;
    topHolders: Holder[];
    relatedAddresses: Map<string, HolderData>;
    summary: {
        totalHolders: number;
        totalRelatedAddresses: number;
        totalTransactions: number;
    };
}

interface HolderTransactionsResult {
    topHolders: Holder[];
    transactionGraph: Map<string, Transaction[]>;
}

/**
 * 分析代币持有者之间的直接交易关系
 */
async function analyzeTokenHoldersTransactions(
    tokenAddress: string,
    topN: number = 10
): Promise<HolderTransactionsResult> {
    try {
        console.log(`\nFetching top holders for token: ${tokenAddress}`);
        const holders = await fetchTokenHolders(tokenAddress);

        const topHolders = holders
            .sort((a, b) => parseFloat(b.holder_pct_of_supply) - parseFloat(a.holder_pct_of_supply))
            .slice(0, topN);

        console.log(`\nAnalyzing transactions for top ${topN} holders:`);
        topHolders.forEach((holder, index) => {
            console.log(`${index + 1}. ${holder.holder_address} ${holder.holder_sns} (${(parseFloat(holder.holder_pct_of_supply) * 100).toFixed(2)}%)`);
        });

        const holderAddresses = topHolders.map(holder => holder.holder_address);
        console.log('\nFetching transaction graph for these addresses...');
        const transactionGraph = await getTransactionGraph(holderAddresses);

        console.log('\nTransaction Graph:');
        for (const [vertex, edges] of transactionGraph) {
            console.log(`\nFrom: ${vertex}`);
            edges.forEach(edge => {
                console.log(`  → To: ${edge.to}`);
                console.log(`    Amount: ${edge.amount} SOL`);
                console.log(`    Time: ${edge.formattedTime}`);
            });
        }

        return {
            topHolders,
            transactionGraph
        };

    } catch (error) {
        console.error('Error in analyzeTokenHoldersTransactions:', error);
        throw error;
    }
}

/**
 * 分析代币持有者的关联地址网络
 */
async function analyzeTokenHoldersRelatedAddresses(
    tokenAddress: string,
    topN: number = 10,
    minAmount: number = 10
): Promise<AnalysisResult> {
    try {
        console.log(`\nFetching top holders for token: ${tokenAddress}`);
        const holders = await fetchTokenHolders(tokenAddress);

        const topHolders = holders
            .sort((a, b) => parseFloat(b.holder_pct_of_supply) - parseFloat(a.holder_pct_of_supply))
            .slice(0, topN);

        console.log(`\nAnalyzing related addresses for top ${topN} holders:`);
        topHolders.forEach((holder, index) => {
            console.log(`${index + 1}. ${holder.holder_address} ${holder.holder_sns} (${(parseFloat(holder.holder_pct_of_supply) * 100).toFixed(2)}%)`);
        });

        const holderGraphs = new Map<string, Map<string, Transaction[]>>();
        for (const holder of topHolders) {
            console.log(`\nAnalyzing related addresses for holder: ${holder.holder_address}`);
            const graph = await getAddressRelationGraph(holder.holder_address, minAmount);
            holderGraphs.set(holder.holder_address, graph);
        }

        const result: AnalysisResult = {
            tokenAddress,
            topHolders,
            relatedAddresses: new Map(),
            summary: {
                totalHolders: topHolders.length,
                totalRelatedAddresses: 0,
                totalTransactions: 0
            }
        };

        for (const [holderAddress, graph] of holderGraphs) {
            const holderData = {
                incomingAddresses: new Set<string>(),
                outgoingAddresses: new Set<string>(),
                totalInAmount: 0,
                totalOutAmount: 0,
                transactions: [] as TransactionData[]
            };

            for (const [from, edges] of graph) {
                edges.forEach(edge => {
                    holderData.transactions.push({
                        from,
                        to: edge.to,
                        amount: edge.amount,
                        time: edge.formattedTime,
                        type: edge.type || 'in'
                    });

                    if (edge.type === 'in') {
                        holderData.incomingAddresses.add(from);
                        holderData.totalInAmount += edge.amount;
                    } else {
                        holderData.outgoingAddresses.add(edge.to);
                        holderData.totalOutAmount += edge.amount;
                    }
                });
            }

            result.relatedAddresses.set(holderAddress, {
                incomingAddresses: Array.from(holderData.incomingAddresses),
                outgoingAddresses: Array.from(holderData.outgoingAddresses),
                totalInAmount: holderData.totalInAmount,
                totalOutAmount: holderData.totalOutAmount,
                transactions: holderData.transactions
            });

            result.summary.totalRelatedAddresses +=
                holderData.incomingAddresses.size +
                holderData.outgoingAddresses.size;
            result.summary.totalTransactions += holderData.transactions.length;
        }

        // 输出分析结果
        console.log('\nAnalysis Summary:');
        console.log(`Total Holders Analyzed: ${result.summary.totalHolders}`);
        console.log(`Total Related Addresses: ${result.summary.totalRelatedAddresses}`);
        console.log(`Total Transactions: ${result.summary.totalTransactions}`);

        return result;

    } catch (error) {
        console.error('Error in analyzeTokenHoldersRelatedAddresses:', error);
        throw error;
    }
}

// 导出函数
export {
    analyzeTokenHoldersTransactions,
    analyzeTokenHoldersRelatedAddresses
};

// 测试入口
if (require.main === module) {
    const testParams = {
        tokenAddress: '66gsTs88mXJ5L4AtJnWqFW6H2L5YQDRy4W41y6zbpump',
        topN: 10,
        minAmount: 10
    };

    console.log('Starting analysis with parameters:');
    console.log(`Token Address: ${testParams.tokenAddress}`);
    console.log(`Top N Holders: ${testParams.topN}`);
    console.log(`Min Amount: ${testParams.minAmount} SOL`);

    analyzeTokenHoldersRelatedAddresses(
        testParams.tokenAddress,
        testParams.topN,
        testParams.minAmount
    )
        .then(result => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `analysis_result_${timestamp}.json`;

            const serializedResult = {
                ...result,
                relatedAddresses: Object.fromEntries(result.relatedAddresses)
            };

            fs.writeFileSync(
                filename,
                JSON.stringify(serializedResult, null, 2)
            );

            console.log(`\nAnalysis completed. Results saved to ${filename}`);
        })
        .catch(error => {
            console.error('Analysis failed:', error);
            process.exit(1);
        });
}