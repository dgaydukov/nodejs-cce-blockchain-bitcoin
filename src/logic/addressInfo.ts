
import {Address} from "@db/models/address"
import {Transaction} from "@db/models/transaction"

export class AddressInfo{
    address: string;

    constructor(address){
        this.address = address
    }

    async get(){
        const addressItem = await Address.findOne({address: this.address})
        if(!addressItem){
            throw new Error(`No such address: ${this.address}`)
        }
        const data = {
            address: this.address,
            balance: addressItem.balance,
            tx: []
        }
        const txList = await Transaction.find({addressTo: this.address.toLowerCase()})
        txList.map(tx=> {
            data.tx.push({
                txId: tx.txId,
                confirmationNumber: tx.confirmationNumber,
                blockNumber: tx.blockNumber,
                addressFrom: tx.addressFrom,
                addressTo: tx.addressTo,
                amount: tx.amount,
                type: tx.type,
            })
        })
        return data
    }
}