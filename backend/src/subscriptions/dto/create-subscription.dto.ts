import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';

export enum IntervalType {
  Daily = 'Daily',
  Weekly = 'Weekly',
  Monthly = 'Monthly',
}

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Recipient wallet address',
    example: 'erd1qqqqqqqqqqqqqpgq...',
  })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({
    description: 'Amount per payment in EGLD (will be converted to wei)',
    example: '1.5',
  })
  @IsString()
  @IsNotEmpty()
  amountPerPayment: string;

  @ApiProperty({
    description: 'Initial deposit in EGLD (should cover multiple payments)',
    example: '10',
  })
  @IsString()
  @IsNotEmpty()
  initialDeposit: string;

  @ApiProperty({
    description: 'Payment interval type',
    enum: IntervalType,
    example: IntervalType.Daily,
  })
  @IsEnum(IntervalType)
  intervalType: IntervalType;

  @ApiProperty({
    description: 'Total number of payments (optional, unlimited if not specified)',
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalPayments?: number;
}

export class TopUpSubscriptionDto {
  @ApiProperty({
    description: 'Amount to add in EGLD',
    example: '5',
  })
  @IsString()
  @IsNotEmpty()
  amount: string;
}
