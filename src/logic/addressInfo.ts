
import {Address} from "@db/models/address"
import {Transaction} from "@db/models/transaction"

export class AddressInfo{
    address: string;

    constructor(address){
        this.address = address
    }

    get(cb){
        Address.findOne({address: this.address}, (err, addressItem)=>{
            if(addressItem){
                const data = {
                    address: this.address,
                    balance: addressItem.balance,
                    tx: []
                }
                Transaction.find({addressTo: this.address.toLowerCase()}, (err, txList)=>{
                    if(txList){
                        txList.map(tx=>{
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
                        cb(null, data)
                    }
                    else{
                        cb(null, data)
                    }
                })
            }
            else{
                cb(err, addressItem)
            }
        })
    }
}