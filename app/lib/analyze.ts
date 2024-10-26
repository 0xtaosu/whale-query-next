/**
 * analyze.ts
 * 主要功能：分析代币持有者及其交易关系，识别潜在的内幕交易群体
 * 
 * 核心功能：
 * 1. 获取代币持有者信息
 * 2. 分析持有者之间的交易关系
 * 3. 构建关联地址网络
 * 4. 生成分析报告
 */

import { fetchTokenHolders } from './dune';
import { getTransactionGraph, getAddressRelationGraph } from './solscan';
import type { Transaction } from './solscan';
import fs from 'fs';

// 类型定义
/**
 * 代币持有者信息
 * @interface Holder
 * @property {string} holder_address - 持有者地址
 * @property {string | null} holder_sns - 持有者的 SNS 域名
 * @property {string} holder_pct_of_supply - 持有比例
 */
interface Holder {
    holder_address: string;
    holder_sns: string | null;
    holder_pct_of_supply: string;
}

/**
 * 交易数据结构
 * @interface TransactionData
 * @property {string} from - 发送方地址
 * @property {string} to - 接收方地址
 * @property {number} amount - 交易金额
 * @property {string} time - 交易时间
 * @property {'in' | 'out'} type - 交易类型
 */
interface TransactionData {
    from: string;
    to: string;
    amount: number;
    time: string;
    type: 'in' | 'out';
}

/**
 * 持有者数据结构
 * @interface HolderData
 */
interface HolderData {
    incomingAddresses: string[];    // 转入地址列表
    outgoingAddresses: string[];    // 转出地址列表
    totalInAmount: number;          // 总转入金额
    totalOutAmount: number;         // 总转出金额
    transactions: TransactionData[]; // 交易记录
}

/**
 * 分析结果数据结构
 * @interface AnalysisResult
 */
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

/**
 * 持有者交易分析结果
 * @interface HolderTransactionsResult
 */
interface HolderTransactionsResult {
    topHolders: Holder[];
    transactionGraph: Map<string, Transaction[]>;
}

/**
 * 分析代币持有者之间的直接交易关系
 * @param tokenAddress 代币地址
 * @param topN 分析前N个大户
 * @returns Promise<HolderTransactionsResult>
 */
async function analyzeTokenHoldersTransactions(
    tokenAddress: string,
    topN: number = 10
): Promise<HolderTransactionsResult> {
    console.log('\n=== 开始分析代币持有者交易关系 ===');
    console.log(`Token Address: ${tokenAddress}`);
    console.log(`Analyzing Top ${topN} holders`);

    try {
        // 获取持有者列表
        console.log('\n[1/3] 获取代币持有者列表...');
        const holders = await fetchTokenHolders(tokenAddress);
        console.log(`✓ 成功获取 ${holders.length} 个持有者信息`);

        // 获取前N大持有者
        const topHolders = holders
            .sort((a, b) => parseFloat(b.holder_pct_of_supply) - parseFloat(a.holder_pct_of_supply))
            .slice(0, topN);

        console.log('\n[2/3] 分析大户持仓情况:');
        topHolders.forEach((holder, index) => {
            console.log(`${index + 1}. ${holder.holder_address}`);
            console.log(`   SNS: ${holder.holder_sns || 'N/A'}`);
            console.log(`   持仓比例: ${(parseFloat(holder.holder_pct_of_supply) * 100).toFixed(2)}%`);
        });

        // 获取交易图谱
        console.log('\n[3/3] 构建交易关系图谱...');
        const holderAddresses = topHolders.map(holder => holder.holder_address);
        const transactionGraph = await getTransactionGraph(holderAddresses);

        // 输出交易统计
        console.log('\n=== 交易关系统计 ===');
        let totalTransactions = 0;
        for (const [vertex, edges] of transactionGraph) {
            totalTransactions += edges.length;
            console.log(`\n地址: ${vertex}`);
            console.log(`交易次数: ${edges.length}`);
            if (edges.length > 0) {
                console.log('最近交易:');
                edges.slice(0, 3).forEach(edge => {
                    console.log(`  → ${edge.to}`);
                    console.log(`    金额: ${edge.amount} SOL`);
                    console.log(`    时间: ${edge.formattedTime}`);
                });
            }
        }
        console.log(`\n总交易次数: ${totalTransactions}`);

        console.log('\n✓ 分析完成');
        return { topHolders, transactionGraph };

    } catch (error) {
        console.error('\n❌ 分析过程中出现错误:', error);
        throw error;
    }
}

/**
 * 分析代币持有者的关联地址网络
 * 
 * @description
 * 此函数执行以下步骤：
 * 1. 获取代币的前N大持有者
 * 2. 分析每个持有者的关联地址
 * 3. 构建交易网络图谱
 * 4. 生成详细的分析报告
 * 
 * @param {string} tokenAddress - 要分析的代币地址
 * @param {number} topN - 分析前N个大户，默认为10
 * @param {number} minAmount - 最小交易金额阈值（SOL），默认为10
 * 
 * @returns {Promise<AnalysisResult>} 返回分析结果，包含：
 * - tokenAddress: 分析的代币地址
 * - topHolders: 前N大持有者信息
 * - relatedAddresses: 关联地址网络图谱
 * - summary: 分析统计摘要
 * 
 * @throws {Error} 当API调用失败或数据处理出错时抛出异常
 * 
 * @example
 * const result = await analyzeTokenHoldersRelatedAddresses(
 *   "TokenAddress123",
 *   10,
 *   10
 * );
 */
async function analyzeTokenHoldersRelatedAddresses(
    tokenAddress: string,
    topN: number = 10,
    minAmount: number = 10
): Promise<AnalysisResult> {
    try {
        // 1. 获取持有者列表
        console.log('\n=== 开始分析代币持有者关联网络 ===');
        console.log(`Token Address: ${tokenAddress}`);
        console.log(`分析参数: Top ${topN} holders, 最小交易金额 ${minAmount} SOL`);

        console.log('\n[1/4] 获取代币持有者列表...');
        const holders = await fetchTokenHolders(tokenAddress);
        console.log(`✓ 成功获取 ${holders.length} 个持有者信息`);

        // 2. 获取前N大持有者
        console.log('\n[2/4] 筛选大额持有者...');
        const topHolders = holders
            .sort((a, b) => parseFloat(b.holder_pct_of_supply) - parseFloat(a.holder_pct_of_supply))
            .slice(0, topN);

        console.log('大户持仓情况:');
        topHolders.forEach((holder, index) => {
            console.log(`${index + 1}. ${holder.holder_address}`);
            console.log(`   SNS: ${holder.holder_sns || 'N/A'}`);
            console.log(`   持仓比例: ${(parseFloat(holder.holder_pct_of_supply) * 100).toFixed(2)}%`);
        });

        // 3. 分析每个持有者的关联地址
        console.log('\n[3/4] 分析关联地址网络...');
        const holderGraphs = new Map<string, Map<string, Transaction[]>>();
        for (const holder of topHolders) {
            console.log(`\n分析持有者: ${holder.holder_address}`);
            console.log(`SNS: ${holder.holder_sns || 'N/A'}`);
            const graph = await getAddressRelationGraph(holder.holder_address, minAmount);
            holderGraphs.set(holder.holder_address, graph);
            console.log(`✓ 获取到 ${graph.size} 个关联地址`);
        }

        // 4. 构建分析结果
        console.log('\n[4/4] 生成分析报告...');
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

        // 5. 处理每个持有者的数据
        for (const [holderAddress, graph] of holderGraphs) {
            console.log(`\n处理持有者数据: ${holderAddress}`);
            const holderData = {
                incomingAddresses: new Set<string>(),
                outgoingAddresses: new Set<string>(),
                totalInAmount: 0,
                totalOutAmount: 0,
                transactions: [] as TransactionData[]
            };

            // 处理交易数据
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

            // 更新结果
            result.relatedAddresses.set(holderAddress, {
                incomingAddresses: Array.from(holderData.incomingAddresses),
                outgoingAddresses: Array.from(holderData.outgoingAddresses),
                totalInAmount: holderData.totalInAmount,
                totalOutAmount: holderData.totalOutAmount,
                transactions: holderData.transactions
            });

            // 更新统计数据
            result.summary.totalRelatedAddresses +=
                holderData.incomingAddresses.size +
                holderData.outgoingAddresses.size;
            result.summary.totalTransactions += holderData.transactions.length;

            console.log(`✓ 转入地址: ${holderData.incomingAddresses.size}`);
            console.log(`✓ 转出地址: ${holderData.outgoingAddresses.size}`);
            console.log(`✓ 交易总数: ${holderData.transactions.length}`);
        }

        // 6. 输出分析摘要
        console.log('\n=== 分析报告摘要 ===');
        console.log(`• 分析持有者数量: ${result.summary.totalHolders}`);
        console.log(`• 关联地址总数: ${result.summary.totalRelatedAddresses}`);
        console.log(`• 交易总数: ${result.summary.totalTransactions}`);
        console.log('=== 分析完成 ===\n');

        return result;

    } catch (error) {
        console.error('\n❌ 分析过程中出现错误:');
        console.error(error);
        throw error;
    }
}

// 导出函数
export {
    analyzeTokenHoldersTransactions,
    analyzeTokenHoldersRelatedAddresses
};

/**
 * 测试入口
 * 用于直接运行文件时的测试
 */
if (require.main === module) {
    const testParams = {
        tokenAddress: '66gsTs88mXJ5L4AtJnWqFW6H2L5YQDRy4W41y6zbpump',
        topN: 10,
        minAmount: 10
    };

    console.log('\n=== 开始测试分析 ===');
    console.log('参数配置:');
    console.log(`• Token Address: ${testParams.tokenAddress}`);
    console.log(`• Top N Holders: ${testParams.topN}`);
    console.log(`• Min Amount: ${testParams.minAmount} SOL`);

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

            console.log(`\n✓ 分析完成`);
            console.log(`• 结果已保存至: ${filename}`);
            console.log('=== 测试结束 ===\n');
        })
        .catch(error => {
            console.error('\n❌ 分析失败:', error);
            process.exit(1);
        });
}
