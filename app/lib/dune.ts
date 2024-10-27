/**
 * dune.ts
 * 主要功能：与Dune Analytics API交互，获取代币持有者数据
 * 工作流程：
 * 1. 查询代币持有者数据
 * 2. 过滤掉不需要的持有者（如流动性池）
 * 3. 返回处理后的数据
 */

import { DuneClient, QueryParameter } from '@duneanalytics/client-sdk';
import dotenv from 'dotenv';

// 配置环境变量
dotenv.config();

// 类型定义
interface HolderData {
    holder_address: string;
    holder_sns: string | null;
    holder_pct_of_supply: string;
}

// 环境变量配置
const DUNE_API_KEY = process.env.DUNE_API_KEY;

// API密钥检查
if (!DUNE_API_KEY) {
    throw new Error('DUNE_API_KEY is not set in the environment variables');
}

const dune = new DuneClient(DUNE_API_KEY);

/**
 * 过滤持有者列表，移除特定类型的持有者
 * @param holders - 持有者数组
 * @returns 过滤后的持有者数组
 */
function filterHolders(holders: HolderData[]): HolderData[] {
    return holders.filter(holder => {
        // 保留没有SNS的持有者
        if (!holder.holder_sns) return true;
        // 过滤掉Raydium流动性池
        return !holder.holder_sns.includes('raydiumpool.sol');
    });
}

/**
 * 获取代币持有者数据
 * @param tokenAddress - 代币合约地址
 * @returns 过滤后的持有者数据数组
 */
export const fetchTokenHolders = async (tokenAddress: string): Promise<HolderData[]> => {
    console.log(`Fetching data for token: ${tokenAddress}`);

    const QUERY_ID = 4196813;

    const query_parameters = [
        QueryParameter.text("token_address", tokenAddress),
    ];

    console.log('Query parameters:', JSON.stringify(query_parameters, null, 2));

    try {
        // 发送查询请求
        console.log(`Sending query to Dune Analytics (Query ID: ${QUERY_ID})...`);
        const result = await dune.runQuery({
            queryId: QUERY_ID,
            query_parameters: query_parameters,
        });

        console.log('Query execution completed.');

        if (result.result?.rows) {
            console.log(`Received ${result.result.rows.length} rows of data.`);

            // 处理返回数据
            const processedData = result.result.rows.map((row: any) => ({
                holder_address: row.current_holders,
                holder_sns: row.domains_owned,
                holder_pct_of_supply: row.pct_of_supply,
            }));

            // 应用过滤器
            const filteredData = filterHolders(processedData);
            console.log(`Filtered from ${processedData.length} to ${filteredData.length} holders`);

            return filteredData;
        } else {
            console.log('No data returned from Dune Analytics');
            throw new Error('No data returned from Dune Analytics');
        }
    } catch (error) {
        console.error('Error fetching token data:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
};