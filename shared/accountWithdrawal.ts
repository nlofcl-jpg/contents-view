export const ACCOUNT_WITHDRAWAL_CONFIRMATION = "회원탈퇴";

export function canWithdrawAccount(confirmation: string) {
  return confirmation === ACCOUNT_WITHDRAWAL_CONFIRMATION;
}
