
import mongoose = require("mongoose");
import { ITransaction } from "@db/interfaces/iTransaction";
import {connection} from "@db/connection"


export interface ITransactionModel extends ITransaction, mongoose.Document {
    //custom methods for your model would be defined here
}

export var TransactionSchema: mongoose.Schema = new mongoose.Schema({
    txId: String,
    addressFrom: [String],
    addressTo: String,
    amount: Number,
    datetime: { type: Date, default: Date.now},
    blockNumber: { type: Number, default: 0},
    confirmationNumber: { type: Number, default: 0},
    type: Number,
});

/**
 * 2 types of transaction
 * 1 - input - we receive money
 * 2 - output - we send money
 *
 * @type {{INPUT: number; OUTPUT: number}}
 */
export const TYPE = {
    INPUT: 1,
    OUTPUT: 2,
}


export const Transaction: mongoose.Model<ITransactionModel> = connection.model<ITransactionModel>("Transaction", TransactionSchema);