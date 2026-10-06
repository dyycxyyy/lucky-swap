import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Account {
    owner: Principal;
    subaccount?: Uint8Array;
}
export interface Allowance {
    allowance: bigint;
    expires_at?: bigint;
}
export interface AllowanceArgs {
    account: Account;
    spender: Account;
}
export interface ApproveArgs {
    fee?: bigint;
    memo?: Uint8Array;
    from_subaccount?: Uint8Array;
    created_at_time?: bigint;
    amount: bigint;
    expected_allowance?: bigint;
    expires_at?: bigint;
    spender: Account;
}
export type ApproveError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: bigint;
    };
} | {
    __kind__: "AllowanceChanged";
    AllowanceChanged: {
        current_allowance: bigint;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: bigint;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "Expired";
    Expired: {
        ledger_time: bigint;
    };
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: bigint;
    };
};
export type ApproveResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: ApproveError;
};
export type BurnError = {
    __kind__: "InvalidAmount";
    InvalidAmount: string;
} | {
    __kind__: "InsufficientBalance";
    InsufficientBalance: {
        balance: bigint;
    };
} | {
    __kind__: "NotAdmin";
    NotAdmin: null;
};
export type BurnResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: BurnError;
};
export interface Cell {
    value: Value;
    name: string;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export type GameEventId = string;
export type IntegrationError = {
    __kind__: "UnknownPrizePool";
    UnknownPrizePool: PrizePoolId;
} | {
    __kind__: "InvalidAmount";
    InvalidAmount: string;
} | {
    __kind__: "NotAuthorized";
    NotAuthorized: null;
} | {
    __kind__: "NotAdmin";
    NotAdmin: null;
} | {
    __kind__: "TransferFailed";
    TransferFailed: string;
} | {
    __kind__: "InsufficientTreasury";
    InsufficientTreasury: {
        available: bigint;
        required: bigint;
    };
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        available: bigint;
        required: bigint;
    };
};
export type MetadataValue = {
    __kind__: "Int";
    Int: bigint;
} | {
    __kind__: "Nat";
    Nat: bigint;
} | {
    __kind__: "Blob";
    Blob: Uint8Array;
} | {
    __kind__: "Text";
    Text: string;
};
export type MintError = {
    __kind__: "InvalidAmount";
    InvalidAmount: string;
} | {
    __kind__: "NotAdmin";
    NotAdmin: null;
};
export type MintResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: MintError;
};
export interface Movement {
    direction: MovementDirection;
    source: MovementSource;
    counterparty: Principal;
    timestamp: bigint;
    amount: bigint;
    gameEventId: GameEventId;
}
export interface PoolBalances {
    icp: bigint;
    lucky: bigint;
}
export type PrizePoolId = string;
export type PrizePoolTopUpResult = {
    __kind__: "Ok";
    Ok: {
        poolBalance: bigint;
        treasuryBalance: bigint;
    };
} | {
    __kind__: "Err";
    Err: IntegrationError;
};
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export type SendError = {
    __kind__: "InvalidAmount";
    InvalidAmount: string;
} | {
    __kind__: "TransferFailed";
    TransferFailed: string;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        available: bigint;
        required: bigint;
    };
};
export type SendResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: SendError;
};
export interface SupportedStandard {
    url: string;
    name: string;
}
export type SwapError = {
    __kind__: "InsufficientPoolIcp";
    InsufficientPoolIcp: {
        available: bigint;
        required: bigint;
    };
} | {
    __kind__: "LuckyTransferFailed";
    LuckyTransferFailed: string;
} | {
    __kind__: "InvalidAmount";
    InvalidAmount: string;
} | {
    __kind__: "IcpTransferFailed";
    IcpTransferFailed: string;
} | {
    __kind__: "InsufficientUserLucky";
    InsufficientUserLucky: {
        available: bigint;
        required: bigint;
    };
} | {
    __kind__: "InsufficientUserIcp";
    InsufficientUserIcp: {
        available: bigint;
        required: bigint;
    };
} | {
    __kind__: "InsufficientPoolLucky";
    InsufficientPoolLucky: {
        available: bigint;
        required: bigint;
    };
};
export interface SwapQuote {
    direction: SwapDirection;
    feeLucky: bigint;
    inputAmount: bigint;
    outputAmount: bigint;
}
export interface SwapReceipt {
    direction: SwapDirection;
    feeLucky: bigint;
    inputAmount: bigint;
    outputAmount: bigint;
}
export type SwapResult = {
    __kind__: "Ok";
    Ok: SwapReceipt;
} | {
    __kind__: "Err";
    Err: SwapError;
};
export interface TransferArgs {
    to: Account;
    fee?: bigint;
    memo?: Uint8Array;
    from_subaccount?: Uint8Array;
    created_at_time?: bigint;
    amount: bigint;
}
export type TransferError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "BadBurn";
    BadBurn: {
        min_burn_amount: bigint;
    };
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: bigint;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: bigint;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: bigint;
    };
};
export interface TransferFromArgs {
    to: Account;
    fee?: bigint;
    spender_subaccount?: Uint8Array;
    from: Account;
    memo?: Uint8Array;
    created_at_time?: bigint;
    amount: bigint;
}
export type TransferFromError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "InsufficientAllowance";
    InsufficientAllowance: {
        allowance: bigint;
    };
} | {
    __kind__: "BadBurn";
    BadBurn: {
        min_burn_amount: bigint;
    };
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: bigint;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: bigint;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: bigint;
    };
};
export type TransferFromResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferFromError;
};
export type TransferResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferError;
};
export type TreasuryError = {
    __kind__: "InvalidAmount";
    InvalidAmount: string;
} | {
    __kind__: "NotAdmin";
    NotAdmin: null;
} | {
    __kind__: "TransferFailed";
    TransferFailed: string;
} | {
    __kind__: "InsufficientTreasury";
    InsufficientTreasury: {
        available: bigint;
        required: bigint;
    };
};
export type TreasuryIntakeResult = {
    __kind__: "Ok";
    Ok: {
        treasuryBalance: bigint;
    };
} | {
    __kind__: "Err";
    Err: IntegrationError;
};
export type TreasuryResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TreasuryError;
};
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export interface WalletBalances {
    icp: bigint;
    lucky: bigint;
}
export type WalletMovementResult = {
    __kind__: "Ok";
    Ok: {
        walletBalance: bigint;
    };
} | {
    __kind__: "Err";
    Err: IntegrationError;
};
export enum MovementDirection {
    In = "In",
    Out = "Out"
}
export enum MovementSource {
    PrizePayout = "PrizePayout",
    Crowdfunding = "Crowdfunding",
    PrizePoolTopUp = "PrizePoolTopUp",
    ExcessSweep = "ExcessSweep",
    BetDebit = "BetDebit"
}
export enum SwapDirection {
    LuckyToIcp = "LuckyToIcp",
    IcpToLucky = "IcpToLucky"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    authorizeIntegrationPrincipal(principal: Principal): Promise<void>;
    burnFrom(from: Principal, amount: bigint): Promise<BurnResult>;
    creditPrize(user: Principal, amount: bigint, payoutEventId: GameEventId): Promise<WalletMovementResult>;
    debitBet(user: Principal, amount: bigint, betId: GameEventId): Promise<WalletMovementResult>;
    execute(qJson: string): Promise<Result>;
    getApiDoc(): Promise<string>;
    getCallerUserRole(): Promise<UserRole>;
    getMovement(gameEventId: GameEventId): Promise<Movement | null>;
    getMyPrincipal(): Promise<Principal>;
    getPoolBalances(): Promise<PoolBalances>;
    getPrizePoolBalance(prizePoolId: PrizePoolId): Promise<bigint>;
    getSwapQuote(direction: SwapDirection, amount: bigint): Promise<SwapQuote>;
    getTreasuryBalance(): Promise<bigint>;
    getTreasuryPrincipal(): Promise<Principal>;
    getWalletBalances(): Promise<WalletBalances>;
    icrc1_balance_of(account: Account): Promise<bigint>;
    icrc1_decimals(): Promise<number>;
    icrc1_fee(): Promise<bigint>;
    icrc1_metadata(): Promise<Array<[string, MetadataValue]>>;
    icrc1_name(): Promise<string>;
    icrc1_supported_standards(): Promise<Array<SupportedStandard>>;
    icrc1_symbol(): Promise<string>;
    icrc1_total_supply(): Promise<bigint>;
    icrc1_transfer(args: TransferArgs): Promise<TransferResult>;
    icrc2_allowance(args: AllowanceArgs): Promise<Allowance>;
    icrc2_approve(args: ApproveArgs): Promise<ApproveResult>;
    icrc2_transfer_from(args: TransferFromArgs): Promise<TransferFromResult>;
    isCallerAdmin(): Promise<boolean>;
    isIntegrationPrincipal(principal: Principal): Promise<boolean>;
    listMovements(): Promise<Array<Movement>>;
    mintTo(to: Principal, amount: bigint): Promise<MintResult>;
    mintToPool(amount: bigint): Promise<MintResult>;
    revokeIntegrationPrincipal(principal: Principal): Promise<void>;
    schema(): Promise<string>;
    sendIcp(to: Principal, amount: bigint): Promise<SendResult>;
    sendLucky(to: Principal, amount: bigint): Promise<SendResult>;
    submitCrowdfunding(amount: bigint, gameEventId: GameEventId): Promise<TreasuryIntakeResult>;
    submitExcessSweep(amount: bigint, gameEventId: GameEventId): Promise<TreasuryIntakeResult>;
    swapIcpToLucky(icpAmount: bigint): Promise<SwapResult>;
    swapLuckyToIcp(luckyAmount: bigint): Promise<SwapResult>;
    topUpPrizePool(prizePoolId: PrizePoolId, amount: bigint): Promise<PrizePoolTopUpResult>;
    withdrawTreasury(amount: bigint, to: Principal): Promise<TreasuryResult>;
}
