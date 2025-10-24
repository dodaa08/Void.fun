export declare const setCache: (key: string, value: any, ttl?: number) => Promise<true | undefined>;
export declare const setCacheBatch: (operations: Array<{
    key: string;
    value: any;
    ttl?: number;
}>) => Promise<boolean>;
export declare const getCache: (key: string) => Promise<any>;
export declare const getCacheBatch: (keys: string[]) => Promise<any[]>;
export declare function deleteCache(key: string): Promise<boolean>;
export declare const deleteCacheBatch: (keys: string[]) => Promise<boolean>;
//# sourceMappingURL=CacheService.d.ts.map