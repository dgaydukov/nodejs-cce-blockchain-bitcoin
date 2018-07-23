
import {Transaction} from "@db/models/transaction"

export class TransactionInfo{
    txId: string;

    constructor(txId){
        this.txId = txId
    }

    get(cb){
        Transaction.findOne({txId: this.txId}, (err, tx)=>{
            if(tx){
                console.log(tx)
                const data = {
                    txId: tx.txId,
                    confirmationNumber: tx.confirmationNumber,
                    blockNumber: tx.blockNumber,
                    addressFrom: tx.addressFrom,
                    addressTo: tx.addressTo,
                    amount: tx.amount,
                    type: tx.type,
                }
                cb(null, data)
            }
            else{
                cb(err, tx)
            }
        })
    }
}