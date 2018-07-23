
import {Address} from "@db/models/address"
import {BitcoinNode} from "@blockchain/bitcoinNode"

export class AddressGenerator {
    getAddress(cb){
        const node = new BitcoinNode()
        node.getNewAddress((err, newAddress)=>{
            if(err){
                cb(err, null)
            }
            else{
                const address = new Address()
                address.address = newAddress
                address.save((err, data)=>{
                    cb(err, data)
                });
            }
        })
    }
    updateKmId(id, kmId){
        Address.findOne({_id: id}, (err, item)=>{
            if(item){
                item.kmId = kmId
                item.save((err, data)=>{
                })
            }
        })
    }
}