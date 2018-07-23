/**
 *
 */
export interface ITransaction {
    txId: string;
    blockNumber: number;
    addressFrom: Array<string>;
    addressTo: string;
    amount: number;
    datetime: Date;
    confirmationNumber: number;
    type: number;
}