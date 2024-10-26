/**
 * solscan.ts
 * 主要功能：与Solscan API交互，获取账户交易数据
 * 
 * 工作流程：
 * 1. 获取单个地址的最新交易
 * 2. 构建交易邻接表
 * 3. 合并多个地址的交易数据
 * 4. 递归分析关联地址
 * 
 * 关键功能：
 * - API调用限流处理
 * - 交易图谱构建
 * - 递归深度控制
 * - 访问记录去重
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// 类型定义
/**
 * 交易数据结构
 * @interface Transaction
 * @property {string} to - 接收方地址
 * @property {number} amount - 交易金额
 * @property {number} timestamp - 时间戳
 * @property {string} formattedTime - 格式化时间
 * @property {'in' | 'out'} type - 交易类型
 */
interface Transaction {
    to: string;
    amount: number;
    timestamp: number;
    formattedTime: string;
    type?: 'in' | 'out';
}

/**
 * Solscan API 响应结构
 * @interface SolscanResponse
 */
interface SolscanResponse {
    success: boolean;
    data: SolscanTransaction[];
}

/**
 * Solscan 交易数据结构
 * @interface SolscanTransaction
 */
interface SolscanTransaction {
    from_address: string;
    to_address: string;
    amount: number;
    token_decimals: number;
    block_time: number;
}

/**
 * API 请求参数结构
 * @interface APIParams
 */
interface APIParams {
    address: string;
    'activity_type[]'?: string;
    token?: string;
    'amount[]'?: number;
    flow?: 'in' | 'out';
    page?: number;
    page_size?: number;
}

// 环境变量配置
const SOL_TOKEN = process.env.SOL_TOKEN_ADDRESS;
const SOLSCAN_API_URL = `${process.env.SOLSCAN_API_URL}/account/transfer`;
const API_KEY = process.env.SOLSCAN_API_KEY;

// API密钥检查
if (!API_KEY) {
    console.error('❌ Error: SOLSCAN_API_KEY not found in environment variables');
    process.exit(1);
}

// 全局计数器和限流控制
let apiCallCount = 0;
const API_DELAY = 100; // ms between calls

/**
 * 添加延迟函数
 * @param {number} ms - 延迟毫秒数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 调用 Solscan API
 * @param {APIParams} params - API请求参数
 * @returns {Promise<any>} API响应
 */
async function callSolscanAPI(params: APIParams): Promise<any> {
    apiCallCount++;
    console.log(`🌐 API Call #${apiCallCount}: ${params.address} (${params.flow || 'query'})`);

    await delay(API_DELAY);

    return axios.get(SOLSCAN_API_URL, {
        params,
        headers: { 'token': API_KEY }
    });
}

/**
 * 获取单个地址的最新交易
 */
async function getLatestTransaction(address: string): Promise<Map<string, Transaction[]>> {
    const adjacencyList = new Map<string, Transaction[]>();

    try {
        const response = await axios.get<SolscanResponse>(SOLSCAN_API_URL, {
            params: {
                address: address,
                'activity_type[]': 'ACTIVITY_SPL_TRANSFER',
                token: SOL_TOKEN,
                'amount[]': 0.5,
                flow: 'in',
                page: 1,
                page_size: 10
            },
            headers: {
                'token': API_KEY
            }
        });

        if (response.data?.success && Array.isArray(response.data.data)) {
            const transactions = response.data.data;

            if (transactions.length > 0) {
                const firstTx = transactions[0];
                const amount = firstTx.amount / Math.pow(10, firstTx.token_decimals);

                if (!adjacencyList.has(firstTx.from_address)) {
                    adjacencyList.set(firstTx.from_address, []);
                }
                adjacencyList.get(firstTx.from_address)?.push({
                    to: firstTx.to_address,
                    amount,
                    timestamp: firstTx.block_time,
                    formattedTime: new Date(firstTx.block_time * 1000).toLocaleString()
                });
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error fetching data for address ${address}:`, error.message);
        }
    }

    return adjacencyList;
}

/**
 * 合并多个邻接表
 */
function mergeMaps(maps: Map<string, Transaction[]>[]): Map<string, Transaction[]> {
    const mergedMap = new Map<string, Transaction[]>();

    for (const map of maps) {
        for (const [from, edges] of map) {
            if (!mergedMap.has(from)) {
                mergedMap.set(from, []);
            }
            mergedMap.get(from)?.push(...edges);
        }
    }

    return mergedMap;
}

/**
 * 获取多个地址的交易图
 */
async function getTransactionGraph(addresses: string[]): Promise<Map<string, Transaction[]>> {
    try {
        const maps = await Promise.all(
            addresses.map(address => getLatestTransaction(address))
        );
        return mergeMaps(maps);
    } catch (error) {
        console.error('Error in getTransactionGraph:', error);
        return new Map();
    }
}

/**
 * 递归获取地址的关联交易
 * @param {string} address - 要分析的地址
 * @param {number} minAmount - 最小交易金额（SOL）
 * @param {number} depth - 当前递归深度
 * @param {number} maxDepth - 最大递归深度
 * @param {Set<string>} visitedAddresses - 已访问地址集合
 * @param {Set<string>} processedTx - 已处理交易集合
 * @returns {Promise<Map<string, Transaction[]>>} 交易图谱
 */
async function getRelatedTransactions(
    address: string,
    minAmount: number = 100,
    depth: number = 0,
    maxDepth: number = 2,
    visitedAddresses: Set<string> = new Set(),
    processedTx: Set<string> = new Set()
): Promise<Map<string, Transaction[]>> {
    console.log(`\n📊 Analyzing depth ${depth} for address: ${address}`);
    console.log(`   Min amount: ${minAmount} SOL`);

    // 防止重复访问
    if (visitedAddresses.has(address)) {
        console.log(`   ⚠️ Address already visited: ${address}`);
        return new Map();
    }
    visitedAddresses.add(address);

    // 深度限制
    if (depth >= maxDepth) {
        console.log(`   🛑 Max depth reached (${maxDepth})`);
        return new Map();
    }

    const transactionGraph = new Map<string, Transaction[]>();

    try {
        // 获取转入交易
        console.log(`   📥 Fetching incoming transactions...`);
        const inResponse = await callSolscanAPI({
            address: address,
            'activity_type[]': 'ACTIVITY_SPL_TRANSFER',
            token: SOL_TOKEN,
            'amount[]': minAmount,
            flow: 'in',
            page: 1,
            page_size: 10
        });

        await delay(API_DELAY);

        // 获取转出交易
        console.log(`   📤 Fetching outgoing transactions...`);
        const outResponse = await callSolscanAPI({
            address: address,
            'activity_type[]': 'ACTIVITY_SPL_TRANSFER',
            token: SOL_TOKEN,
            'amount[]': minAmount,
            flow: 'out',
            page: 1,
            page_size: 10
        });

        // 处理转入交易
        if (inResponse.data?.success && Array.isArray(inResponse.data.data)) {
            const inTx = inResponse.data.data[0];
            if (inTx) {
                const amount = inTx.amount / Math.pow(10, inTx.token_decimals);
                if (amount >= minAmount) {
                    const fromAddress = inTx.from_address;
                    const txKey = `${fromAddress}-${address}-${inTx.block_time}`;

                    if (!processedTx.has(txKey)) {
                        processedTx.add(txKey);

                        if (!transactionGraph.has(fromAddress)) {
                            transactionGraph.set(fromAddress, []);
                        }
                        transactionGraph.get(fromAddress)?.push({
                            to: address,
                            amount,
                            timestamp: inTx.block_time,
                            formattedTime: new Date(inTx.block_time * 1000).toLocaleString(),
                            type: 'in'
                        });

                        // 递归分析转入地址
                        if (depth < maxDepth - 1) {
                            console.log(`Looking for transactions to ${fromAddress} (depth ${depth + 1})`);
                            const relatedTx = await getRelatedTransactions(
                                fromAddress,
                                minAmount,
                                depth + 1,
                                maxDepth,
                                visitedAddresses,
                                processedTx
                            );
                            // 合并结果
                            for (const [from, edges] of relatedTx) {
                                if (!transactionGraph.has(from)) {
                                    transactionGraph.set(from, []);
                                }
                                transactionGraph.get(from)?.push(...edges);
                            }
                        }
                    }
                }
            }
        }

        // 处理转出交易
        if (outResponse.data?.success && Array.isArray(outResponse.data.data)) {
            const outTx = outResponse.data.data[0];
            if (outTx) {
                const amount = outTx.amount / Math.pow(10, outTx.token_decimals);
                if (amount >= minAmount) {
                    const toAddress = outTx.to_address;
                    const txKey = `${address}-${toAddress}-${outTx.block_time}`;

                    if (!processedTx.has(txKey)) {
                        processedTx.add(txKey);

                        if (!transactionGraph.has(address)) {
                            transactionGraph.set(address, []);
                        }
                        transactionGraph.get(address)?.push({
                            to: toAddress,
                            amount,
                            timestamp: outTx.block_time,
                            formattedTime: new Date(outTx.block_time * 1000).toLocaleString(),
                            type: 'out'
                        });

                        // 递归分析转出地址
                        if (depth < maxDepth - 1) {
                            console.log(`Looking for transactions from ${toAddress} (depth ${depth + 1})`);
                            const relatedTx = await getRelatedTransactions(
                                toAddress,
                                minAmount,
                                depth + 1,
                                maxDepth,
                                visitedAddresses,
                                processedTx
                            );
                            // 合并结果
                            for (const [from, edges] of relatedTx) {
                                if (!transactionGraph.has(from)) {
                                    transactionGraph.set(from, []);
                                }
                                transactionGraph.get(from)?.push(...edges);
                            }
                        }
                    }
                }
            }
        }

        console.log(`   ✅ Analysis completed for address: ${address}`);
        console.log(`   📊 Found ${transactionGraph.size} related addresses`);

    } catch (error) {
        console.error(`   ❌ Error analyzing address ${address}:`, error);
        if (error instanceof Error) {
            console.error(`   Details: ${error.message}`);
        }
    }

    return transactionGraph;
}

/**
 * 获取地址的关联交易图
 * @param {string} address - 要分析的地址
 * @param {number} minAmount - 最小交易金额（SOL）
 * @returns {Promise<Map<string, Transaction[]>>} 交易图谱
 */
async function getAddressRelationGraph(
    address: string,
    minAmount: number = 100
): Promise<Map<string, Transaction[]>> {
    console.log(`\n🔍 Starting analysis for address: ${address}`);
    console.log(`   Minimum transaction amount: ${minAmount} SOL`);

    apiCallCount = 0;

    try {
        const graph = await getRelatedTransactions(address, minAmount, 0, 2, new Set());

        // 创建地址到深度的映射
        const addressDepth = new Map<string, number>();
        addressDepth.set(address, 0); // 起始地址深度为0

        // 计算每个地址的深度
        for (const [from, edges] of graph) {
            edges.forEach(edge => {
                const toAddress = edge.to;
                if (edge.type === 'in') {
                    // 对于转入交易，from地址深度+1
                    if (!addressDepth.has(from)) {
                        addressDepth.set(from, (addressDepth.get(toAddress) || 0) + 1);
                    }
                } else {
                    // 对于转出交易，to地址深度-1
                    if (!addressDepth.has(toAddress)) {
                        addressDepth.set(toAddress, (addressDepth.get(from) || 0) - 1);
                    }
                }
            });
        }

        // 按深度输出结果
        console.log('\nTransaction Graph:');
        for (let depth = 2; depth >= -2; depth--) {
            console.log(`\n=== Depth ${depth} ===`);
            for (const [from, edges] of graph) {
                if (addressDepth.get(from) === depth) {
                    edges.forEach(edge => {
                        console.log(`\nFrom: ${from}`);
                        console.log(`  → To: ${edge.to}`);
                        console.log(`    Amount: ${edge.amount} SOL`);
                        console.log(`    Time: ${edge.formattedTime}`);
                        console.log(`    Type: ${edge.type}`);
                    });
                }
            }
        }

        // 打印 API 调用统计
        console.log(`\nTotal API calls made: ${apiCallCount}`);
        for (const [from, edges] of graph) {
            edges.forEach(edge => {
                const toAddress = edge.to;
                if (edge.type === 'in') {
                    // 对于转入交易，from地址深度+1
                    if (!addressDepth.has(from)) {
                        addressDepth.set(from, (addressDepth.get(toAddress) || 0) + 1);
                    }
                } else {
                    // 对于转出交易，to地址深度-1
                    if (!addressDepth.has(toAddress)) {
                        addressDepth.set(toAddress, (addressDepth.get(from) || 0) - 1);
                    }
                }
            });
        }

        // 按深度输出结果
        console.log('\nTransaction Graph:');
        for (let depth = 2; depth >= -2; depth--) {
            console.log(`\n=== Depth ${depth} ===`);
            for (const [from, edges] of graph) {
                if (addressDepth.get(from) === depth) {
                    edges.forEach(edge => {
                        console.log(`\nFrom: ${from}`);
                        console.log(`  → To: ${edge.to}`);
                        console.log(`    Amount: ${edge.amount} SOL`);
                        console.log(`    Time: ${edge.formattedTime}`);
                        console.log(`    Type: ${edge.type}`);
                    });
                }
            }
        }

        // 打印 API 调用统计
        console.log(`\nTotal API calls made: ${apiCallCount}`);
        for (const [from, edges] of graph) {
            edges.forEach(edge => {
                const toAddress = edge.to;
                if (edge.type === 'in') {
                    // 对于转入交易，from地址深度+1
                    if (!addressDepth.has(from)) {
                        addressDepth.set(from, (addressDepth.get(toAddress) || 0) + 1);
                    }
                } else {
                    // 对于转出交易，to地址深度-1
                    if (!addressDepth.has(toAddress)) {
                        addressDepth.set(toAddress, (addressDepth.get(from) || 0) - 1);
                    }
                }
            });
        }

        // 按深度输出结果
        console.log('\nTransaction Graph:');
        for (let depth = 2; depth >= -2; depth--) {
            console.log(`\n=== Depth ${depth} ===`);
            for (const [from, edges] of graph) {
                if (addressDepth.get(from) === depth) {
                    edges.forEach(edge => {
                        console.log(`\nFrom: ${from}`);
                        console.log(`  → To: ${edge.to}`);
                        console.log(`    Amount: ${edge.amount} SOL`);
                        console.log(`    Time: ${edge.formattedTime}`);
                        console.log(`    Type: ${edge.type}`);
                    });
                }
            }
        }

        // 打印 API 调用统计
        console.log(`\nTotal API calls made: ${apiCallCount}`);
        for (const [from, edges] of graph) {
            edges.forEach(edge => {
                const toAddress = edge.to;
                if (edge.type === 'in') {
                    // 对于转入交易，from地址深度+1
                    if (!addressDepth.has(from)) {
                        addressDepth.set(from, (addressDepth.get(toAddress) || 0) + 1);
                    }
                } else {
                    // 对于转出交易，to地址深度-1
                    if (!addressDepth.has(toAddress)) {
                        addressDepth.set(toAddress, (addressDepth.get(from) || 0) - 1);
                    }
                }
            });
        }

        // 按深度输出结果
        console.log('\nTransaction Graph:');
        for (let depth = 2; depth >= -2; depth--) {
            console.log(`\n=== Depth ${depth} ===`);
            for (const [from, edges] of graph) {
                if (addressDepth.get(from) === depth) {
                    edges.forEach(edge => {
                        console.log(`\nFrom: ${from}`);
                        console.log(`  → To: ${edge.to}`);
                        console.log(`    Amount: ${edge.amount} SOL`);
                        console.log(`    Time: ${edge.formattedTime}`);
                        console.log(`    Type: ${edge.type}`);
                    });
                }
            }
        }

        // 打印 API 调用统计
        console.log(`\nTotal API calls made: ${apiCallCount}`);
        return graph;
    } catch (error) {
        console.error('\n❌ Error in analysis:', error);
        return new Map();
    }
}

// 导出函数和类型
export {
    getTransactionGraph,
    getAddressRelationGraph
};

export type {
    Transaction,
    SolscanResponse,
    APIParams
};

// 测试入口
if (require.main === module) {
    const testAddress = 'DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm';
    const minAmount = 50;

    console.log('\n🧪 Starting test analysis');
    console.log(`   Address: ${testAddress}`);
    console.log(`   Min Amount: ${minAmount} SOL`);

    getAddressRelationGraph(testAddress, minAmount)
        .then(() => console.log('\n✅ Test completed successfully'))
        .catch(error => console.error('\n❌ Test failed:', error));
}
