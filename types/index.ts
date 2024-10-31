export interface Transaction {
    from: string;
    to: string;
    amount: number;
    type: 'in' | 'out';
    time: string;
}

export interface HolderData {
    transactions: Transaction[];
    incomingAddresses: string[];
    outgoingAddresses: string[];
}

export interface Holder {
    holder_address: string;
    holder_sns: string | null;
    holder_pct_of_supply: string;
    is_new: boolean;
}

export interface AnalysisResult {
    topHolders: Holder[];
    relatedAddresses: {
        [key: string]: HolderData;
    };
}