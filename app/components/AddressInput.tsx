'use client';

import { useState } from 'react';

interface Props {
    onSubmit: (address: string) => Promise<void>;
}

export default function AddressInput({ onSubmit }: Props) {
    const [address, setAddress] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address.trim()) return;
        await onSubmit(address);
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-4 items-center">
            <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter token address"
                className="flex-1 p-2 border rounded"
            />
            <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Analyze
            </button>
        </form>
    );
}