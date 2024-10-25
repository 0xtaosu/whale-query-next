'use client';

export default function LoadingOverlay() {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
                <div className="relative">
                    {/* 自定义加载动画 */}
                    <div className="w-12 h-12 rounded-full border-4 border-gray-200">
                        <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin absolute inset-0">
                        </div>
                    </div>
                </div>

                {/* 加载文本 */}
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Analyzing Token Holders
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        This may take a few minutes...
                    </p>
                </div>
            </div>
        </div>
    );
}