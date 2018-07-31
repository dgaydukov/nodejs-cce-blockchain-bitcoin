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
import {buildMessage} from "@deamons/helpers"

const METHOD_NEW_BALANCE = "newBalance"
const METHOD_NEW_TRANSACTION = "newTx"




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
    setInterval(inner, intervalTime)
}


const check = async(node, kc)=>{
    /**
     *  For test purpose you can clear latestblock & transaction
     *  LatestBlock.collection.drop()
     *  Transaction.collection.drop()
     */

    let lastBlock = await LatestBlock.findOne()
    if(!lastBlock){
        lastBlock = new LatestBlock()
        lastBlock.blockNumber = Number(config.BITCOIN_SYNC_START_BLOCK)
    }
    debug(`----------start block #${lastBlock.blockNumber}----------`)
    lastBlock.blockNumber = Number(lastBlock.blockNumber) + 1
    const dbAddressList = await Address.find()
    debug(`number of address to watch: ${dbAddressList.length}`)
    const addressList = {}
    dbAddressList.map(item=> {
        if (item.address) {
            addressList[item.address.toLowerCase()] = item
        }
    })
    const block = await node.getBlockByNumber(lastBlock.blockNumber)
    const len = block.tx.length
    debug(`number of tx: ${len}`)
    for(let i = 0; i < len; i++){
        const txId = block.tx[i]
        const tx = await node.getTxById(txId)
        tx.vout.map(output=>{
            const addresses = output.scriptPubKey.addresses;
            if(addresses){
                const outputAddress = addresses[0].toLowerCase()
                const amount = parseFloat(output.value)
                const outputAddressItem = addressList[outputAddress]
                if(outputAddressItem){
                    debug(`address found: ${outputAddress}, ${amount}`)
                    Transaction.findOne({txId: txId}, (err, dbTx)=>{
                        //if transaction doesn't exist create and recalculate balance
                        if(!dbTx){
                            dbTx = new Transaction()
                            dbTx.txId = txId
                        }
                        dbTx.addressFrom = []
                        dbTx.addressTo = outputAddressItem.address
                        dbTx.amount = amount
                        dbTx.confirmationNumber = tx.confirmations
                        dbTx.blockNumber = lastBlock.blockNumber
                        dbTx.type = TYPE.INPUT
                        dbTx.save((err, data)=>{
                            debug(`tx saved ${txId}, address: ${outputAddress}`)
                            kc.send(buildMessage(METHOD_NEW_BALANCE, {
                                    address: outputAddressItem.address,
                                    amount: amount,
                                    txId: data.txId,
                                })
                            );
                            //update address table for total address balance
                            Transaction.find({addressTo: outputAddress}, (err, data)=>{
                                let balance = 0
                                data.map(item=>{
                                    balance += Number(item.amount)
                                })
                                outputAddressItem.balance = balance.toFixed(8)
                                outputAddressItem.save((err, data)=>{
                                })
                            })
                        })
                    })
                }
            }
        })
        /**
         * pure bitcoin feature, we need to go one level deep to to get address from
         */
        const vinLen = tx.vin.length
        const vinCb = (txId, list) => {
            Transaction.findOne({txId: txId, addressFrom: []}, (err, txItem)=>{
                if(txItem){
                    txItem.addressFrom = list
                    txItem.save((err, savedTx)=>{
                        debug(`tx updated`, savedTx)
                        kc.send(buildMessage(METHOD_NEW_TRANSACTION, {
                                txId: txId,
                                addressFrom: savedTx.addressFrom,
                                addressTo: savedTx.addressTo,
                                amount: savedTx.amount,
                                confirmationNumber: savedTx.confirmationNumber,
                                blockNumber: savedTx.blockNumber,
                            })
                        );
                    })
                }
            })
        }
        const vinAddressList = []
        tx.vin.map((input, i)=>{
            if(input.txid){
                node.getTransaction(input.txid, (err, inTx)=>{
                    if(err){
                        return
                    }
                    const inputAddressItem = inTx.vout[tx.vin[i].vout]
                    const addresses = inputAddressItem.scriptPubKey.addresses;
                    if(addresses){
                        vinAddressList.push(addresses[0])
                    }
                    if(i == vinLen - 1){
                        vinCb(txId, vinAddressList)
                    }
                })
            }
        })
    }
}


run()