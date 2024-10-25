import { NextResponse } from 'next/server';
import { analyzeTokenHoldersRelatedAddresses } from '@/app/lib/analyze';

export async function POST(request: Request) {
    try {
        const { address } = await request.json();

        if (!address) {
            return NextResponse.json(
                { error: 'Token address is required' },
                { status: 400 }
            );
        }

        const result = await analyzeTokenHoldersRelatedAddresses(address);
        const serializedResult = {
            ...result,
            relatedAddresses: Object.fromEntries(result.relatedAddresses)
        };

        return NextResponse.json(serializedResult);
    } catch (error) {
        return NextResponse.json(
            { error: error.message || 'Analysis failed' },
            { status: 500 }
        );
    }
}