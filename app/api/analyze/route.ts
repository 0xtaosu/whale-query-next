/**
 * Token Holder Analysis API Route
 * 
 * 主要功能：
 * 1. 接收代币地址
 * 2. 分析持有者关系
 * 3. 返回分析结果
 * 
 * @route POST /api/analyze
 */

import { NextResponse } from 'next/server';
import { analyzeTokenHoldersRelatedAddresses } from '@/app/lib/analyze';

/**
 * 自定义分析错误类
 * 用于处理分析过程中的特定错误情况
 */
class AnalysisError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500
    ) {
        super(message);
        this.name = 'AnalysisError';
    }
}

/**
 * 请求参数接口
 */
interface AnalyzeRequest {
    address: string;  // 代币合约地址
}

/**
 * 错误响应接口
 */
interface ErrorResponse {
    error: string;
    details?: unknown;
}

/**
 * POST 请求处理函数
 * 
 * @param request 包含代币地址的请求对象
 * @returns 分析结果或错误信息
 * 
 * @throws AnalysisError 当分析过程出错时
 * 
 * @example
 * POST /api/analyze
 * Body: { "address": "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump" }
 */
export async function POST(request: Request) {
    try {
        // 1. 验证请求数据
        const { address } = await request.json() as AnalyzeRequest;

        // 2. 参数验证
        if (!address) {
            return NextResponse.json<ErrorResponse>(
                {
                    error: 'Token address is required',
                    details: 'Please provide a valid token contract address'
                },
                { status: 400 }
            );
        }

        // 3. 地址格式验证（可选：根据具体链的地址格式添加验证）
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
            return NextResponse.json<ErrorResponse>(
                {
                    error: 'Invalid token address format',
                    details: 'Please provide a valid Solana token address'
                },
                { status: 400 }
            );
        }

        // 4. 执行分析
        console.log(`Starting analysis for token: ${address}`);
        const result = await analyzeTokenHoldersRelatedAddresses(address);

        // 5. 序列化结果
        // 注意：Map 对象需要转换为普通对象才能序列化
        const serializedResult = {
            ...result,
            relatedAddresses: Object.fromEntries(result.relatedAddresses)
        };

        // 6. 返回结果
        console.log(`Analysis completed for token: ${address}`);
        return NextResponse.json(serializedResult);

    } catch (error) {
        // 7. 错误处理
        console.error('Analysis error:', error);

        // 处理已知的分析错误
        if (error instanceof AnalysisError) {
            return NextResponse.json<ErrorResponse>(
                {
                    error: error.message,
                    details: error.cause
                },
                { status: error.statusCode }
            );
        }

        // 处理其他未预期的错误
        return NextResponse.json<ErrorResponse>(
            {
                error: 'An unexpected error occurred',
                details: process.env.NODE_ENV === 'development'
                    ? error instanceof Error ? error.message : String(error)
                    : undefined
            },
            { status: 500 }
        );
    }
}
