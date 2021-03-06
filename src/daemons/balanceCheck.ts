/**
 * Straight way balance check with constant longpolling of bitcoin node (bitcoind) with all addresses that
 * we have in our database. The deamon simply run across every address in db and check if it balance has changed,
 * that means somebody (but not we) made transaction and move money to daemon.
 */
require('module-alias/register')
const debug = require("debug")("bcheck")
import {KafkaConnector} from "@kafka/kafkaConnector"
import {Address} from "@db/models/address"
import {Transaction, TYPE} from "@db/models/transaction"
import {LatestBlock} from "@db/models/latestBlock"
import {BitcoinNode} from "@blockchain/bitcoinNode"
import {default as config} from "@root/config.json"
import {buildMessage} from "@daemons/helpers"
import {METHOD_NEW_BALANCE, METHOD_NEW_TRANSACTION} from "@root/constList"




const run = () => {
    const intervalTime = Number(process.env.RUN_INTERVAL) * 1000
    const node = new BitcoinNode()
    const kc = new KafkaConnector()
    let allowRun = true
    const inner = ()=>{
        if(allowRun) {
            debug("start")
            allowRun = false
            check(node, kc)
                .then(() => {
                    allowRun = true
                    debug(`-------------finish-------------`)
                })
                .catch((ex) => {
                    allowRun = true
                    debug(`Error: ${ex}`)
                })
        }
    }
    inner();
    //setInterval(inner, intervalTime)
}

const convert = (amount)=>{
    return parseFloat(parseFloat(amount.toString()).toFixed(8))
}



const check = async(node, kc)=>{
    /**
     *  For test purpose you can clear latestblock & transaction
     *  LatestBlock.collection.drop()
     *  Transaction.collection.drop()
     */
    try{
        let lastBlock = await LatestBlock.findOne()
        if(!lastBlock){
            lastBlock = new LatestBlock()
            lastBlock.blockNumber = Number(config.BITCOIN_SYNC_START_BLOCK)
        }
        debug(`block #${lastBlock.blockNumber}`)
        const dbAddressList = await Address.find()
        debug(`number of address to watch: ${dbAddressList.length}`)
        const addressList = {}
        dbAddressList.map(item=> {
            if (item.address) {
                addressList[item.address.toLowerCase()] = item
            }
        })
        const block = await node.getBlockByNumber(lastBlock.blockNumber)
        const txLen = block.tx.length
        debug(`number of tx: ${txLen}`)
        const checkTx = async(tx, txType)=>{
            const txId = tx.txid
            const voutLen = tx.vout.length
            for(let j = 0; j < voutLen; j++){
                const output = tx.vout[j]
                const amount = Number(output.value)
                const addresses = output.scriptPubKey.addresses;
                if(addresses){
                    const outputAddress = addresses[0].toLowerCase()
                    const dbAddressItem = addressList[outputAddress]
                    if(dbAddressItem){
                        const block = await node.getBlockByHash(tx.blockhash)
                        debug(`address found: ${outputAddress}, ${amount}`)
                        let dbTx = await Transaction.findOne({txId: txId})
                        //if transaction doesn't exist create and recalculate balance
                        if(!dbTx){
                            dbTx = new Transaction()
                            dbTx.txId = txId
                        }
                        dbTx.addressFrom = []
                        dbTx.addressTo = dbAddressItem.address
                        dbTx.amount = amount
                        dbTx.confirmationNumber = tx.confirmations
                        dbTx.blockNumber = block.height
                        dbTx.type = txType
                        const data = await dbTx.save()
                        debug(`tx saved ${txId}, address: ${outputAddress}`)
                        //update address table for total address balance
                        const dbTxList = await Transaction.find({$or: [
                                {addressFrom: {$regex: outputAddress, $options: 'i'}},
                                {addressTo: {$regex: outputAddress, $options: 'i'}}
                            ]
                        })
                        let balance = 0
                        dbTxList.map(txItem=>{
                            if (txItem.type == TYPE.INPUT) {
                                balance += Number(txItem.amount)
                            }
                            else {
                                balance -= Number(txItem.amount)
                                balance -= Number(txItem.fee)
                            }
                        })
                        kc.send(
                            buildMessage(METHOD_NEW_BALANCE, {
                                address: dbAddressItem.address,
                                txId: data.txId,
                                lastTxAmount: amount,
                                balance: balance,
                            })
                        );
                        dbAddressItem.balance = balance.toFixed(8)
                        dbAddressItem.save()

                        //to calculate distract the sum of all input from sum of all output
                        let fee = 0
                        /**
                         * pure Bitcoin feature, we need to go one level deep to to get addressFrom from vin
                         * cause vin has only txId
                         */
                        const vinLen = tx.vin.length
                        const vinAddressList = []
                        for(let k = 0; k < vinLen; k++){
                            const input = tx.vin[k]
                            if(input.txid){
                                const inTx = await node.getTxById(input.txid)
                                const inputAddressItem = inTx.vout[input.vout]
                                console.log(input.txid, inputAddressItem.value, fee)
                                fee += Number(inputAddressItem.value)
                                const addresses = inputAddressItem.scriptPubKey.addresses;
                                if(addresses){
                                    vinAddressList.push(addresses[0])
                                }
                            }
                        }
                        tx.vout.map(_tx=>{
                            fee -= Number(_tx.value)
                        })
                        if(vinAddressList.length > 0){
                            const txItem = await Transaction.findOne({txId: txId, addressFrom: []})
                            if(txItem){
                                txItem.addressFrom = vinAddressList
                                const savedTx = await txItem.save()
                                kc.send(
                                    buildMessage(METHOD_NEW_TRANSACTION, {
                                        txId: txId,
                                        addressFrom: savedTx.addressFrom,
                                        addressTo: savedTx.addressTo,
                                        amount: savedTx.amount,
                                        fee: convert(fee),
                                        confirmationNumber: savedTx.confirmationNumber,
                                        blockNumber: savedTx.blockNumber,
                                        type: savedTx.type
                                    })
                                )
                            }
                        }
                    }
                }
            }
        }
        for(let i = 0; i < txLen; i++){
            const tx = await node.getTxById(block.tx[i])
            await checkTx(tx, TYPE.INPUT)
            //check all output tx from out addresses
            const vinLen = tx.vin.length
            for(let j = 0; j < vinLen; j++){
                const input = tx.vin[j]
                if(input.txid){
                    const inTx = await node.getTxById(input.txid)
                    await checkTx(inTx, TYPE.OUTPUT)
                }
            }

        }
        lastBlock.blockNumber = Number(lastBlock.blockNumber) + 1
        lastBlock.save()
    }
    catch(ex){
        debug(`Error: ${ex}`)
    }
}


run()