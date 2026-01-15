import { ApiProperty } from '@nestjs/swagger';

export class Subscription {
  @ApiProperty({ description: 'Subscription unique ID' })
  id: number;

  @ApiProperty({ description: 'Payer wallet address' })
  payer: string;

  @ApiProperty({ description: 'Recipient wallet address' })
  recipient: string;

  @ApiProperty({ description: 'Token identifier (e.g., EGLD)' })
  tokenIdentifier: string;

  @ApiProperty({ description: 'Amount per payment in atomic units' })
  amountPerPayment: string;

  @ApiProperty({ description: 'Interval between payments in seconds' })
  intervalSeconds: number;

  @ApiProperty({ description: 'Next payment timestamp (Unix)' })
  nextPaymentTime: number;

  @ApiProperty({ description: 'Subscription creation timestamp (Unix)' })
  createdAt: number;

  @ApiProperty({ description: 'Number of payments made' })
  paymentsMade: number;

  @ApiProperty({ description: 'Total payments limit (null = unlimited)', nullable: true })
  totalPayments: number | null;

  @ApiProperty({ description: 'Current deposited balance in atomic units' })
  depositedBalance: string;

  @ApiProperty({ description: 'Whether subscription is active' })
  isActive: boolean;

  // Additional computed fields for frontend
  @ApiProperty({ description: 'Amount per payment in EGLD (human-readable)' })
  amountPerPaymentEGLD?: string;

  @ApiProperty({ description: 'Deposited balance in EGLD (human-readable)' })
  depositedBalanceEGLD?: string;

  @ApiProperty({ description: 'Next payment date (ISO string)' })
  nextPaymentDate?: string;

  @ApiProperty({ description: 'Interval type (Daily/Weekly/Monthly)' })
  intervalType?: string;
}
