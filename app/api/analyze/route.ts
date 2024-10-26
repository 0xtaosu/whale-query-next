import { NextResponse } from 'next/server';
import { analyzeTokenHoldersRelatedAddresses } from '@/app/lib/analyze';

// 自定义错误类
class AnalysisError extends Error {
    constructor(message: string, public statusCode: number = 500) {
        super(message);
        this.name = 'AnalysisError';
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        if (!data.tokenAddress) {
            throw new AnalysisError('Token address is required', 400);
        }

        const result = await analyzeTokenHoldersRelatedAddresses(data.tokenAddress);
        const serializedResult = {
            ...result,
            relatedAddresses: Object.fromEntries(result.relatedAddresses)
        };

        return NextResponse.json(serializedResult);
    } catch (error) {
        if (error instanceof AnalysisError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode }
            );
        }

        // 处理其他类型的错误
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
