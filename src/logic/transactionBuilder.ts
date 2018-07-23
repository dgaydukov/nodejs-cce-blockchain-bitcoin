

import {Transaction, TYPE} from "@db/models/transaction"
import {BitcoinNode} from "@blockchain/bitcoinNode"

export class TransactionBuilder {
    addressTo: string
    amount: number

    constructor(to, amount) {
        this.addressTo = to;
        this.amount = amount;
    }

    run(cb){
        const node = new BitcoinNode()
        node.sendTransaction(this.addressTo, this.amount, (err, txId)=>{
            if(err){
                cb(err)
            }
            else{
                const tx = new Transaction()
                tx.txId = txId
                tx.addressFrom = []
                tx.addressTo = this.addressTo
                tx.amount = this.amount
                tx.type = TYPE.OUTPUT
                tx.save((err,data)=>{
                    cb(err, data)
                })
            }
        })
    }
}