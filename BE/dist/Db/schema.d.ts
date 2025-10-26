import { Schema } from "mongoose";
export declare const User: import("mongoose").Model<{
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").ResolveSchemaOptions<{
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    walletAddress: string;
    referrer: string;
    isReferred: boolean;
    DepositBalance: number;
    balance: number;
    totalEarned: number;
    roundsPlayed: number;
    payouts: number;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
export declare const Payout: import("mongoose").Model<{
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").ResolveSchemaOptions<{
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    user: import("mongoose").Types.ObjectId;
    amount: number;
    txHash: string;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=schema.d.ts.map