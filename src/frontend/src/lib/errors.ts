/**
 * Maps backend error variants (from the generated bindings) to user-facing
 * English messages. Every backend error union is handled explicitly so the UI
 * never surfaces a raw variant name.
 */

import type {
  BurnError,
  IntegrationError,
  MintError,
  SendError,
  SwapError,
  TreasuryError,
} from "@/backend";
import { formatAmount } from "@/lib/format";

export function swapErrorMessage(error: SwapError): string {
  switch (error.__kind__) {
    case "InsufficientPoolIcp":
      return `The pool only has ${formatAmount(error.InsufficientPoolIcp.available)} ICP available. Try a smaller swap.`;
    case "InsufficientPoolLucky":
      return `The pool only has ${formatAmount(error.InsufficientPoolLucky.available)} Lucky available. Try a smaller swap.`;
    case "InsufficientUserIcp":
      return `You only have ${formatAmount(error.InsufficientUserIcp.available)} ICP. Add funds or lower the amount.`;
    case "InsufficientUserLucky":
      return `You only have ${formatAmount(error.InsufficientUserLucky.available)} Lucky. Lower the amount and try again.`;
    case "InvalidAmount":
      return error.InvalidAmount;
    case "IcpTransferFailed":
      return `The ICP transfer could not be completed: ${error.IcpTransferFailed}`;
    case "LuckyTransferFailed":
      return `The Lucky transfer could not be completed: ${error.LuckyTransferFailed}`;
    default:
      return "The swap could not be completed. Please try again.";
  }
}

export function sendErrorMessage(error: SendError): string {
  switch (error.__kind__) {
    case "InvalidAmount":
      return error.InvalidAmount;
    case "InsufficientFunds":
      return `You only have ${formatAmount(error.InsufficientFunds.available)} available. Lower the amount and try again.`;
    case "TransferFailed":
      return `The transfer failed: ${error.TransferFailed}`;
    default:
      return "The transfer could not be completed. Please try again.";
  }
}

export function treasuryErrorMessage(error: TreasuryError): string {
  switch (error.__kind__) {
    case "NotAdmin":
      return "Only the treasury admin can perform this action.";
    case "InvalidAmount":
      return error.InvalidAmount;
    case "InsufficientTreasury":
      return `The treasury only holds ${formatAmount(error.InsufficientTreasury.available)} Lucky. Lower the amount and try again.`;
    case "TransferFailed":
      return `The treasury transfer failed: ${error.TransferFailed}`;
    default:
      return "The treasury action could not be completed. Please try again.";
  }
}

export function mintErrorMessage(error: MintError): string {
  switch (error.__kind__) {
    case "NotAdmin":
      return "Only the admin can mint Lucky.";
    case "InvalidAmount":
      return error.InvalidAmount;
    default:
      return "Minting failed. Please try again.";
  }
}

export function burnErrorMessage(error: BurnError): string {
  switch (error.__kind__) {
    case "NotAdmin":
      return "Only the admin can burn Lucky.";
    case "InvalidAmount":
      return error.InvalidAmount;
    case "InsufficientBalance":
      return `That address only holds ${formatAmount(error.InsufficientBalance.balance)} Lucky. Lower the amount and try again.`;
    default:
      return "Burning failed. Please try again.";
  }
}

export function integrationErrorMessage(error: IntegrationError): string {
  switch (error.__kind__) {
    case "NotAuthorized":
      return "This principal is not an authorized integration caller. Ask an admin to authorize it first.";
    case "NotAdmin":
      return "Only the treasury admin can perform this action.";
    case "InvalidAmount":
      return error.InvalidAmount;
    case "InsufficientFunds":
      return `The wallet only holds ${formatAmount(error.InsufficientFunds.available)} Lucky, but ${formatAmount(error.InsufficientFunds.required)} is required.`;
    case "InsufficientTreasury":
      return `The treasury only holds ${formatAmount(error.InsufficientTreasury.available)} Lucky, but ${formatAmount(error.InsufficientTreasury.required)} is required.`;
    case "UnknownPrizePool":
      return `No prize pool exists with the id "${error.UnknownPrizePool}".`;
    case "TransferFailed":
      return `The transfer could not be completed: ${error.TransferFailed}`;
    default:
      return "The integration request could not be completed. Please try again.";
  }
}

/** Normalize an unknown thrown value into a readable message. */
export function unknownErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return "Something went wrong. Please try again.";
}
