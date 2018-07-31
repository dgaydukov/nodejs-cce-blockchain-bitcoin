

import {Transaction, TYPE} from "@db/models/transaction"
import {BitcoinNode} from "@blockchain/bitcoinNode"

export class TransactionBuilder {
    addressTo: string
    amount: number

    constructor(to, amount) {
        this.addressTo = to;
        this.amount = amount;
    }

    async run(){
        const node = new BitcoinNode()
        const txId = await node.sendTransaction(this.addressTo, this.amount)
        const tx = new Transaction({
            txId: txId,
            addressFrom: [],
            addressTo: this.addressTo,
            amount: this.amount,
            type: TYPE.OUTPUT,
        })
        const txItem = await tx.save()
        return txItem
    }
}