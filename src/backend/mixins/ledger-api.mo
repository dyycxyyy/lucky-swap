import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import LedgerTypes "../types/ledger";
import CommonTypes "../types/common";
import LedgerLib "../lib/ledger";

mixin (
  balances : Map.Map<Principal, Nat>,
  allowances : Map.Map<Principal, Map.Map<Principal, Nat>>,
  poolState : CommonTypes.PoolState,
  accessControlState : AccessControl.AccessControlState,
) {
  public query func icrc1_name() : async Text {
    "Lucky";
  };

  public query func icrc1_symbol() : async Text {
    "Lucky";
  };

  public query func icrc1_decimals() : async Nat8 {
    LedgerLib.DECIMALS;
  };

  public query func icrc1_fee() : async Nat {
    LedgerLib.FEE;
  };

  public query func icrc1_total_supply() : async Nat {
    poolState.totalSupply;
  };

  public query func icrc1_metadata() : async [(Text, LedgerTypes.MetadataValue)] {
    [
      ("icrc1:name", #Text("Lucky")),
      ("icrc1:symbol", #Text("Lucky")),
      ("icrc1:decimals", #Nat(LedgerLib.DECIMALS.toNat())),
      ("icrc1:fee", #Nat(LedgerLib.FEE)),
      ("icrc1:logo", #Text("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke='%23D4AF37' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M32 32C25 25 15 21 15 13C15 6 24 3 28 8C30 10 31 11 32 13C33 11 34 10 36 8C40 3 49 6 49 13C49 21 39 25 32 32ZM32 32C25 39 21 49 13 49C6 49 3 40 8 36C10 34 11 33 13 32C11 31 10 30 8 28C3 24 6 15 13 15C21 15 25 25 32 32ZM32 32C39 39 49 43 49 51C49 58 40 61 36 56C34 54 33 53 32 51C31 53 30 54 28 56C24 61 15 58 15 51C15 43 25 39 32 32ZM32 32C39 25 43 15 51 15C58 15 61 24 56 28C54 30 53 31 51 32C53 33 54 34 56 36C61 40 58 49 51 49C43 49 39 39 32 32Z'/></g></svg>")),
    ];
  };

  public query func icrc1_balance_of(account : LedgerTypes.Account) : async Nat {
    LedgerLib.balanceOf(balances, account);
  };

  public shared ({ caller }) func icrc1_transfer(args : LedgerTypes.TransferArgs) : async LedgerTypes.TransferResult {
    LedgerLib.transfer(balances, poolState, caller, args);
  };

  public query func icrc1_supported_standards() : async [LedgerTypes.SupportedStandard] {
    [
      { name = "ICRC-1"; url = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" },
      { name = "ICRC-2"; url = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-2" },
    ];
  };

  public shared ({ caller }) func icrc2_approve(args : LedgerTypes.ApproveArgs) : async LedgerTypes.ApproveResult {
    LedgerLib.approve(allowances, caller, args);
  };

  public query func icrc2_allowance(args : LedgerTypes.AllowanceArgs) : async LedgerTypes.Allowance {
    LedgerLib.allowance(allowances, args);
  };

  public shared ({ caller }) func icrc2_transfer_from(args : LedgerTypes.TransferFromArgs) : async LedgerTypes.TransferFromResult {
    LedgerLib.transferFrom(balances, allowances, poolState, caller, args);
  };

  public shared ({ caller }) func mintToPool(amount : Nat) : async LedgerTypes.MintResult {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return #Err(#NotAdmin);
    };
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    let supply = LedgerLib.mintToPool(poolState, amount);
    #Ok(supply);
  };

  public shared ({ caller }) func mintTo(to : Principal, amount : Nat) : async LedgerTypes.MintResult {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return #Err(#NotAdmin);
    };
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    let supply = LedgerLib.mintTo(balances, poolState, to, amount);
    #Ok(supply);
  };

  public shared ({ caller }) func burnFrom(from : Principal, amount : Nat) : async LedgerTypes.BurnResult {
    if (caller.isAnonymous() or not AccessControl.isAdmin(accessControlState, caller)) {
      return #Err(#NotAdmin);
    };
    if (amount == 0) {
      return #Err(#InvalidAmount("Amount must be greater than zero"));
    };
    let available = balances.get(from) ?? 0;
    if (available < amount) {
      return #Err(#InsufficientBalance({ balance = available }));
    };
    let supply = LedgerLib.burnFrom(balances, poolState, from, amount);
    #Ok(supply);
  };
};
