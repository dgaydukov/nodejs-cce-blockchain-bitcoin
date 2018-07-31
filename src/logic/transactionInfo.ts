
import {Transaction} from "@db/models/transaction"

export class TransactionInfo{
    txId: string;

    constructor(txId){
        this.txId = txId
    }

    async get(){
        const txItem = await Transaction.findOne({txId: this.txId})
        if(!txItem){
            throw new Error(`No such tx with id: ${this.txId}`)
        }
        return txItem
    }
}