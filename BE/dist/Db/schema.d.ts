import { Schema } from "mongoose";
export declare const User: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
}, {}, {
    timestamps: true;
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
}>, {}, import("mongoose").ResolveSchemaOptions<{
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
}> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
export declare const Payout: import("mongoose").Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
}, {}, {
    timestamps: true;
}> & {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
}>, {}, import("mongoose").ResolveSchemaOptions<{
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
}> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=schema.d.ts.map