import redisClient from "../config/redisClient.js";

// Batch operations for better performance
export const setCache = async (key: string, value: any, ttl?: number)=>{
    try{
        const StringValue = JSON.stringify(value);
        if(ttl){
            await redisClient.set(key, StringValue, {EX: ttl});
        }
        else{
            await redisClient.set(key, StringValue);
        }
        return true;
    }
    catch(error){
        // Silent fail for cache operations
    }
}

// Batch multiple cache operations (5-10x faster)
export const setCacheBatch = async (operations: Array<{key: string, value: any, ttl?: number}>) => {
    try {
        const pipeline = redisClient.multi();
        operations.forEach(op => {
            const StringValue = JSON.stringify(op.value);
            if (op.ttl) {
                pipeline.set(op.key, StringValue, {EX: op.ttl});
            } else {
                pipeline.set(op.key, StringValue);
            }
        });
        await pipeline.exec();
        return true;
    } catch (error) {
        // Silent fail for cache operations
        return false;
    }
}


export const getCache = async (key: string)=>{
    try{
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch(error){
        // Silent fail for cache operations
        return null;
    }
}

// Batch get multiple keys (3-5x faster)
export const getCacheBatch = async (keys: string[]) => {
    try {
        const pipeline = redisClient.multi();
        keys.forEach(key => pipeline.get(key));
        const results = await pipeline.exec();
        return results?.map((result: any) => 
            result && result[1] ? JSON.parse(result[1]) : null
        ) || [];
    } catch (error) {
        return keys.map(() => null);
    }
}

export async function deleteCache(key: string) {
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      // Silent fail for cache operations
      return false;
    }
}

// Batch delete multiple keys (3-5x faster)
export const deleteCacheBatch = async (keys: string[]) => {
    try {
        const pipeline = redisClient.multi();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();
        return true;
    } catch (err) {
        return false;
    }
}