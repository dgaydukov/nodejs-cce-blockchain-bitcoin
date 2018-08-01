/**
 *
 */
export interface ITransaction {
    txId: string;
    blockNumber: number;
    addressFrom: Array<string>;
    addressTo: string;
    amount: number;
    fee: number;
    datetime: Date;
    confirmationNumber: number;
    type: number;
}