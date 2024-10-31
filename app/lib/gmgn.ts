/**
 * gmgn.ts
 * 主要功能：爬取 GMGN 网站数据
 */

import dotenv from 'dotenv';

// 配置环境变量
dotenv.config();

// 类型定义
interface HolderData {
    holder_address: string;
    holder_sns: string | null;
    holder_pct_of_supply: string;
    is_new: boolean;
}

interface GMGNHolder {
    address: string;
    name?: string;
    amount_percentage: number;
    tags: string[];
    maker_token_tags: string[];
    amount_cur: number;
    wallet_tag_v2?: string;
    is_new?: boolean;
}

interface GMGNResponse {
    code: number;
    message: string;
    data: GMGNHolder[];
}


// 代理配置
const PROXY_URL = process.env.PROXY_URL;

/**
 * 添加重试机制的包装函数
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 2000
): Promise<T> {
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Attempt ${i + 1} failed:`, error.message);
            } else {
                console.error(`Attempt ${i + 1} failed:`, String(error));
            }
            lastError = error;

            if (i < maxRetries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * 过滤和转换持有者数据
 * @param holders 持有者数据
 * @returns 过滤后的持有者数据
 */
function filterHolders(holders: GMGNHolder[]): HolderData[] {
    // 定义需要过滤的名称列表
    const FILTERED_NAMES = [
        'Raydium Authority V4',
        'MEXC',
        'Gate.io',
        'HTX',
        'Raydium Pool',
        'Raydium LP'
    ];

    return holders
        .filter(holder => {
            if (holder.name && FILTERED_NAMES.some(name =>
                holder.name?.toLowerCase().includes(name.toLowerCase())
            )) {
                return false;
            }
            return true;
        })
        .map(holder => ({
            holder_address: holder.address,
            holder_sns: holder.name || null,
            holder_pct_of_supply: holder.amount_percentage.toString(),
            is_new: holder.is_new || false
        }));
}

/**
 * 获取代币持有者数据
 * @param tokenAddress 代币地址
 * @param limit 限制数量
 * @returns 持有者数据
 */
async function fetchTokenHolders(
    tokenAddress: string,
    limit: number = 10
): Promise<HolderData[]> {
    console.log(`Fetching data for token: ${tokenAddress}`);

    return withRetry(async () => {
        const url = `https://gmgn.ai/defi/quotation/v1/tokens/top_holders/sol/${tokenAddress}`;
        const queryParams = {
            limit: limit.toString(),
            cost: '20',
            tag: 'All',
            orderby: 'amount_percentage',
            direction: 'desc'
        };

        const fullUrl = `${url}?${new URLSearchParams(queryParams).toString()}`;
        console.log('Request URL:', fullUrl);

        try {
            if (!PROXY_URL) {
                throw new Error('PROXY_URL environment variable is not set');
            }

            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cmd: 'request.get',
                    url: fullUrl,
                    maxTimeout: 60000,
                })
            });

            const proxyResponse = await response.json();

            // 解析HTML响应
            const html = proxyResponse?.solution?.response as string | undefined;
            const reg = /<pre.*>(.+)<\/pre>/;
            const rawData = html?.match(reg)?.[1];

            if (!rawData) {
                throw new Error('Failed to extract data from proxy response');
            }

            const data = JSON.parse(rawData) as GMGNResponse;

            if (data.code !== 0) {
                throw new Error(`GMGN error: ${data.message}`);
            }

            const holders = data.data;
            console.log(`Received ${holders.length} holders`);
            return filterHolders(holders);

        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    });
};

export { fetchTokenHolders };
export type { HolderData };
