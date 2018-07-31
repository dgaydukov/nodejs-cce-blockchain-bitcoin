
import {Address} from "@db/models/address"
import {BitcoinNode} from "@blockchain/bitcoinNode"

export class AddressGenerator {
    async getAddress(){
        const node = new BitcoinNode()
        const newAddress = await node.getNewAddress()
        const address = new Address({
            address: newAddress
        })
        return address.save()
    }

    async updateKmId(id, kmId){
        const item = await Address.findOne({_id: id})
        if(item){
            item.kmId = kmId
            item.save()
        }
    }
}