import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Member {
  id: number;
  name: string;
  createdAt: string;
}

export interface SharedExpense {
  id: number;
  title: string;
  amount: number;
  paidById: number;
  paidBy: Member;
  splitType: "EQUAL" | "CUSTOM" | "PERCENTAGE";
  date: string;
  notes?: string;
  splits: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: number;
  expenseId: number;
  memberId: number;
  member: Member;
  amountOwed: number;
}

export interface Settlement {
  id: number;
  fromMemberId: number;
  fromMember: Member;
  toMemberId: number;
  toMember: Member;
  amount: number;
  date: string;
}

export interface PersonalExpense {
  id: number;
  memberId: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

export interface BalancesResponse {
  netBalances: Record<number, number>;
  simplified: { from: number; to: number; amount: number }[];
}
